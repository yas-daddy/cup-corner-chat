import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer, type Player } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { FeedCard } from "@/components/FeedCard";
import { useI18n } from "@/lib/i18n";
import type { FeedActivity } from "@/lib/social";
import type { Match } from "@/lib/types";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "WC26 Predictor — Feed" }, { name: "robots", content: "noindex" }] }),
  component: FeedPage,
});

const PAGE = 50;

function FeedPage() {
  const { t } = useI18n();
  const { player, loading, setPlayer } = useCurrentPlayer();
  const [items, setItems] = useState<FeedActivity[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("feed_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE);
      if (!active) return;
      const rows = (data as FeedActivity[] | null) ?? [];
      setItems(rows);
      setDone(rows.length < PAGE);
      await hydrate(rows);
    }
    void load();
    const ch = supabase
      .channel("feed_activities_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feed_activities" },
        (payload) => {
          const row = payload.new as FeedActivity;
          setItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev]));
          void hydrate([row]);
        },
      )
      .subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function hydrate(rows: FeedActivity[]) {
    const playerIds = Array.from(new Set(rows.map((r) => r.actor_id))).filter((id) => !players[id]);
    const matchIds = Array.from(new Set(rows.map((r) => r.match_id))).filter((id) => !matches[id]);
    if (playerIds.length) {
      const { data } = await supabase.from("players").select("*").in("id", playerIds);
      setPlayers((prev) => {
        const next = { ...prev };
        (data as Player[] | null)?.forEach((p) => (next[p.id] = p));
        return next;
      });
    }
    if (matchIds.length) {
      const { data } = await supabase.from("matches").select("*").in("id", matchIds);
      setMatches((prev) => {
        const next = { ...prev };
        (data as Match[] | null)?.forEach((m) => (next[m.id] = m));
        return next;
      });
    }
  }

  async function loadMore() {
    if (busy || done || items.length === 0) return;
    setBusy(true);
    const last = items[items.length - 1].created_at;
    const { data } = await supabase
      .from("feed_activities")
      .select("*")
      .lt("created_at", last)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const rows = (data as FeedActivity[] | null) ?? [];
    setItems((prev) => [...prev, ...rows]);
    setDone(rows.length < PAGE);
    await hydrate(rows);
    setBusy(false);
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;

  return (
    <div className="px-4 pt-6 pb-6">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">{t("feed")}</h1>
        <p className="text-xs text-ink-soft">{t("feed_subtitle")}</p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_activity")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <FeedCard
              key={a.id}
              activity={a}
              actor={players[a.actor_id] ?? null}
              match={matches[a.match_id] ?? null}
              currentPlayerId={player.id}
            />
          ))}
        </div>
      )}

      {!done && items.length > 0 && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={busy}
          className="mx-auto mt-4 block rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink-soft disabled:opacity-50"
        >
          {busy ? t("loading") : t("load_more")}
        </button>
      )}
    </div>
  );
}
