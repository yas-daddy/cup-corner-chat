import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { Avatar } from "@/components/AvatarPicker";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import type { Match, PredictionPointRow } from "@/lib/types";
import { ChampionPickCard } from "@/components/ChampionPickCard";


export const Route = createFileRoute("/my-picks")({
  head: () => ({ meta: [{ title: "WC26 Predictor — My Picks" }] }),
  component: MyPicksPage,
});

function MyPicksPage() {
  const { t, tc, n, dir } = useI18n();
  const { player, setPlayer, loading } = useCurrentPlayer();
  const [rows, setRows] = useState<PredictionPointRow[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [summary, setSummary] = useState({ total: 0, correct: 0, exact: 0 });
  const [resultsOpen, setResultsOpen] = useState(true);


  useEffect(() => {
    if (!player) return;
    void (async () => {
      const { data } = await supabase
        .from("prediction_points")
        .select("*")
        .eq("player_id", player.id);
      const list = (data as PredictionPointRow[] | null) ?? [];
      setRows(list);
      setSummary({
        total: list.reduce((a, r) => a + (r.points || 0), 0),
        correct: list.filter((r) => r.is_correct_result).length,
        exact: list.filter((r) => r.is_exact).length,
      });
      const ids = list.map((r) => r.match_id);
      if (ids.length) {
        const { data: ms } = await supabase.from("matches").select("*").in("id", ids);
        const map: Record<string, Match> = {};
        (ms as Match[] | null)?.forEach((m) => (map[m.id] = m));
        setMatches(map);
      }
    })();
  }, [player?.id]);

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const upcoming: PredictionPointRow[] = [];
  const results: PredictionPointRow[] = [];
  for (const r of rows) {
    const m = matches[r.match_id];
    if (!m) continue;
    if (m.status === "FINISHED") {
      const k = m.kickoff_at ? new Date(m.kickoff_at).getTime() : 0;
      if (k >= cutoff) results.push(r);
    } else {
      upcoming.push(r);
    }
  }
  const sortByKickoff = (a: PredictionPointRow, b: PredictionPointRow) =>
    (matches[b.match_id]?.kickoff_at ?? "").localeCompare(matches[a.match_id]?.kickoff_at ?? "");
  upcoming.sort(sortByKickoff);
  results.sort(sortByKickoff);





  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar avatar={player.avatar} name={player.display_name} size={48} className="border border-border text-2xl" />
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-soft">{t("my_picks")}</p>
            <h1 className="text-xl font-extrabold">{player.display_name}</h1>
          </div>
        </div>

        <Link to="/settings" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-ink-soft">
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={t("total_points")} value={n(summary.total)} tone="gold" />
        <Stat label={t("correct_results")} value={n(summary.correct)} tone="success" />
        <Stat label={t("exact_scores")} value={n(summary.exact)} tone="primary" />
      </div>

      <ChampionPickCard playerId={player.id} />


      {upcoming.length === 0 && results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_picks")}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <ul className="space-y-2">
              {upcoming.map((r) => (
                <PickRow key={r.id} r={r} m={matches[r.match_id]} t={t} tc={tc} n={n} dir={dir} />
              ))}
            </ul>
          )}

          {results.length > 0 && (
            <div className={upcoming.length > 0 ? "mt-4" : ""}>
              <button
                type="button"
                onClick={() => setResultsOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
              >
                <span>
                  {t("results")} <span className="text-ink-soft">({n(results.length)})</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-ink-soft transition-transform ${resultsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {resultsOpen && (
                <ul className="mt-2 space-y-2">
                  {results.map((r) => (
                    <PickRow key={r.id} r={r} m={matches[r.match_id]} t={t} tc={tc} n={n} dir={dir} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>

  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "gold" | "success" | "primary" }) {
  const color = tone === "gold" ? "text-[color:var(--gold)]" : tone === "success" ? "text-success" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3 text-center">
      <p className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-soft">{label}</p>
    </div>
  );
}

function PickRow({
  r,
  m,
  t,
  tc,
  n,
  dir,
}: {
  r: PredictionPointRow;
  m: Match | undefined;
  t: (k: string) => string;
  tc: (s: string) => string;
  n: (v: number) => string;
  dir: "ltr" | "rtl";
}) {
  if (!m) return null;
  const hc = m.home_code || codeForTeam(m.home_team);
  const ac = m.away_code || codeForTeam(m.away_team);
  const finished = m.status === "FINISHED";
  return (
    <li>
      <div
        className={`block rounded-2xl border bg-surface px-4 py-3 ${r.is_exact ? "border-[color:var(--gold)] ring-2 ring-[color:var(--gold)]/20" : r.is_correct_result ? "border-success/50" : "border-border"}`}
      >
        <div className="flex items-center justify-between text-xs text-ink-soft" dir={dir}>
          <span className="truncate">
            {flagFromCode(hc)} {tc(m.home_team)} {t("vs")} {tc(m.away_team)} {flagFromCode(ac)}
          </span>
          {finished && (
            <span className="font-bold text-ink">
              {n(m.home_score ?? 0)}-{n(m.away_score ?? 0)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between" dir={dir}>
          <span className="text-sm text-ink-soft">
            {t("predicted")}: <strong className="text-ink">{n(r.pred_home)}-{n(r.pred_away)}</strong>
          </span>
          <span className="flex items-center gap-1 text-sm font-bold">
            {r.is_exact ? (
              <span className="anim-pop rounded-full bg-[color:var(--gold)]/15 px-2 py-1 text-[color:var(--gold)]">
                +{n(8)} ⭐
              </span>
            ) : r.is_correct_result ? (
              <span className="rounded-full bg-success/15 px-2 py-1 text-success">
                <Check className="mr-1 inline h-3 w-3" />+{n(3)}
              </span>
            ) : finished ? (
              <span className="text-ink-soft">+{n(0)}</span>
            ) : (
              <span className="text-ink-soft">…</span>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}

