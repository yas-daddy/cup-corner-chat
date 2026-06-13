// ISO 3166-1 alpha-2 country code -> flag emoji
export function flagFromCode(code?: string | null): string {
  if (!code) return "🏳️";
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return "🏳️";
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65,
  );
}
