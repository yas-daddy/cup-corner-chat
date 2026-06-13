import { useState } from "react";

export const AVATAR_EMOJIS = [
  "⚽️", "🏆", "🥇", "🔥", "⭐️", "💪", "🚀", "🎯",
  "👑", "🦁", "🐯", "🐉", "🦅", "🐺", "🦊", "🐼",
  "🦈", "🐙", "🦄", "🐝", "🦋", "🌵", "🌶️", "🍕",
  "🎮", "🎲", "🎸", "🥷", "🧙", "🧛", "🤖", "👾",
  "😎", "🤠", "🤓", "🥶", "🤡", "👻", "💀", "👽",
];

export function Avatar({
  avatar,
  name,
  size = 36,
  className = "",
}: {
  avatar?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.55);
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-white ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {avatar ? <span className="leading-none">{avatar}</span> : <span className="font-bold text-ink-soft">{initial}</span>}
    </div>
  );
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar avatar={value} name="" size={56} className="border border-border text-3xl" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold"
        >
          {open ? "Close" : value ? "Change emoji" : "Pick emoji"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-2xl border border-border bg-surface px-3 py-3 text-sm text-ink-soft"
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="grid grid-cols-8 gap-2 rounded-2xl border border-border bg-surface p-3">
          {AVATAR_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className={`grid aspect-square place-items-center rounded-xl text-2xl transition ${
                value === e ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-white"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
