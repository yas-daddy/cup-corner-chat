import { HelpCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ScoringHelpModal({ onClose }: { onClose: () => void }) {
  const { t, n, dir } = useI18n();
  const groupRows: Array<{ label: string; pts: number }> = [
    { label: t("scoring_row_winner"), pts: 3 },
    { label: t("scoring_row_home"), pts: 1 },
    { label: t("scoring_row_away"), pts: 1 },
    { label: t("scoring_row_gd"), pts: 1 },
    { label: t("scoring_row_exact_bonus"), pts: 2 },
  ];
  const knockoutRows: Array<{ label: string; pts: number }> = [
    { label: t("scoring_row_winner"), pts: 3 },
    { label: t("scoring_row_home"), pts: 2 },
    { label: t("scoring_row_away"), pts: 2 },
    { label: t("scoring_row_gd"), pts: 2 },
    { label: t("scoring_row_advance") ?? "Correct team to advance", pts: 4 },
    { label: t("scoring_row_exact_bonus"), pts: 2 },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4 sm:pb-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl" dir={dir}>
        <div className="flex items-start gap-3 border-b border-border p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold">{t("scoring_help_title")}</h2>
            <p className="text-xs text-ink-soft">{t("scoring_help_sub")}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            {t("scoring_section_groups") ?? "Group stage"}
          </h3>
          <ul className="space-y-2">
            {groupRows.map((r) => (
              <li key={r.label} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
                <span className="text-sm">{r.label}</span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-sm font-bold text-success tabular-nums">
                  +{n(r.pts)}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 px-3 py-2.5">
              <span className="text-sm font-bold">{t("scoring_row_exact")}</span>
              <span className="rounded-full bg-[color:var(--gold)]/20 px-2 py-0.5 text-sm font-extrabold text-[color:var(--gold)] tabular-nums">
                +{n(8)} ⭐
              </span>
            </li>
          </ul>

          <h3 className="mb-2 mt-5 px-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            {t("scoring_section_knockouts") ?? "Knockout stage"}
          </h3>
          <p className="mb-2 px-1 text-xs text-ink-soft">
            {t("scoring_knockout_intro") ??
              "All bonuses stack. Predictions are judged against the score after extra time (not penalties)."}
          </p>
          <ul className="space-y-2">
            {knockoutRows.map((r) => (
              <li key={r.label} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5">
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
          <p className="mt-2 px-1 text-[11px] text-ink-soft">
            {t("scoring_knockout_advance_hint") ??
              "Pick a draw and the +4 advance bonus requires picking the team that goes through (penalties decide if needed)."}
          </p>

          <div className="mt-4 rounded-xl bg-border/40 px-3 py-3 text-xs text-ink-soft">
            <span className="font-semibold text-ink">{t("scoring_example_label")}:</span>{" "}
            {t("scoring_example_body")}
          </div>
        </div>

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("scoring_close")}
          </button>
        </div>
      </div>
    </div>
  );
}
