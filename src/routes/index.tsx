import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { MatchCard } from "@/components/MatchCard";
import { Avatar } from "@/components/AvatarPicker";
import { AvatarPromptModal } from "@/components/AvatarPromptModal";
import { ChampionPromptModal } from "@/components/ChampionPromptModal";
import { NotificationsBell } from "@/components/NotificationsBell";

import { useI18n } from "@/lib/i18n";
import type { Match, Prediction } from "@/lib/types";
import { fetchMatchCommentCounts, fetchMatchPredictionPreviews, type PredictionPreview } from "@/lib/social";


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
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [predictionCounts, setPredictionCounts] = useState<Record<string, number>>({});
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
    const list = (data as Match[] | null) ?? [];
    setMatches(list);
    if (list.length) {
      const ids = list.map((m) => m.id);
      const [counts, predCounts] = await Promise.all([
        fetchMatchCommentCounts(ids),
        fetchMatchPredictionCounts(ids),
      ]);
      setCommentCounts(counts);
      setPredictionCounts(predCounts);
    }
  }

  function handleTitleTap() {
    const now = Date.now();
    tapTimes.current = [...tapTimes.current.filter((t) => now - t < 700), now];
    if (tapTimes.current.length >= 3) {
      tapTimes.current = [];
      navigate({ to: "/admin" });
    }
  }


  const grouped = useMemo(() => {
    const now = Date.now();
    const horizon = now + 1000 * 60 * 60 * 48;
    const pastWindow = now - 1000 * 60 * 60 * 24;
    const live: Match[] = [];
    const results: Match[] = [];
    const upcoming: Map<string, Match[]> = new Map();
    (matches ?? []).forEach((m) => {
      const k = new Date(m.kickoff_at).getTime();
      if (m.status === "LIVE") live.push(m);
      else if (m.status === "FINISHED") {
        if (k >= pastWindow) results.push(m);
      } else if (k > now - 1000 * 60 * 60 * 2 && k <= horizon) {
        const day = new Date(m.kickoff_at).toLocaleDateString(lang === "fa" ? "fa-IR" : undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        if (!upcoming.has(day)) upcoming.set(day, []);
        upcoming.get(day)!.push(m);
      }
    });
    results.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
    return { live, results, upcoming };
  }, [matches, lang]);



  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }

  if (!player) {
    return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;
  }

  return (
    <div className="px-4 pt-6">
      {!player.avatar && <AvatarPromptModal player={player} onSaved={(p) => setPlayer(p)} />}
      {player.avatar && <ChampionPromptModal playerId={player.id} />}
      <header className="mb-4 flex items-center gap-3">
        <Avatar avatar={player.avatar} name={player.display_name} size={44} className="border border-border text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-ink-soft truncate">{player.display_name}</p>
          <h1
            onClick={handleTitleTap}
            className="select-none text-2xl font-extrabold"
          >
            {t("home")}
          </h1>
        </div>
        <NotificationsBell playerId={player.id} />
      </header>



      {matches && matches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_matches")}
        </div>
      )}

      {grouped.results.length > 0 && (
        <Section title={t("results") ?? "Results"}>
          {grouped.results.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionCount={predictionCounts[m.id] ?? 0} />
          ))}
        </Section>
      )}

      {grouped.live.length > 0 && (
        <Section title={t("live")} accent>
          {grouped.live.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionCount={predictionCounts[m.id] ?? 0} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
          ))}
        </Section>
      )}


      {Array.from(grouped.upcoming.entries()).map(([day, list]) => (
        <Section key={day} title={day}>
          {list.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionCount={predictionCounts[m.id] ?? 0} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
          ))}
        </Section>
      ))}



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
