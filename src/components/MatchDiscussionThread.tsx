import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { addComment, deleteComment, type Comment } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/AvatarPicker";
import { useI18n } from "@/lib/i18n";
import { Send, Trash2 } from "lucide-react";
import { isKarim } from "@/lib/bot";
import { AiTag } from "@/components/AiTag";
import type { Player } from "@/lib/identity";

type Props = {
  matchId: string;
  currentPlayerId: string | null;
};

type Row = Comment & { _ownerId?: string | null };

export function MatchDiscussionThread({ matchId, currentPlayerId }: Props) {
  const { t, n, dir } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [matchRes, predRes] = await Promise.all([
      supabase
        .from("comments")
        .select("*")
        .eq("target_type", "match")
        .eq("target_id", matchId),
      supabase
        .from("comments")
        .select("*")
        .eq("target_type", "prediction")
        .like("target_id", `%::${matchId}`),
    ]);
    const list: Row[] = [];
    ((matchRes.data as Comment[] | null) ?? []).forEach((c) =>
      list.push({ ...c, _ownerId: null }),
    );
    ((predRes.data as Comment[] | null) ?? []).forEach((c) => {
      const sep = c.target_id.indexOf("::");
      const ownerId = sep > 0 ? c.target_id.slice(0, sep) : null;
      list.push({ ...c, _ownerId: ownerId });
    });
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setRows(list);
  }

  useEffect(() => {
    let active = true;
    void load();
    const ch = supabase
      .channel(`match_discussion:${matchId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => { if (active) void load(); },
      )
      .subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    const need = new Set<string>();
    rows.forEach((r) => {
      if (!players[r.player_id]) need.add(r.player_id);
      if (r._ownerId && !players[r._ownerId]) need.add(r._ownerId);
    });
    if (need.size === 0) return;
    void supabase.from("players").select("*").in("id", Array.from(need)).then(({ data }) => {
      setPlayers((prev) => {
        const next = { ...prev };
        (data as Player[] | null)?.forEach((p) => (next[p.id] = p));
        return next;
      });
    });
  }, [rows, players]);

  async function submit() {
    if (!currentPlayerId || busy) return;
    const txt = body.trim();
    if (!txt) return;
    setBusy(true);
    const saved = await addComment("match", matchId, currentPlayerId, txt);
    if (saved) {
      setRows((cur) => [{ ...saved, _ownerId: null }, ...cur]);
      setBody("");
    }
    setBusy(false);
  }

  const items = useMemo(() => rows, [rows]);

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
      {items.length === 0 ? (
        <p className="px-1 text-xs text-ink-soft">{t("no_comments")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const author = players[c.player_id];
            const owner = c._ownerId ? players[c._ownerId] : null;
            return (
              <li key={c.id} className="rounded-2xl border border-border bg-surface px-3 py-2" dir={dir}>
                <div className="flex items-start gap-2">
                  <Avatar avatar={author?.avatar ?? null} name={author?.display_name ?? "?"} size={28} className="border border-border text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold">
                        <span className="truncate">{author?.display_name ?? "…"}</span>
                        {isKarim(c.player_id) && <AiTag />}
                      </span>
                      <span className="text-[10px] text-ink-soft">{relativeTime(c.created_at, n)}</span>
                    </div>
                    {owner && c._ownerId && (
                      <Link
                        to="/players/$playerId"
                        params={{ playerId: c._ownerId }}
                        className="text-[10px] text-ink-soft underline-offset-2 hover:underline"
                      >
                        {t("on_pick_of")} {owner.display_name}
                      </Link>
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                  </div>
                  {currentPlayerId === c.player_id && (
                    <button
                      type="button"
                      aria-label="delete"
                      onClick={() => {
                        setRows((cur) => cur.filter((r) => r.id !== c.id));
                        void deleteComment(c.id);
                      }}
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
    </div>
  );
}

function relativeTime(iso: string, n: (v: string | number) => string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${n(s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${n(m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${n(h)}h`;
  return `${n(Math.floor(h / 24))}d`;
}
