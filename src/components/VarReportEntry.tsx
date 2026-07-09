import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildVarReport, isVarReportUnlocked, type VarReport } from "@/lib/varReport";
import { VarReportStory } from "@/components/VarReportStory";

// Orchestrates the end-of-tournament VAR Report from the Picks home page:
//   1. Detects the report is unlocked (Final finished).
//   2. Auto-shows a one-time "your report is ready" popup.
//   3. Leaves a persistent card so players can rewatch any time.
// Renders nothing at all until the tournament is over.

const PROMPT_SEEN_KEY = "wc26.var_prompt_seen";

export function VarReportEntry({ playerId }: { playerId: string }) {
  const { t, dir } = useI18n();
  const [report, setReport] = useState<VarReport | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!(await isVarReportUnlocked())) return;
      const r = await buildVarReport(playerId);
      if (!active || !r) return;
      setReport(r);
      let seen = false;
      try {
        seen = localStorage.getItem(PROMPT_SEEN_KEY) === "1";
      } catch {
        /* ignore */
      }
      if (!seen) setPromptOpen(true);
    })();
    return () => {
      active = false;
    };
  }, [playerId]);

  function markPromptSeen() {
    try {
      localStorage.setItem(PROMPT_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setPromptOpen(false);
  }

  function openStory() {
    markPromptSeen();
    setStoryOpen(true);
  }

  if (!report) return null;

  return (
    <>
      {/* Persistent rewatch card */}
      <button
        type="button"
        onClick={() => setStoryOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-r from-[color:var(--gold)]/15 to-primary/10 p-3 text-left active:opacity-90"
        dir={dir}
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--gold)]/20 text-[color:var(--gold)]">
          <Clapperboard className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{t("var_card_title") ?? "World Cup VAR Report"}</p>
          <p className="truncate text-xs text-ink-soft">{t("var_card_sub") ?? "Your tournament, wrapped"}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--gold)] px-3 py-1.5 text-xs font-bold text-neutral-900">
          {t("var_card_cta") ?? "Watch"}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>

      {/* One-time "ready" popup */}
      {promptOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4">
          <div
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
            dir={dir}
          >
            <div className="relative bg-gradient-to-br from-[#7C3AED] via-[#DB2777] to-[#F97316] px-6 py-8 text-center text-white">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-4xl">
                🎬
              </div>
              <h2 className="mt-4 text-2xl font-black">{t("var_ready_title") ?? "Your VAR Report is ready 🎬"}</h2>
              <p className="mt-1 text-sm text-white/85">
                {t("var_ready_sub") ?? "The tournament's over — here's your World Cup, wrapped."}
              </p>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <button
                type="button"
                onClick={openStory}
                className="w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground active:opacity-90"
              >
                {t("var_ready_cta") ?? "Watch my report"}
              </button>
              <button
                type="button"
                onClick={markPromptSeen}
                className="w-full rounded-xl px-3 py-2 text-sm font-medium text-ink-soft active:opacity-80"
              >
                {t("var_ready_later") ?? "Maybe later"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {storyOpen && <VarReportStory report={report} onClose={() => setStoryOpen(false)} />}
    </>
  );
}
