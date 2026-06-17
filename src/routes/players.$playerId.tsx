import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Check, Trophy, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { resolveTeamCode } from "@/lib/teams";
import { Avatar } from "@/components/AvatarPicker";
import type { Match, PredictionPointRow } from "@/lib/types";
import type { Player } from "@/lib/identity";

const CHAMPION_LOCK_AT = new Date("2026-06-20T00:00:00Z").getTime();
type ChampionPick = { team: string; team_code: string | null };


export const Route = createFileRoute("/players/$playerId")({
  head: () => ({ meta: [{ title: "WC26 Predictor — Player" }, { name: "robots", content: "noindex" }] }),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { playerId } = Route.useParams();
  const { t, tc, n, dir } = useI18n();
  const [player, setPlayer] = useState<Player | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [rows, setRows] = useState<PredictionPointRow[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [summary, setSummary] = useState({ total: 0, correct: 0, exact: 0 });
  const [champion, setChampion] = useState<ChampionPick | null>(null);
  const [bank, setBank] = useState<{ balance: number; wins: number; losses: number } | null>(null);


  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: p } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
      if (!active) return;
      if (!p) {
        setNotFound(true);
        return;
      }
      setPlayer(p as Player);
      void (supabase as unknown as { from: (t: string) => any })
        .from("bank_leaderboard")
        .select("balance, wins, losses")
        .eq("player_id", playerId)
        .maybeSingle()
        .then(({ data }: { data: { balance: number; wins: number; losses: number } | null }) => {
          if (active && data) setBank(data);
        });
      void supabase
        .from("champion_predictions")
        .select("team,team_code")
        .eq("player_id", playerId)
        .maybeSingle()
        .then(({ data }) => {
          if (active && data) setChampion(data as ChampionPick);
        });
      const { data } = await supabase.from("prediction_points").select("*").eq("player_id", playerId);

      const list = (data as PredictionPointRow[] | null) ?? [];
      if (!active) return;
      setRows(list);
      setSummary({
        total: list.reduce((a, r) => a + (r.points || 0), 0),
        correct: list.filter((r) => r.is_correct_result).length,
        exact: list.filter((r) => r.is_exact).length,
      });
      const ids = list.map((r) => r.match_id);
      if (ids.length) {
        const { data: ms } = await supabase.from("matches").select("*").in("id", ids);
        if (!active) return;
        const map: Record<string, Match> = {};
        (ms as Match[] | null)?.forEach((m) => (map[m.id] = m));
        setMatches(map);
      }
    })();
    return () => {
      active = false;
    };
  }, [playerId]);

  if (notFound) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-soft">
        Player not found.
      </div>
    );
  }

  if (!player) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const ma = matches[a.match_id]?.kickoff_at ?? "";
    const mb = matches[b.match_id]?.kickoff_at ?? "";
    return mb.localeCompare(ma);
  });

  return (
    <div className="px-4 pt-6 pb-10">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/leaderboard"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Avatar avatar={player.avatar} name={player.display_name} size={48} className="border border-border text-2xl" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("player")}</p>
          <h1 className="truncate text-xl font-extrabold">{player.display_name}</h1>
        </div>
      </header>

      {bank && (
        <div className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("balance") ?? "Balance"}</p>
          <p className="text-3xl font-extrabold tabular-nums text-[color:var(--gold)]">${n(bank.balance)}</p>
          <p className="mt-1 text-xs text-ink-soft tabular-nums">
            {n(bank.wins)}W · {n(bank.losses)}L
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={t("total_points")} value={n(summary.total)} tone="gold" />
        <Stat label={t("correct_results")} value={n(summary.correct)} tone="success" />
        <Stat label={t("exact_scores")} value={n(summary.exact)} tone="primary" />
      </div>

      <ChampionRow champion={champion} />



      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_picks")}
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => {
            const m = matches[r.match_id];
            if (!m) return null;
            const hc = resolveTeamCode(m.home_code, m.home_team) || "";
            const ac = resolveTeamCode(m.away_code, m.away_team) || "";
            const finished = m.status === "FINISHED";
            return (
              <li
                key={r.id}
                className={`rounded-2xl border bg-surface px-4 py-3 ${r.is_exact ? "border-[color:var(--gold)] ring-2 ring-[color:var(--gold)]/20" : r.is_correct_result ? "border-success/50" : "border-border"}`}
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
                        +{n(r.points)} ⭐
                      </span>
                    ) : (r.points ?? 0) > 0 ? (
                      <span className="rounded-full bg-success/15 px-2 py-1 text-success">
                        <Check className="mr-1 inline h-3 w-3" />+{n(r.points)}
                      </span>
                    ) : finished ? (
                      <span className="text-ink-soft">+{n(0)}</span>
                    ) : (
                      <span className="text-ink-soft">…</span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
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

function ChampionRow({ champion }: { champion: ChampionPick | null }) {
  const { t, tc } = useI18n();
  const revealed = Date.now() >= CHAMPION_LOCK_AT;
  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)]">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("champion_title")}</p>
          {!champion ? (
            <p className="text-sm text-ink-soft">{t("champion_no_pick")}</p>
          ) : revealed ? (
            <p className="truncate text-base font-bold">
              {flagFromCode(resolveTeamCode(champion.team_code, champion.team) || "")} {tc(champion.team)}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <Lock className="h-3.5 w-3.5" /> {t("champion_hidden_until_lock")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

