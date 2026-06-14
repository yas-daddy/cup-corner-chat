import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import { useI18n } from "@/lib/i18n";
import type { Match } from "@/lib/types";

const LOCK_AT = new Date("2026-06-20T00:00:00Z").getTime();
const DISMISS_KEY = "champion_prompt_dismissed_at";
const DISMISS_MS = 1000 * 60 * 60 * 24; // re-prompt after 24h

export function ChampionPromptModal({ playerId }: { playerId: string }) {
  const { t, tc, dir } = useI18n();
  const [show, setShow] = useState(false);
  const [teams, setTeams] = useState<{ name: string; code: string }[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Date.now() >= LOCK_AT) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return;

    void (async () => {
      const { data: cp } = await supabase
        .from("champion_predictions")
        .select("player_id")
        .eq("player_id", playerId)
        .maybeSingle();
      if (cp) return;
      const { data: ms } = await supabase
        .from("matches")
        .select("home_team,away_team,home_code,away_code");
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
      setShow(true);
    })();
  }, [playerId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((tm) => tm.name.toLowerCase().includes(q));
  }, [teams, query]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  async function choose(name: string, code: string) {
    if (saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("champion_predictions")
      .upsert(
        { player_id: playerId, team: name, team_code: code || null },
        { onConflict: "player_id" },
      );
    setSaving(false);
    if (!error) {
      localStorage.removeItem(DISMISS_KEY);
      setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl" dir={dir}>
        <div className="flex items-start gap-3 border-b border-border p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--gold)]/20 text-[color:var(--gold)]">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">{t("champion_title")}</h2>
            <p className="text-xs text-ink-soft">{t("champion_sub")}</p>
          </div>
          <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-1 text-[10px] font-bold text-[color:var(--gold)]">
            +25
          </span>
        </div>
        <div className="px-4 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_team")}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {filtered.map((tm) => (
            <li key={tm.name}>
              <button
                type="button"
                disabled={saving}
                onClick={() => choose(tm.name, tm.code)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-border/40"
                dir={dir}
              >
                <span className="text-2xl">{flagFromCode(tm.code)}</span>
                <span className="flex-1 text-sm font-semibold">{tc(tm.name)}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-ink-soft">{t("no_results")}</li>
          )}
        </ul>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-border/40"
          >
            {t("maybe_later") ?? "Maybe later"}
          </button>
        </div>
      </div>
    </div>
  );
}
