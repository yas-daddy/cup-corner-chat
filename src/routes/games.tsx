import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentPlayer } from "@/lib/identity";
import { SignInScreen } from "@/components/SignInScreen";
import { useI18n } from "@/lib/i18n";
import { Brain, ChevronRight, DollarSign } from "lucide-react";

const sb = supabase as unknown as { from: (t: string) => any };
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "WC26 — Games" },
      { name: "description", content: "World Cup trivia, daily." },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const { t } = useI18n();
  const { player, loading, setPlayer } = useCurrentPlayer();
  const [todayStats, setTodayStats] = useState<{ total: number; answered: number } | null>(null);

  useEffect(() => {
    // First visit unlocks the NEW badge on BottomNav.
    try {
      localStorage.setItem("wc26.games.visited", "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!player) return;
    let active = true;
    (async () => {
      const res = await fetch("/api/public/quiz-today", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({ player_id: player.id }),
      });
      const text = await res.text();
      let json: { questions?: unknown[]; answered?: Record<string, unknown> } | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* swallow */
      }
      if (!active || !json?.questions) return;
      setTodayStats({
        total: json.questions.length,
        answered: Object.keys(json.answered ?? {}).length,
      });
    })();
    return () => {
      active = false;
    };
  }, [player?.id]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-ink-soft">{t("loading")}</div>;
  }
  if (!player) return <SignInScreen onSignedIn={(p) => setPlayer(p)} />;

  return (
    <div className="px-4 pt-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">{t("games") ?? "Games"}</h1>
        <p className="text-sm text-ink-soft">{t("games_subtitle") ?? "Daily World Cup trivia"}</p>
      </header>

      <Link
        to="/games/quiz"
        className="block rounded-2xl border border-border bg-surface p-4 transition active:opacity-80"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Brain className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">{t("quiz_title") ?? "Daily Quiz"}</p>
            <p className="text-xs text-ink-soft">
              {todayStats
                ? `${todayStats.answered}/${todayStats.total} ${t("quiz_today_done") ?? "answered today"}`
                : t("quiz_loading_status") ?? "Today's questions are loading…"}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-soft" />
        </div>
      </Link>
    </div>
  );
}
