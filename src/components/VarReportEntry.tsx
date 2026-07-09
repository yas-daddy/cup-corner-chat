import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, ChevronRight, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildVarReport, type VarReport } from "@/lib/varReport";
import { useVarFlags } from "@/lib/appFlags";
import { VarReportStory } from "@/components/VarReportStory";

// VAR Report entry on the Picks home page. Availability is controlled globally
// from god mode via two flags (public.app_settings):
//   • visible → show the VAR Report card in the feed
//   • popup   → auto-show the one-time "your report is ready" popup
// The report itself is built lazily (only when opened) to avoid running the
// full cross-player aggregation on every home load.

const PROMPT_SEEN_KEY = "wc26.var_prompt_seen";

export function VarReportEntry({ playerId }: { playerId: string }) {
  const { t, dir } = useI18n();
  const flags = useVarFlags();
  const [report, setReport] = useState<VarReport | null>(null);
  const [building, setBuilding] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  // Auto-popup when the god-mode popup flag is on (once per device).
  useEffect(() => {
    if (!flags?.popup) return;
    let seen = false;
    try {
      seen = localStorage.getItem(PROMPT_SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!seen) setPromptOpen(true);
  }, [flags?.popup]);

  function markPromptSeen() {
    try {
      localStorage.setItem(PROMPT_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setPromptOpen(false);
  }

  async function openStory() {
    markPromptSeen();
    let r = report;
    if (!r) {
      setBuilding(true);
      try {
        r = await buildVarReport(playerId);
        if (r) setReport(r);
      } finally {
        setBuilding(false);
      }
    }
    if (r) setStoryOpen(true);
  }

  return (
    <>
      {/* Card — shown when god-mode visibility flag is on */}
      {flags?.visible && (
        <button
          type="button"
          onClick={openStory}
          disabled={building}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-r from-[color:var(--gold)]/15 to-primary/10 p-3 text-left active:opacity-90 disabled:opacity-70"
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
            {building ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {t("var_card_cta") ?? "Watch"}
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        </button>
      )}

      {/* One-time "ready" popup (god-mode popup flag) */}
      {promptOpen && flags?.popup && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4">
          <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl" dir={dir}>
            <div className="relative bg-gradient-to-br from-[#7C3AED] via-[#DB2777] to-[#F97316] px-6 py-8 text-center text-white">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-4xl">🎬</div>
              <h2 className="mt-4 text-2xl font-black">{t("var_ready_title") ?? "Your VAR Report is ready 🎬"}</h2>
              <p className="mt-1 text-sm text-white/85">
                {t("var_ready_sub") ?? "The tournament's over — here's your World Cup, wrapped."}
              </p>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <button
                type="button"
                onClick={openStory}
                disabled={building}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground active:opacity-90 disabled:opacity-70"
              >
                {building && <Loader2 className="h-4 w-4 animate-spin" />}
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

      {storyOpen && report && <VarReportStory report={report} onClose={() => setStoryOpen(false)} />}
    </>
  );
}
