import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Event = {
  match_id: string;
  idx: number;
  type_text: string;
  clock_display: string | null;
  team_code: string | null;
  athlete_name: string | null;
  is_scoring_play: boolean;
  is_own_goal: boolean;
};

const sb = supabase as unknown as {
  from: (t: string) => any;
  channel: (name: string) => any;
  removeChannel: (ch: unknown) => unknown;
};

// Renders goal + card events for a match identified by its public.matches.id.
// Looks up the corresponding ESPN match via espn_matches.linked_match_id and
// subscribes to realtime so live events stream in. Returns null if the match
// isn't linked yet or has no events — caller can place it unconditionally.
export function MatchEventsPanel({ matchId }: { matchId: string }) {
  const [espnId, setEspnId] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await sb
        .from("espn_matches")
        .select("id")
        .eq("linked_match_id", matchId)
        .maybeSingle();
      if (!active) return;
      setEspnId((data as { id: string } | null)?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, [matchId]);

  useEffect(() => {
    if (!espnId) {
      setEvents([]);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await sb
        .from("espn_match_events")
        .select("*")
        .eq("match_id", espnId)
        .order("idx", { ascending: true });
      if (!active) return;
      setEvents(((data as Event[] | null) ?? []).slice());
    })();
    const ch = sb
      .channel(`match_events:${espnId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "espn_match_events",
          filter: `match_id=eq.${espnId}`,
        },
        (payload: any) => {
          const row = payload.new as Event;
          setEvents((prev) =>
            prev.some((e) => e.idx === row.idx)
              ? prev
              : [...prev, row].sort((a, b) => a.idx - b.idx),
          );
        },
      )
      .subscribe();
    return () => {
      active = false;
      void sb.removeChannel(ch);
    };
  }, [espnId]);

  if (!espnId || events.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs">
      {events.map((e) => (
        <li key={e.idx} className="flex items-center gap-2 text-ink-soft">
          <span className="w-10 shrink-0 font-mono tabular-nums">{e.clock_display ?? ""}</span>
          <span className="w-5 text-center">{iconFor(e)}</span>
          <span className="truncate">
            {e.athlete_name ?? ""}
            {e.is_own_goal ? " (OG)" : ""}
            {e.team_code ? ` — ${e.team_code}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function iconFor(e: { type_text: string; is_scoring_play: boolean }) {
  const t = (e.type_text || "").toLowerCase();
  if (t.includes("yellow")) return "🟨";
  if (t.includes("red")) return "🟥";
  if (t.includes("goal") || e.is_scoring_play) return "⚽";
  return "•";
}
