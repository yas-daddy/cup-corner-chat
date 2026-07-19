import { useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildVarReport, type VarReport } from "@/lib/varReport";
import { logVarView } from "@/lib/varAnalytics";
import { VarReportStory } from "@/components/VarReportStory";

// End-of-tournament takeover of the Picks home tab, in the spirit of a
// classic cartoon sign-off: concentric rings iris in, a cursive "That's all
// Folks!" writes itself across the middle, then a thank-you line and a CTA
// into the player's VAR Report. Shown to everyone while god mode's
// finale_takeover flag is on. The report builds lazily on tap.

export function FinaleTakeover({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const [report, setReport] = useState<VarReport | null>(null);
  const [building, setBuilding] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  async function openStory() {
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
    if (r) {
      setStoryOpen(true);
      void logVarView(playerId);
    }
  }

  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 pb-36 text-center text-white"
      style={{ background: "#0b0821" }}
    >
      <style>{FT_CSS}</style>

      {/* Concentric rings + vignette, revealed with a clip-path iris-in */}
      <div
        aria-hidden
        className="ft-rings pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(11,8,33,0) 0 170px, rgba(11,8,33,0.55) 400px, #0b0821 620px), repeating-radial-gradient(circle at 50% 42%, #b23a2a 0 34px, #6d1c12 34px 68px, #53240f 68px 102px)",
        }}
      />

      <div className="relative">
        <p
          className="leading-none drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]"
          style={{ fontFamily: '"Brush Script MT", "Savoye LET", "Snell Roundhand", cursive' }}
        >
          <span className="ft-word inline-block text-5xl" style={{ animationDelay: "0.55s" }}>
            That's
          </span>{" "}
          <span className="ft-word inline-block text-5xl" style={{ animationDelay: "0.95s" }}>
            all
          </span>
          <span className="ft-word block pt-3 text-8xl text-[#FDE68A]" style={{ animationDelay: "1.4s" }}>
            Folks!
          </span>
        </p>

        <p className="ft-fade mt-10 text-lg font-bold" style={{ animationDelay: "2.4s" }}>
          {t("finale_thanks") ?? "Thank you for playing"} ⚽
        </p>

        <button
          type="button"
          onClick={openStory}
          disabled={building}
          className="ft-fade mx-auto mt-5 flex items-center justify-center gap-2 rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-black text-neutral-900 shadow-lg active:opacity-90 disabled:opacity-70"
          style={{ animationDelay: "3s" }}
        >
          {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
          {t("finale_watch_var") ?? "Watch your VAR Report"}
        </button>
      </div>

      {storyOpen && report && <VarReportStory report={report} onClose={() => setStoryOpen(false)} />}
    </div>
  );
}

const FT_CSS = `
@keyframes ft-iris {
  from { clip-path: circle(0% at 50% 42%); }
  to   { clip-path: circle(140% at 50% 42%); }
}
@keyframes ft-pop {
  0%   { opacity: 0; transform: scale(0.2) rotate(-14deg); }
  70%  { opacity: 1; transform: scale(1.18) rotate(-7deg); }
  100% { opacity: 1; transform: scale(1) rotate(-7deg); }
}
@keyframes ft-fade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ft-rings { animation: ft-iris 1s cubic-bezier(0.34, 1.4, 0.64, 1) both; }
.ft-word { opacity: 0; animation: ft-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.ft-fade { opacity: 0; animation: ft-fade 0.7s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .ft-rings, .ft-word, .ft-fade { animation: none; opacity: 1; }
}
`;
