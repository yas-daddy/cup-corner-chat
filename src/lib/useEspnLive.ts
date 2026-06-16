import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EspnLive = {
  id: string;
  state: "pre" | "in" | "post";
  home_score: number | null;
  away_score: number | null;
  clock_display: string | null;
};

const sb = supabase as unknown as {
  from: (t: string) => any;
  channel: (name: string) => any;
  removeChannel: (ch: unknown) => unknown;
};

// Subscribes to the espn_matches row linked to this public.matches.id, so we
// can show ESPN's live score + minute clock the moment the sync upserts it.
// Pass null to disable (e.g. for SCHEDULED matches far from kickoff).
export function useEspnLive(matchId: string | null): EspnLive | null {
  const [data, setData] = useState<EspnLive | null>(null);

  useEffect(() => {
    if (!matchId) {
      setData(null);
      return;
    }
    let active = true;

    (async () => {
      const { data: row } = await sb
        .from("espn_matches")
        .select("id,state,home_score,away_score,clock_display")
        .eq("linked_match_id", matchId)
        .maybeSingle();
      if (!active) return;
      setData((row as EspnLive | null) ?? null);
    })();

    const ch = sb
      .channel(`espn_live:${matchId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "espn_matches",
          filter: `linked_match_id=eq.${matchId}`,
        },
        (payload: any) => {
          const r = payload.new ?? payload.old;
          if (!r) return;
          setData({
            id: r.id,
            state: r.state,
            home_score: r.home_score,
            away_score: r.away_score,
            clock_display: r.clock_display,
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void sb.removeChannel(ch);
    };
  }, [matchId]);

  return data;
}
