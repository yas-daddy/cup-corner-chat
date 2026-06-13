import { useEffect, useMemo, useState } from "react";
import { addComment, deleteComment, useComments, type TargetType } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/identity";
import { Avatar } from "@/components/AvatarPicker";
import { useI18n } from "@/lib/i18n";
import { Send, Trash2 } from "lucide-react";

type Props = {
  targetType: TargetType;
  targetId: string;
  currentPlayerId: string | null;
  limit?: number;
  emptyHint?: string;
  onCountChange?: (n: number) => void;
};

export function CommentThread({ targetType, targetId, currentPlayerId, limit, emptyHint, onCountChange }: Props) {
  const { t, n, dir } = useI18n();
  const { comments } = useComments(targetType, targetId);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { onCountChange?.(comments.length); }, [comments.length, onCountChange]);

  useEffect(() => {
    const missing = Array.from(new Set(comments.map((c) => c.player_id))).filter((id) => !players[id]);
    if (missing.length === 0) return;
    void supabase.from("players").select("*").in("id", missing).then(({ data }) => {
      const map = { ...players };
      (data as Player[] | null)?.forEach((p) => (map[p.id] = p));
      setPlayers(map);
    });
  }, [comments, players]);

  const shown = useMemo(() => (limit ? comments.slice(0, limit) : comments), [comments, limit]);

  async function submit() {
    if (!currentPlayerId || busy) return;
    const txt = body.trim();
    if (!txt) return;
    setBusy(true);
    await addComment(targetType, targetId, currentPlayerId, txt);
    setBody("");
    setBusy(false);
  }

  return (
    <div className="space-y-2">
      {currentPlayerId && (
        <div className="flex items-center gap-2" dir={dir}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder={t("write_a_comment")}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            className="min-w-0 flex-1 rounded-full border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            disabled={!body.trim() || busy}
            onClick={() => void submit()}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white disabled:opacity-50"
            aria-label="send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-1 text-xs text-ink-soft">{emptyHint ?? t("no_comments")}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => {
            const p = players[c.player_id];
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-surface px-3 py-2" dir={dir}>
                <div className="flex items-start gap-2">
                  <Avatar avatar={p?.avatar ?? null} name={p?.display_name ?? "?"} size={28} className="border border-border text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{p?.display_name ?? "…"}</span>
                      <span className="text-[10px] text-ink-soft">{relativeTime(c.created_at, n)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                  </div>
                  {currentPlayerId === c.player_id && (
                    <button
                      type="button"
                      aria-label="delete"
                      onClick={() => void deleteComment(c.id)}
                      className="text-ink-soft active:text-accent"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {limit && comments.length > limit && (
        <p className="px-1 text-xs text-ink-soft">+{n(comments.length - limit)} {t("more_comments")}</p>
      )}
    </div>
  );
}

function relativeTime(iso: string, n: (v: string | number) => string) {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${n(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${n(h)}h`;
  const days = Math.floor(h / 24);
  return `${n(days)}d`;
}
