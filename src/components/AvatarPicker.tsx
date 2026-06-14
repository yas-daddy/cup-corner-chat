import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


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
      className={`grid shrink-0 place-items-center rounded-full bg-surface ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {avatar ? <span className="leading-none">{avatar}</span> : <span className="font-bold text-ink-soft">{initial}</span>}
    </div>
  );
}

export function useTakenAvatars(excludePlayerId?: string | null) {
  const [taken, setTaken] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    void supabase
      .from("players")
      .select("id,avatar")
      .not("avatar", "is", null)
      .then(({ data }) => {
        if (!active) return;
        const set = new Set<string>();
        (data ?? []).forEach((p: { id: string; avatar: string | null }) => {
          if (p.avatar && p.id !== excludePlayerId) set.add(p.avatar);
        });
        setTaken(set);
      });
    return () => {
      active = false;
    };
  }, [excludePlayerId]);
  return taken;
}

export function AvatarPicker({
  value,
  onChange,
  playerId,
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  playerId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const taken = useTakenAvatars(playerId);
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
          {AVATAR_EMOJIS.map((e) => {
            const isTaken = taken.has(e) && value !== e;
            return (
              <button
                key={e}
                type="button"
                disabled={isTaken}
                title={isTaken ? "Already taken" : undefined}
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className={`grid aspect-square place-items-center rounded-xl text-2xl transition ${
                  value === e
                    ? "bg-primary/15 ring-2 ring-primary"
                    : isTaken
                      ? "opacity-25 grayscale cursor-not-allowed"
                      : "hover:bg-surface"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

