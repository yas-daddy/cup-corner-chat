// Red pulsing "recording" dot + ESPN minute clock for an in-progress match.
export function LiveIndicator({ minute }: { minute?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      {minute ? <span className="tabular-nums">{minute}</span> : <span>LIVE</span>}
    </span>
  );
}
