import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/AvatarPicker";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentThread } from "@/components/CommentThread";
import { useComments, type FeedActivity } from "@/lib/social";
import { useI18n } from "@/lib/i18n";
import { flagFromCode } from "@/lib/flags";
import { codeForTeam } from "@/lib/teams";
import type { Match } from "@/lib/types";
import type { Player } from "@/lib/identity";

type Props = {
  activity: FeedActivity;
  actor: Player | null;
  match: Match | null;
  currentPlayerId: string | null;
};

export function FeedCard({ activity, actor, match, currentPlayerId }: Props) {
  const { t, tc, n, dir } = useI18n();
  const [showComments, setShowComments] = useState(false);
  const { comments } = useComments("activity", activity.id);

  const hc = match?.home_code || (match ? codeForTeam(match.home_team) : "");
  const ac = match?.away_code || (match ? codeForTeam(match.away_team) : "");

  const isPoints = activity.kind === "points_awarded";
  const pts = activity.points ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3" dir={dir}>
        <Link to="/players/$playerId" params={{ playerId: activity.actor_id }}>
          <Avatar avatar={actor?.avatar ?? null} name={actor?.display_name ?? "?"} size={40} className="border border-border text-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/players/$playerId"
            params={{ playerId: activity.actor_id }}
            className="block truncate text-sm font-bold"
          >
            {actor?.display_name ?? "…"}
          </Link>
          <p className="truncate text-xs text-ink-soft">
            {activity.kind === "prediction_created" && t("activity_predicted")}
            {activity.kind === "prediction_updated" && t("activity_updated_pick")}
            {activity.kind === "points_awarded" &&
              (pts === 8 ? t("activity_exact_score") : pts === 3 ? t("activity_correct_result") : t("activity_no_points"))}
            {" · "}
            {relTime(activity.created_at, n)}
          </p>
        </div>
        {isPoints && (
          pts === 8 ? (
            <span className="rounded-full bg-[color:var(--gold)]/15 px-2 py-1 text-xs font-bold text-[color:var(--gold)]">+{n(8)} ⭐</span>
          ) : pts === 3 ? (
            <span className="rounded-full bg-success/15 px-2 py-1 text-xs font-bold text-success">+{n(3)}</span>
          ) : (
            <span className="rounded-full bg-surface px-2 py-1 text-xs text-ink-soft">+{n(0)}</span>
          )
        )}
      </div>

      <Link
        to="/matches/$matchId"
        params={{ matchId: activity.match_id }}
        className="mt-3 block rounded-xl border border-border bg-white px-3 py-2"
      >
        {match ? (
          <div className="flex items-center justify-between gap-2" dir={dir}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="text-lg">{flagFromCode(hc)}</span>
              <span className="truncate text-sm font-semibold">{tc(match.home_team)}</span>
            </div>
            <div className="flex items-center gap-2">
              {isPoints ? (
                <>
                  <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
                    {n(activity.home_score ?? 0)} - {n(activity.away_score ?? 0)}
                  </span>
                  <span className="text-[10px] text-ink-soft">{t("final")}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums border border-border">
                    {n(activity.pred_home ?? 0)} - {n(activity.pred_away ?? 0)}
                  </span>
                </>
              ) : (
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tabular-nums border border-border">
                  {n(activity.pred_home ?? 0)} - {n(activity.pred_away ?? 0)}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <span className="truncate text-sm font-semibold">{tc(match.away_team)}</span>
              <span className="text-lg">{flagFromCode(ac)}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-ink-soft">{t("loading")}</span>
        )}
      </Link>

      <ReactionBar
        targetType="activity"
        targetId={activity.id}
        playerId={currentPlayerId}
        commentCount={comments.length}
        onCommentClick={() => setShowComments((v) => !v)}
      />

      {showComments && (
        <div className="mt-3 border-t border-border pt-3">
          <CommentThread
            targetType="activity"
            targetId={activity.id}
            currentPlayerId={currentPlayerId}
          />
        </div>
      )}
    </div>
  );
}

function relTime(iso: string, n: (v: string | number) => string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${n(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${n(h)}h`;
  return `${n(Math.floor(h / 24))}d`;
}
