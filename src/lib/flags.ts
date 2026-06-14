import type { ReactNode } from "react";

// Custom flag SVG registry for non-ISO entities (e.g. UK home nations).
const CUSTOM_FLAGS: Record<string, ReactNode> = {
  ENG: (
    <svg viewBox="0 0 60 40" className="inline-block h-[1em] w-[1.5em] align-[-0.15em]">
      <rect width="60" height="40" fill="#FFFFFF" />
      <rect x="24" width="12" height="40" fill="#CE1124" />
      <rect y="14" width="60" height="12" fill="#CE1124" />
    </svg>
  ),
  SCT: (
    <svg viewBox="0 0 60 40" className="inline-block h-[1em] w-[1.5em] align-[-0.15em]">
      <rect width="60" height="40" fill="#0065BD" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8" />
    </svg>
  ),
  WLS: (
    <svg viewBox="0 0 60 40" className="inline-block h-[1em] w-[1.5em] align-[-0.15em]">
      <rect width="60" height="20" fill="#FFFFFF" />
      <rect y="20" width="60" height="20" fill="#00B140" />
    </svg>
  ),
};

// Returns a flag emoji (or custom SVG) for a 2-letter ISO alpha-2 code.
// Accepts custom codes ENG, SCT, WLS for UK home nations.
export function flagFromCode(code?: string | null): ReactNode {
  if (!code) return "🏳️";
  const cc = code.trim().toUpperCase();
  if (CUSTOM_FLAGS[cc]) return CUSTOM_FLAGS[cc];
  if (cc.length !== 2) return "🏳️";
  return String.fromCodePoint(
    0x1f1e6 + cc.charCodeAt(0) - 65,
    0x1f1e6 + cc.charCodeAt(1) - 65,
  );
}
