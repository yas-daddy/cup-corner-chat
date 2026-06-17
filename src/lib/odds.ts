// American → decimal odds conversion. Always returns a value clamped to a
// 1.01 floor (anything tighter would imply the bookmaker is paying < 1¢ on
// the dollar, which is nonsensical and breaks our integer payout math).

export function americanToDecimal(american: number | string | null | undefined): number | null {
  if (american == null || american === "") return null;
  const a = typeof american === "string" ? parseInt(american.replace(/^\+/, ""), 10) : american;
  if (!Number.isFinite(a) || a === 0) return null;
  const d = a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1;
  if (!Number.isFinite(d) || d < 1.01) return null;
  return Math.round(d * 100) / 100;
}

export function formatDecimal(d: number | null | undefined): string {
  if (d == null || !Number.isFinite(d)) return "—";
  return d.toFixed(2);
}
