import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { MatchCard } from "@/components/MatchCard";
import { useI18n } from "@/lib/i18n";
import type { Match, Prediction } from "@/lib/types";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WC26 Predictor — Picks" },
      { name: "description", content: "Make your World Cup 2026 match predictions." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { player, loading, setPlayer } = useCurrentPlayer();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [preds, setPreds] = useState<Record<string, Prediction>>({});
  const tapTimes = useRef<number[]>([]);


  useEffect(() => {
    void loadMatches();
  }, []);

  useEffect(() => {
    if (!player) return;
    supabase
      .from("predictions")
      .select("*")
      .eq("player_id", player.id)
      .then(({ data }) => {
        const map: Record<string, Prediction> = {};
        (data as Prediction[] | null)?.forEach((p) => (map[p.match_id] = p));
        setPreds(map);
      });
  }, [player?.id]);

  async function loadMatches() {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("kickoff_at", { ascending: true });
    setMatches((data as Match[] | null) ?? []);
  }

  async function refresh() {
    setSyncing(true);
    try {
      await fetch("/api/public/sync-matches", { method: "POST" });
      await loadMatches();
    } finally {
      setSyncing(false);
    }
  }

  const grouped = useMemo(() => {
    const now = Date.now();
    const live: Match[] = [];
    const upcoming: Map<string, Match[]> = new Map();
    const finished: Match[] = [];
    (matches ?? []).forEach((m) => {
      const k = new Date(m.kickoff_at).getTime();
      if (m.status === "LIVE") live.push(m);
      else if (m.status === "FINISHED") finished.push(m);
      else if (k > now - 1000 * 60 * 60 * 2) {
        const day = new Date(m.kickoff_at).toLocaleDateString(lang === "fa" ? "fa-IR" : undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        if (!upcoming.has(day)) upcoming.set(day, []);
        upcoming.get(day)!.push(m);
      } else {
        finished.push(m);
      }
    });
    return { live, upcoming, finished: finished.slice(-6).reverse() };
  }, [matches, lang]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }

  if (!player) {
    return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft">{t("app_name")}</p>
          <h1 className="text-2xl font-extrabold">{t("home")}</h1>
        </div>
        <button
          onClick={refresh}
          disabled={syncing}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink-soft active:opacity-80"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? t("refreshing") : t("refresh")}
        </button>
      </header>

      {matches && matches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_matches")}
        </div>
      )}

      {grouped.live.length > 0 && (
        <Section title={t("live")} accent>
          {grouped.live.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
          ))}
        </Section>
      )}

      {Array.from(grouped.upcoming.entries()).map(([day, list]) => (
        <Section key={day} title={day}>
          {list.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
          ))}
        </Section>
      ))}

      {grouped.finished.length > 0 && (
        <Section title={t("finished")}>
          {grouped.finished.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className={`mb-2 px-1 text-sm font-bold uppercase tracking-wide ${accent ? "text-accent" : "text-ink-soft"}`}>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
