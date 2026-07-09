import type { ReactNode } from "react";

// UK home nation subdivision flag emojis (ISO 3166-2 tag sequences).
const CUSTOM_FLAGS: Record<string, string> = {
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  SCT: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  WLS: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

// Returns a flag emoji STRING for a 2-letter ISO alpha-2 code, or a
// subdivision emoji for ENG / SCT / WLS. Safe in canvas/text contexts.
export function flagEmoji(code?: string | null): string {
  if (!code) return "🏳️";
  const cc = code.trim().toUpperCase();
  if (CUSTOM_FLAGS[cc]) return CUSTOM_FLAGS[cc];
  if (cc.length !== 2) return "🏳️";
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65,
  );
}

// Returns a flag emoji for a 2-letter ISO alpha-2 code, or a subdivision
// emoji for ENG / SCT / WLS.
export function flagFromCode(code?: string | null): ReactNode {
  return flagEmoji(code);
}
