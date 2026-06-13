import { useEffect, useMemo, useState } from "react";
import { Trophy, Lock, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import { useI18n } from "@/lib/i18n";
import type { Match } from "@/lib/types";

type ChampionPrediction = {
  player_id: string;
  team: string;
  team_code: string | null;
  created_at: string;
  updated_at: string;
};

const LOCK_AT = new Date("2026-06-20T00:00:00Z").getTime();

export function ChampionPickCard({ playerId }: { playerId: string }) {
  const { t, tc, dir } = useI18n();
  const [pick, setPick] = useState<ChampionPrediction | null>(null);
  const [teams, setTeams] = useState<{ name: string; code: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const locked = Date.now() >= LOCK_AT;

  useEffect(() => {
    void (async () => {
      const [{ data: cp }, { data: ms }] = await Promise.all([
        supabase.from("champion_predictions").select("*").eq("player_id", playerId).maybeSingle(),
        supabase.from("matches").select("home_team,away_team,home_code,away_code"),
      ]);
      if (cp) setPick(cp as ChampionPrediction);
      const set = new Map<string, string>();
      ((ms as Match[] | null) ?? []).forEach((m) => {
        if (m.home_team) set.set(m.home_team, m.home_code || codeForTeam(m.home_team) || "");
        if (m.away_team) set.set(m.away_team, m.away_code || codeForTeam(m.away_team) || "");
      });
      setTeams(
        Array.from(set.entries())
          .map(([name, code]) => ({ name, code }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
  }, [playerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((tm) => tm.name.toLowerCase().includes(q));
  }, [teams, query]);

  async function choose(name: string, code: string) {
    if (locked || saving) return;
    setSaving(true);
    const payload = { player_id: playerId, team: name, team_code: code || null };
    const { data, error } = await supabase
      .from("champion_predictions")
      .upsert(payload, { onConflict: "player_id" })
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      setPick(data as ChampionPrediction);
      setOpen(false);
      setQuery("");
    }
  }

  const lockLabel = locked ? t("champion_locked") : formatLockCountdown(LOCK_AT, t);

  return (
    <div className="mb-4 rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-[color:var(--gold)]/10 via-surface to-surface p-4">
      <div className="flex items-start gap-3" dir={dir}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--gold)]">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("champion_title")}</p>
          <p className="text-xs text-ink-soft">{t("champion_sub")}</p>
        </div>
        <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-1 text-[10px] font-bold text-[color:var(--gold)]">
          +25
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3" dir={dir}>
        {pick ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl">{flagFromCode(pick.team_code)}</span>
            <span className="truncate text-base font-bold">{tc(pick.team)}</span>
          </div>
        ) : (
          <span className="text-sm text-ink-soft">{t("champion_no_pick")}</span>
        )}

        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <Lock className="h-3.5 w-3.5" /> {t("locked")}
          </span>
        ) : (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
              >
                <Pencil className="h-3.5 w-3.5" /> {pick ? t("change") : t("pick_champion")}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85dvh] p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle>{t("pick_champion")}</SheetTitle>
              </SheetHeader>
              <div className="px-4 py-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("search_team")}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-ink"
                />
              </div>
              <ul className="max-h-[calc(85dvh-110px)] overflow-y-auto divide-y divide-border">
                {filtered.map((tm) => {
                  const selected = pick?.team === tm.name;
                  return (
                    <li key={tm.name}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => choose(tm.name, tm.code)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface ${selected ? "bg-[color:var(--gold)]/10" : ""}`}
                        dir={dir}
                      >
                        <span className="text-2xl">{flagFromCode(tm.code)}</span>
                        <span className="flex-1 text-sm font-semibold">{tc(tm.name)}</span>
                        {selected && (
                          <span className="text-xs font-bold text-[color:var(--gold)]">★</span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-ink-soft">{t("no_results")}</li>
                )}
              </ul>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">{lockLabel}</p>
    </div>
  );
}

function formatLockCountdown(lockAt: number, t: (k: string) => string) {
  const ms = lockAt - Date.now();
  if (ms <= 0) return t("champion_locked");
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${t("champion_locks_in")} ${days}${t("d_short")}`;
  const hours = Math.max(1, Math.floor(ms / (1000 * 60 * 60)));
  return `${t("champion_locks_in")} ${hours}${t("h_short")}`;
}
