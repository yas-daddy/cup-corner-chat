import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, RefreshCw, Trash2, Save, ShieldAlert, Smartphone, Bell, Clock, Clapperboard, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";
import type { Match, Prediction } from "@/lib/types";
import { getStoredPlayerId, type Player } from "@/lib/identity";
import { buildVarReport, type VarReport } from "@/lib/varReport";
import { fetchVarFlags, setVarFlags as saveVarFlags, setFinaleTakeover as saveFinale, type VarFlags } from "@/lib/appFlags";
import { fetchVarStats, type VarStats } from "@/lib/varAnalytics";
import { VarReportStory } from "@/components/VarReportStory";

type PlayerStats = Player & {
  last_open_at: string | null;
  pwa_installed_at: string | null;
  pwa_display_mode: string | null;
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "WC26 Predictor — God Mode" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Draft = { home: number; away: number; dirty: boolean; saving?: boolean; saved?: number };

function AdminPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [preds, setPreds] = useState<Record<string, Prediction>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [champion, setChampion] = useState<{ team: string; team_code: string | null } | null>(null);
  const [championDraft, setChampionDraft] = useState<string>("");
  const [championSaving, setChampionSaving] = useState(false);
  const [championSavedAt, setChampionSavedAt] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string>("");
  const [varReport, setVarReport] = useState<VarReport | null>(null);
  const [varLoading, setVarLoading] = useState(false);
  const [varFlags, setVarFlagsState] = useState<VarFlags | null>(null);
  const [varFlagsSaving, setVarFlagsSaving] = useState(false);
  const [varStats, setVarStats] = useState<VarStats | null>(null);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [pushPlayerIds, setPushPlayerIds] = useState<Set<string>>(new Set());
  const [pushSubCount, setPushSubCount] = useState(0);


  useEffect(() => {
    supabase
      .from("players")
      .select("*")
      .order("display_name")
      .then(({ data }) => {
        setPlayers((data as Player[]) ?? []);
        setStats((data as PlayerStats[]) ?? []);
      });
    supabase
      .from("matches")
      .select("*")
      .order("kickoff_at", { ascending: true })
      .then(({ data }) => setMatches((data as Match[]) ?? []));
    supabase
      .from("push_subscriptions")
      .select("player_id")
      .then(({ data }) => {
        const rows = (data as { player_id: string }[] | null) ?? [];
        setPushSubCount(rows.length);
        setPushPlayerIds(new Set(rows.map((r) => r.player_id)));
      });
  }, []);

  useEffect(() => {
    if (!playerId) {
      setPreds({});
      setDrafts({});
      setChampion(null);
      setChampionDraft("");
      return;
    }
    supabase
      .from("predictions")
      .select("*")
      .eq("player_id", playerId)
      .then(({ data }) => {
        const map: Record<string, Prediction> = {};
        const d: Record<string, Draft> = {};
        (data as Prediction[] | null)?.forEach((p) => {
          map[p.match_id] = p;
          d[p.match_id] = { home: p.pred_home, away: p.pred_away, dirty: false };
        });
        setPreds(map);
        setDrafts(d);
      });
    supabase
      .from("champion_predictions")
      .select("team,team_code")
      .eq("player_id", playerId)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as { team: string; team_code: string | null } | null) ?? null;
        setChampion(c);
        setChampionDraft(c?.team ?? "");
      });
  }, [playerId]);

  const teamOptions = useMemo(() => {
    const set = new Map<string, string>();
    matches.forEach((m) => {
      if (m.home_team) set.set(m.home_team, resolveTeamCode(m.home_code, m.home_team) || "");
      if (m.away_team) set.set(m.away_team, resolveTeamCode(m.away_code, m.away_team) || "");
    });
    return Array.from(set.entries())
      .map(([name, code]) => ({ name, code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  async function saveChampion() {
    if (!playerId || !championDraft) return;
    setChampionSaving(true);
    const code = teamOptions.find((t) => t.name === championDraft)?.code ?? "";
    const { data, error } = await supabase.rpc("admin_upsert_champion", {
      _player_id: playerId,
      _team: championDraft,
      _team_code: code,
    });
    setChampionSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { team: string; team_code: string | null } | null;
    if (row) setChampion({ team: row.team, team_code: row.team_code });
    setChampionSavedAt(Date.now());
  }

  async function removeChampion() {
    if (!playerId) return;
    if (!confirm("Delete this player's champion pick?")) return;
    const { error } = await supabase.rpc("admin_delete_champion", { _player_id: playerId });
    if (error) {
      alert(error.message);
      return;
    }
    setChampion(null);
    setChampionDraft("");
  }


  async function runSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/public/sync-matches", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { synced?: number; source?: string; error?: string };
      setSyncMsg(json.error ? `Error: ${json.error}` : `Synced ${json.synced ?? 0} matches from ${json.source ?? "?"}`);
      const { data } = await supabase.from("matches").select("*").order("kickoff_at", { ascending: true });
      setMatches((data as Match[]) ?? []);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchVarFlags().then((f) => {
      if (active) setVarFlagsState(f);
    });
    fetchVarStats().then((s) => {
      if (active) setVarStats(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function toggleVarFlag(key: keyof VarFlags, value: boolean) {
    const base = varFlags ?? { visible: true, popup: false, finale: false };
    const next = { ...base, [key]: value };
    setVarFlagsState(next); // optimistic
    setVarFlagsSaving(true);
    try {
      const { error } =
        key === "finale" ? await saveFinale(value) : await saveVarFlags(next);
      if (error) {
        setVarFlagsState(base); // revert on failure
        setSyncMsg(`VAR flags: ${error}`);
      }
    } finally {
      setVarFlagsSaving(false);
    }
  }

  async function openVarPreview() {
    const target = playerId || getStoredPlayerId();
    if (!target) {
      setSyncMsg("Pick a player (or sign in) to preview their VAR Report.");
      return;
    }
    setVarLoading(true);
    try {
      const report = await buildVarReport(target);
      if (report) setVarReport(report);
      else setSyncMsg("Could not build a VAR Report for that player.");
    } finally {
      setVarLoading(false);
    }
  }

  function setDraft(matchId: string, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const cur = prev[matchId] ?? { home: 0, away: 0, dirty: false };
      return { ...prev, [matchId]: { ...cur, ...patch, dirty: true } };
    });
  }

  async function save(matchId: string) {
    if (!playerId) return;
    const d = drafts[matchId];
    if (!d) return;
    setDrafts((p) => ({ ...p, [matchId]: { ...d, saving: true } }));
    const { data, error } = await supabase.rpc("admin_upsert_prediction", {
      _player_id: playerId,
      _match_id: matchId,
      _home: d.home,
      _away: d.away,
    });
    if (!error && data) {
      const row = (Array.isArray(data) ? data[0] : data) as Prediction;
      setPreds((p) => ({ ...p, [matchId]: row }));
      setDrafts((p) => ({
        ...p,
        [matchId]: { home: row.pred_home, away: row.pred_away, dirty: false, saved: Date.now() },
      }));
    } else {
      setDrafts((p) => ({ ...p, [matchId]: { ...d, saving: false } }));
      alert(error?.message ?? "Save failed");
    }
  }

  async function remove(matchId: string) {
    if (!playerId) return;
    if (!confirm("Delete this prediction?")) return;
    const { error } = await supabase.rpc("admin_delete_prediction", {
      _player_id: playerId,
      _match_id: matchId,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setPreds((p) => {
      const { [matchId]: _, ...rest } = p;
      return rest;
    });
    setDrafts((p) => {
      const { [matchId]: _, ...rest } = p;
      return rest;
    });
  }

  const grouped = useMemo(() => {
    const by = new Map<string, Match[]>();
    matches.forEach((m) => {
      const day = new Date(m.kickoff_at).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (!by.has(day)) by.set(day, []);
      by.get(day)!.push(m);
    });
    return by;
  }, [matches]);

  const selectedPlayer = players.find((p) => p.id === playerId);

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/" })}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent">
            <ShieldAlert className="h-3.5 w-3.5" /> God Mode
          </p>
          <h1 className="text-xl font-extrabold">Admin</h1>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Match data sync</div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Trigger API sync"}
        </button>
        {syncMsg && <p className="mt-2 text-xs text-ink-soft">{syncMsg}</p>}
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-soft">VAR Report</div>
        <p className="mb-3 text-xs text-ink-soft">Availability applies to everyone, instantly.</p>

        <div className="mb-3 space-y-2">
          <Toggle
            label="Show in feed"
            hint="The VAR Report card on the Picks page"
            checked={varFlags?.visible ?? false}
            disabled={varFlags === null || varFlagsSaving}
            onChange={(v) => toggleVarFlag("visible", v)}
          />
          <Toggle
            label="Auto popup"
            hint={`"Your report is ready" one-time popup`}
            checked={varFlags?.popup ?? false}
            disabled={varFlags === null || varFlagsSaving}
            onChange={(v) => toggleVarFlag("popup", v)}
          />
          <Toggle
            label="Finale takeover"
            hint={`Replace Picks with "That's all Folks!" + VAR prompt`}
            checked={varFlags?.finale ?? false}
            disabled={varFlags === null || varFlagsSaving}
            onChange={(v) => toggleVarFlag("finale", v)}
          />
        </div>

        <p className="mb-2 text-xs text-ink-soft">
          Preview bypasses these flags — {selectedPlayer ? selectedPlayer.display_name : "you"} (or pick a player below).
        </p>
        <button
          onClick={openVarPreview}
          disabled={varLoading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--gold)] py-3 font-semibold text-neutral-900 disabled:opacity-50"
        >
          <Clapperboard className="h-4 w-4" />
          {varLoading ? "Building…" : "Preview VAR Report"}
        </button>
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">Player activity</div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <StatTile
            icon={<Smartphone className="h-4 w-4" />}
            label="Installed PWA"
            value={`${stats.filter((s) => s.pwa_installed_at).length}/${stats.length}`}
          />
          <StatTile
            icon={<Bell className="h-4 w-4" />}
            label="Push on"
            value={`${pushPlayerIds.size}/${stats.length}`}
            sub={`${pushSubCount} devices`}
          />
          <StatTile
            icon={<Clock className="h-4 w-4" />}
            label="Active 24h"
            value={`${stats.filter((s) => s.last_open_at && Date.now() - new Date(s.last_open_at).getTime() < 86_400_000).length}`}
          />
          <StatTile
            icon={<Clapperboard className="h-4 w-4" />}
            label="VAR opened"
            value={`${varStats?.uniqueOpeners ?? 0}/${stats.length}`}
            sub="people"
          />
          <StatTile
            icon={<Eye className="h-4 w-4" />}
            label="VAR watches"
            value={`${varStats?.totalViews ?? 0}`}
            sub="total"
          />
        </div>
        <div className="divide-y divide-border">
          {[...stats]
            .sort((a, b) => {
              const at = a.last_open_at ? new Date(a.last_open_at).getTime() : 0;
              const bt = b.last_open_at ? new Date(b.last_open_at).getTime() : 0;
              return bt - at;
            })
            .map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="text-lg">{p.avatar ?? "👤"}</span>
                <span className="flex-1 truncate font-semibold">{p.display_name}</span>
                {p.pwa_installed_at && (
                  <span title={`Installed ${new Date(p.pwa_installed_at).toLocaleString()}`} className="text-primary">
                    <Smartphone className="h-3.5 w-3.5" />
                  </span>
                )}
                {pushPlayerIds.has(p.id) && (
                  <span title="Push enabled" className="text-accent">
                    <Bell className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="tabular-nums text-xs text-ink-soft">{formatLastOpen(p.last_open_at)}</span>
              </div>
            ))}
        </div>
      </section>



      <section className="mb-5">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">Edit a player's picks</div>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base"
        >
          <option value="">— Choose player —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.avatar ? `${p.avatar} ` : ""}
              {p.display_name}
            </option>
          ))}
        </select>
      </section>

      {selectedPlayer && (
        <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
            Overall champion pick
          </div>
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="text-2xl">{flagFromCode(resolveTeamCode(champion?.team_code, champion?.team) || "")}</span>
            <span className="font-semibold">{champion?.team ?? "— None —"}</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={championDraft}
              onChange={(e) => setChampionDraft(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">— Choose team —</option>
              {teamOptions.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={saveChampion}
              disabled={championSaving || !championDraft || championDraft === champion?.team}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {championSaving ? "Saving…" : championSavedAt && Date.now() - championSavedAt < 1500 ? "Saved" : champion ? "Update" : "Create"}
            </button>
            {champion && (
              <button
                onClick={removeChampion}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-accent"
                aria-label="Delete champion pick"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      )}

      {selectedPlayer && (
        <section className="space-y-4">
          {Array.from(grouped.entries()).map(([day, list]) => (
            <div key={day}>
              <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-soft">{day}</h3>
              <div className="space-y-2">
                {list.map((m) => {
                  const d = drafts[m.id] ?? { home: 0, away: 0, dirty: false };
                  const hasPred = !!preds[m.id];
                  const hc = resolveTeamCode(m.home_code, m.home_team) || "";
                  const ac = resolveTeamCode(m.away_code, m.away_team) || "";
                  const finished = m.status === "FINISHED";
                  return (
                    <div key={m.id} className="rounded-2xl border border-border bg-surface p-3">
                      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-soft">
                        <span>
                          {m.stage ?? ""}
                          {m.group_name ? ` · Group ${m.group_name}` : ""}
                        </span>
                        <span>
                          {m.status}
                          {finished ? ` · ${m.home_score}-${m.away_score}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="text-xl">{flagFromCode(hc)}</span>
                          <span className="truncate text-sm font-semibold">{m.home_team}</span>
                        </div>
                        <NumInput value={d.home} onChange={(v) => setDraft(m.id, { home: v, away: d.away })} />
                        <span className="text-ink-soft">–</span>
                        <NumInput value={d.away} onChange={(v) => setDraft(m.id, { home: d.home, away: v })} />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="text-xl">{flagFromCode(ac)}</span>
                          <span className="truncate text-sm font-semibold">{m.away_team}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => save(m.id)}
                          disabled={!d.dirty || d.saving}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {d.saving ? "Saving…" : d.saved && Date.now() - d.saved < 1500 ? "Saved" : hasPred ? "Update" : "Create"}
                        </button>
                        {hasPred && (
                          <button
                            onClick={() => remove(m.id)}
                            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-accent"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {varReport && <VarReportStory report={varReport} onClose={() => setVarReport(null)} />}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="truncate text-xs text-ink-soft">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
      className="w-12 rounded-lg border border-border bg-surface py-1.5 text-center text-base font-bold tabular-nums outline-none focus:border-primary"
    />
  );
}

function StatTile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-soft">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-ink-soft">{sub}</div>}
    </div>
  );
}

function formatLastOpen(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
