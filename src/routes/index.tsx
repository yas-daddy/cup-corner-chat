import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { MatchCard } from "@/components/MatchCard";
import { Avatar } from "@/components/AvatarPicker";
import { AvatarPromptModal } from "@/components/AvatarPromptModal";
import { ChampionPromptModal } from "@/components/ChampionPromptModal";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PushAutoPrompt } from "@/components/PushAutoPrompt";
import { InstallPwaModal } from "@/components/InstallPwaModal";
import { NewPicksPill } from "@/components/NewPicksPill";
import { GodModePinModal } from "@/components/GodModePinModal";
import { isStandalone } from "@/lib/push";

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
  const [predictionPreviews, setPredictionPreviews] = useState<Record<string, PredictionPreview>>({});
  const tapTimes = useRef<number[]>([]);
  const [pinOpen, setPinOpen] = useState(false);


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
      const [counts, previews] = await Promise.all([
        fetchMatchCommentCounts(ids),
        fetchMatchPredictionPreviews(ids),
      ]);
      setCommentCounts(counts);
      setPredictionPreviews(previews);
    }
  }

  function handleTitleTap() {
    const now = Date.now();
    tapTimes.current = [...tapTimes.current.filter((t) => now - t < 700), now];
    if (tapTimes.current.length >= 3) {
      tapTimes.current = [];
      setPinOpen(true);
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

  const unpredictedUpcomingIds = useMemo(() => {
    const ids: string[] = [];
    for (const list of grouped.upcoming.values()) {
      for (const m of list) {
        if (!preds[m.id]) ids.push(m.id);
      }
    }
    return ids;
  }, [grouped.upcoming, preds]);

  const firstUnpredictedId = unpredictedUpcomingIds[0] ?? null;
  const [firstVisible, setFirstVisible] = useState(false);

  useEffect(() => {
    setFirstVisible(false);
    if (!firstUnpredictedId) return;
    const el = document.querySelector(`[data-match-id="${firstUnpredictedId}"]`);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFirstVisible(entry.isIntersecting),
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [firstUnpredictedId]);

  function scrollToFirstUnpredicted() {
    if (!firstUnpredictedId) return;
    const el = document.querySelector(`[data-match-id="${firstUnpredictedId}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-2xl");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-2xl"), 1400);
  }



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
      <PushAutoPrompt playerId={player.id} />
      <PwaInstallBanner />
      <GodModePinModal open={pinOpen} onClose={() => setPinOpen(false)} onSuccess={() => { setPinOpen(false); navigate({ to: "/admin" }); }} />

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

      {!firstVisible && (
        <NewPicksPill count={unpredictedUpcomingIds.length} onTap={scrollToFirstUnpredicted} />
      )}

      {matches && matches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-ink-soft">
          {t("no_matches")}
        </div>
      )}

      {grouped.results.length > 0 && (
        <Section title={t("results") ?? "Results"}>
          {grouped.results.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionPreview={predictionPreviews[m.id]} />
          ))}
        </Section>
      )}

      {grouped.live.length > 0 && (
        <Section title={t("live")} accent>
          {grouped.live.map((m) => (
            <MatchCard key={m.id} match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionPreview={predictionPreviews[m.id]} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
          ))}
        </Section>
      )}


      {Array.from(grouped.upcoming.entries()).map(([day, list]) => (
        <Section key={day} title={day}>
          {list.map((m) => (
            <div key={m.id} data-match-id={m.id} className="transition-shadow">
              <MatchCard match={m} playerId={player.id} prediction={preds[m.id] ?? null} commentCount={commentCounts[m.id] ?? 0} predictionPreview={predictionPreviews[m.id]} onSaved={(p) => setPreds((x) => ({ ...x, [m.id]: p }))} />
            </div>
          ))}
        </Section>
      ))}



    </div>
  );
}

function PwaInstallBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const installed = isStandalone();
    const dismissed = (() => {
      try { return localStorage.getItem("wc26.pwa.banner.dismissed") === "1"; }
      catch { return false; }
    })();
    if (!installed && !dismissed) setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem("wc26.pwa.banner.dismissed", "1"); } catch {}
  }

  if (!visible) return null;

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-primary/5 px-4 py-3">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm leading-snug">{t("pwa_banner_text")}</p>
        <button
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
        >
          {t("pwa_banner_cta")}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-border/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <InstallPwaModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
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
