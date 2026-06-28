import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// One-time intro modal for the new knockout-stage scoring. Triggered from the
// Picks home page when the local-storage flag wc26.knockout_rules_seen is
// missing. Mirrors the Knockout tab of ScoringHelpModal but framed as a
// "here's what changed" callout rather than reference docs.
export function KnockoutRulesModal({ onClose }: { onClose: () => void }) {
  const { t, n, dir } = useI18n();
  const rows: Array<{ label: string; pts: number }> = [
    { label: t("scoring_row_winner"), pts: 3 },
    { label: t("scoring_row_home"), pts: 2 },
    { label: t("scoring_row_away"), pts: 2 },
    { label: t("scoring_row_gd"), pts: 2 },
    { label: t("scoring_row_advance") ?? "Correct team to advance", pts: 4 },
    { label: t("scoring_row_exact_bonus"), pts: 2 },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
        dir={dir}
      >
        <div className="flex items-start gap-3 border-b border-border p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--gold)]/15 text-[color:var(--gold)]">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">
              {t("knockout_modal_title") ?? "Knockout stage rules"}
            </h2>
            <p className="text-xs text-ink-soft">
              {t("knockout_modal_sub") ?? "New scoring kicks in for the knockouts."}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 px-1 text-xs text-ink-soft">
            {t("scoring_knockout_intro") ??
              "All bonuses stack. Predictions are judged against the score after extra time (not penalties)."}
          </p>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2.5"
              >
                <span className="text-sm">{r.label}</span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-sm font-bold text-success tabular-nums">
                  +{n(r.pts)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-2.5">
              <span className="text-sm font-bold">
                {t("scoring_knockout_max") ?? "Max stacked total"}
              </span>
              <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-sm font-extrabold text-[color:var(--gold)] tabular-nums">
                +{n(15)} ⭐
              </span>
            </li>
          </ul>
          <p className="mt-3 rounded-xl bg-primary/10 px-3 py-3 text-xs text-primary">
            {t("knockout_modal_advance_callout") ??
              "If you predict a draw, you'll be prompted to pick who you think advances. Get it right for the +4 bonus."}
          </p>
        </div>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("knockout_modal_close") ?? "Let's go"}
          </button>
        </div>
      </div>
    </div>
  );
}
