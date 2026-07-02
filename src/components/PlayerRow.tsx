import { useState } from "react";

export type SquadPlayer = {
  id: string;
  team_code: string;
  full_name: string;
  display_name: string | null;
  jersey_number: number | null;
  position: "GK" | "D" | "M" | "F" | null;
  club: string | null;
  club_country_code: string | null;
  image_url: string | null;
  captain: boolean;
};

// Palette used to colour the fallback avatar so the roster feels lively
// even when we have no headshot for the player. Keyed by (jersey % N).
const PALETTE = [
  "bg-primary/20 text-primary",
  "bg-accent/15 text-accent",
  "bg-success/15 text-success",
  "bg-[color:var(--gold)]/15 text-[color:var(--gold)]",
  "bg-secondary/20 text-secondary",
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PlayerRow({ p, compact = false }: { p: SquadPlayer; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const paletteIdx = ((p.jersey_number ?? 0) + p.full_name.length) % PALETTE.length;
  const avatarCls = PALETTE[paletteIdx];
  const showImage = !!p.image_url && !broken;
  const size = compact ? "h-9 w-9" : "h-10 w-10";
  const rowGap = compact ? "gap-2 py-1.5" : "gap-3 py-2";

  return (
    <div className={`flex items-center rounded-xl border border-border bg-surface px-2 ${rowGap}`}>
      <div className={`relative shrink-0 ${size}`}>
        {showImage ? (
          <img
            src={p.image_url as string}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className={`h-full w-full rounded-full object-cover ring-1 ring-border ${
              p.captain ? "ring-2 ring-[color:var(--gold)]" : ""
            }`}
          />
        ) : (
          <div
            className={`grid h-full w-full place-items-center rounded-full text-[10px] font-bold ${avatarCls} ${
              p.captain ? "ring-2 ring-[color:var(--gold)]" : "ring-1 ring-border"
            }`}
            aria-hidden
          >
            {initialsOf(p.display_name ?? p.full_name)}
          </div>
        )}
        {p.captain && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[color:var(--gold)] text-[9px] font-extrabold text-black">
            C
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-ink ${compact ? "text-xs" : "text-sm"}`}>
          {p.display_name ?? p.full_name}
        </p>
        {p.club && (
          <p className="truncate text-[11px] text-ink-soft">{p.club}</p>
        )}
      </div>

      {p.jersey_number != null && (
        <span
          className={`shrink-0 rounded-full bg-bg px-2 py-0.5 tabular-nums font-bold ring-1 ring-border ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {p.jersey_number}
        </span>
      )}
    </div>
  );
}
