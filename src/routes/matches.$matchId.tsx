import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Check, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import { Avatar } from "@/components/AvatarPicker";
import { useCurrentPlayer } from "@/lib/identity";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentThread } from "@/components/CommentThread";
import { MatchDiscussionThread } from "@/components/MatchDiscussionThread";
import { predictionTargetId, useComments } from "@/lib/social";
import type { Match, Prediction, PredictionPointRow } from "@/lib/types";
import type { Player } from "@/lib/identity";

export const Route = createFileRoute("/matches/$matchId")({
  head: () => ({ meta: [{ title: "WC26 Predictor — Match" }, { name: "robots", content: "noindex" }] }),
  component: MatchDetailPage,
});

type Row = {
  player: Player;
  pred_home: number;
  pred_away: number;
  points: number;
  is_exact: boolean;
  is_correct_result: boolean;
};

function projectPoints(ph: number, pa: number, lh: number, la: number) {
  if (ph === lh && pa === la) return 8;
  if (Math.sign(ph - pa) === Math.sign(lh - la)) return 3;
  return 0;
}


function MatchDetailPage() {
  const { matchId } = Route.useParams();
  const { t, tc, n, dir } = useI18n();
  const { player: me } = useCurrentPlayer();
  const [match, setMatch] = useState<Match | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (!active) return;
      if (!m) { setNotFound(true); return; }
      setMatch(m as Match);
      const finished = (m as Match).status === "FINISHED";
      const locked = new Date((m as Match).kickoff_at).getTime() <= Date.now() || (m as Match).status !== "SCHEDULED";

      if (finished) {
        const { data: pts } = await supabase
          .from("prediction_points")
          .select("*")
          .eq("match_id", matchId);
        const list = (pts as PredictionPointRow[] | null) ?? [];
        const ids = list.map((r) => r.player_id);
        const { data: players } = ids.length
          ? await supabase.from("players").select("*").in("id", ids)
          : { data: [] as Player[] };
        const pmap: Record<string, Player> = {};
        (players as Player[] | null)?.forEach((p) => (pmap[p.id] = p));
        if (!active) return;
        setRows(
          list
            .filter((r) => pmap[r.player_id])
            .map((r) => ({
              player: pmap[r.player_id],
              pred_home: r.pred_home,
              pred_away: r.pred_away,
              points: r.points || 0,
              is_exact: r.is_exact,
              is_correct_result: r.is_correct_result,
            }))
            .sort((a, b) => b.points - a.points),
        );
      } else if (locked) {
        const { data: preds } = await supabase
          .from("predictions")
          .select("*")
          .eq("match_id", matchId);
        const list = (preds as Prediction[] | null) ?? [];
        const ids = list.map((p) => p.player_id);
        const { data: players } = ids.length
          ? await supabase.from("players").select("*").in("id", ids)
          : { data: [] as Player[] };
        const pmap: Record<string, Player> = {};
        (players as Player[] | null)?.forEach((p) => (pmap[p.id] = p));
        if (!active) return;
        setRows(
          list
            .filter((p) => pmap[p.player_id])
            .map((p) => ({
              player: pmap[p.player_id],
              pred_home: p.pred_home,
              pred_away: p.pred_away,
              points: 0,
              is_exact: false,
              is_correct_result: false,
            })),
        );
      } else {
        // Upcoming — show every player's pick
        const { data: preds } = await supabase
          .from("predictions")
          .select("*")
          .eq("match_id", matchId);
        const list = (preds as Prediction[] | null) ?? [];
        const ids = list.map((p) => p.player_id);
        const { data: players } = ids.length
          ? await supabase.from("players").select("*").in("id", ids)
          : { data: [] as Player[] };
        const pmap: Record<string, Player> = {};
        (players as Player[] | null)?.forEach((p) => (pmap[p.id] = p));
        if (!active) return;
        setRows(
          list
            .filter((p) => pmap[p.player_id])
            .map((p) => ({
              player: pmap[p.player_id],
              pred_home: p.pred_home,
              pred_away: p.pred_away,
              points: 0,
              is_exact: false,
              is_correct_result: false,
            })),
        );
      }
    })();
    return () => { active = false; };
  }, [matchId, me?.id]);

  if (notFound) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">Match not found.</div>;
  }
  if (!match) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }

  const hc = match.home_code || codeForTeam(match.home_team);
  const ac = match.away_code || codeForTeam(match.away_team);
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const locked = new Date(match.kickoff_at).getTime() <= Date.now() || match.status !== "SCHEDULED";
  const kickoffLabel = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="px-4 pt-6 pb-10">
      {live && (
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-accent">
          {t("live")}
        </h2>
      )}
      <header className="mb-4 flex items-center gap-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("predictions")}</p>
          <h1 className="truncate text-lg font-extrabold">
            {tc(match.home_team)} {t("vs")} {tc(match.away_team)}
          </h1>
        </div>
      </header>

      <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-ink-soft">
          <span>
            {match.stage ? match.stage : ""}
            {match.group_name ? ` · ${t("group")} ${match.group_name}` : ""}
          </span>
          <span>{kickoffLabel}</span>
        </div>
        <div className="flex items-center justify-between" dir={dir}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-2xl">{flagFromCode(hc)}</span>
            <span className="truncate font-semibold">{tc(match.home_team)}</span>
          </div>
          {(finished || (live && match.home_score != null && match.away_score != null)) ? (
            <div className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white tabular-nums">
              {n(match.home_score ?? 0)} - {n(match.away_score ?? 0)}
            </div>
          ) : live ? (
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">{t("live")}</span>
          ) : locked ? (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
              <Lock className="h-3 w-3" /> {t("locked")}
            </span>
          ) : (
            <span className="rounded-full bg-surface px-3 py-1 text-xs text-ink-soft">{t("upcoming")}</span>
          )}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate font-semibold">{tc(match.away_team)}</span>
            <span className="text-2xl">{flagFromCode(ac)}</span>
          </div>
        </div>
      </div>

      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
        {t("predictions")}
      </h2>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {locked ? t("no_picks") : "Other players' predictions appear once the match is locked."}
        </div>
      ) : (
        <ul className="space-y-2">
          {(live && match.home_score != null && match.away_score != null
            ? [...rows].sort((a, b) => {
                const lh = match.home_score!, la = match.away_score!;
                const pa = projectPoints(a.pred_home, a.pred_away, lh, la);
                const pb = projectPoints(b.pred_home, b.pred_away, lh, la);
                if (pa !== pb) return pb - pa;
                const da = Math.abs(a.pred_home - lh) + Math.abs(a.pred_away - la);
                const db = Math.abs(b.pred_home - lh) + Math.abs(b.pred_away - la);
                if (da !== db) return da - db;
                return a.player.display_name.localeCompare(b.player.display_name);
              })
            : rows
          ).map((r) => (
            <PredictionRow
              key={r.player.id}
              row={r}
              matchId={matchId}
              finished={finished}
              liveScore={live && match.home_score != null && match.away_score != null
                ? { home: match.home_score, away: match.away_score }
                : null}
              currentPlayerId={me?.id ?? null}
            />
          ))}
        </ul>
      )}


      <section className="mt-8">
        <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
          {t("match_discussion")}
        </h2>
        <div className="rounded-2xl border border-border bg-surface p-3">
          <MatchDiscussionThread
            matchId={matchId}
            currentPlayerId={me?.id ?? null}
          />
        </div>
      </section>
    </div>
  );
}

function PredictionRow({
  row, matchId, finished, liveScore, currentPlayerId,
}: { row: Row; matchId: string; finished: boolean; liveScore: { home: number; away: number } | null; currentPlayerId: string | null }) {
  const { t, n, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const targetId = predictionTargetId(row.player.id, matchId);
  const { comments } = useComments("prediction", targetId);

  const homeBusted = !!liveScore && liveScore.away > row.pred_away;
  const awayBusted = !!liveScore && liveScore.home > row.pred_home;
  const liveProjected = liveScore ? projectPoints(row.pred_home, row.pred_away, liveScore.home, liveScore.away) : null;

  return (
    <li
      className={`rounded-2xl border bg-surface px-4 py-3 ${
        row.is_exact ? "border-[color:var(--gold)] ring-2 ring-[color:var(--gold)]/20"
        : row.is_correct_result ? "border-success/50"
        : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3" dir={dir}>
        <Link
          to="/players/$playerId"
          params={{ playerId: row.player.id }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar avatar={row.player.avatar} name={row.player.display_name} size={36} className="border border-border text-xl" />
          <span className="truncate font-semibold">
            {row.player.display_name}
            {currentPlayerId === row.player.id && <span className="ml-1 text-xs text-ink-soft">({t("my_picks")})</span>}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold tabular-nums">
            <span className={homeBusted ? "text-destructive" : undefined}>{n(row.pred_home)}</span>
            {" - "}
            <span className={awayBusted ? "text-destructive" : undefined}>{n(row.pred_away)}</span>
          </span>
          {finished ? (
            row.is_exact ? (
              <span className="anim-pop rounded-full bg-[color:var(--gold)]/15 px-2 py-1 text-xs font-bold text-[color:var(--gold)]">
                +{n(8)} ⭐
              </span>
            ) : row.is_correct_result ? (
              <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-bold text-success">
                <Check className="mr-1 inline h-3 w-3" />+{n(3)}
              </span>
            ) : (
              <span className="rounded-full bg-surface px-2 py-1 text-xs text-ink-soft">+{n(0)}</span>
            )
          ) : liveProjected != null ? (
            liveProjected === 8 ? (
              <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-1 text-xs font-bold text-[color:var(--gold)]">
                +{n(8)} ⭐ {t("live")}
              </span>
            ) : liveProjected === 3 ? (
              <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-bold text-success">
                +{n(3)} {t("live")}
              </span>
            ) : (
              <span className="rounded-full bg-surface px-2 py-1 text-xs text-ink-soft">+{n(0)} {t("live")}</span>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end">
        <ReactionBar
          targetType="prediction"
          targetId={targetId}
          playerId={currentPlayerId}
          commentCount={comments.length}
          onCommentClick={() => setOpen((v) => !v)}
          compact
        />
      </div>
      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <CommentThread
            targetType="prediction"
            targetId={targetId}
            currentPlayerId={currentPlayerId}
          />
        </div>
      )}
    </li>
  );
}
