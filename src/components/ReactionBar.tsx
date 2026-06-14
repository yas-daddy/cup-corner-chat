import { ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { useReactions } from "@/lib/social";
import { useI18n } from "@/lib/i18n";

type Props = {
  targetType: "activity" | "prediction";
  targetId: string;
  playerId: string | null;
  commentCount?: number;
  onCommentClick?: () => void;
  compact?: boolean;
};

export function ReactionBar({ targetType, targetId, playerId, commentCount, onCommentClick, compact }: Props) {
  const { n } = useI18n();
  const { likes, dislikes, mine, toggle } = useReactions(targetType, targetId, playerId);
  const btn = "relative z-10 flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft active:opacity-80";
  const active = "text-primary border-primary/40 bg-primary/5";
  const activeDown = "text-accent border-accent/40 bg-accent/5";
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "mt-2"}`}>
      <button
        type="button"
        aria-label="like"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(1); }}
        className={`${btn} ${mine === 1 ? active : ""}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        <span className="tabular-nums">{n(likes)}</span>
      </button>
      <button
        type="button"
        aria-label="dislike"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void toggle(-1); }}
        className={`${btn} ${mine === -1 ? activeDown : ""}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        <span className="tabular-nums">{n(dislikes)}</span>
      </button>
      {onCommentClick && (
        <button
          type="button"
          aria-label="comments"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCommentClick(); }}
          className={btn}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span className="tabular-nums">{n(commentCount ?? 0)}</span>
        </button>
      )}
    </div>
  );
}
