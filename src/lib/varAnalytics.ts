import { supabase } from "@/integrations/supabase/client";

// VAR Report view analytics. logVarView records one "watch"; fetchVarStats
// returns aggregate counts for the god-mode dashboard. Both are best-effort —
// they no-op gracefully before the migration is applied.

const sb = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args: unknown) => Promise<{ error: unknown }>;
};

export async function logVarView(playerId: string): Promise<void> {
  try {
    await sb.rpc("log_var_report_view", { _player_id: playerId });
  } catch {
    /* analytics is best-effort — never block opening the report */
  }
}

export type VarStats = { totalViews: number; uniqueOpeners: number };

export async function fetchVarStats(): Promise<VarStats> {
  try {
    const { data } = await sb.from("var_report_view_stats").select("total_views,unique_openers").maybeSingle();
    return {
      totalViews: Number(data?.total_views ?? 0),
      uniqueOpeners: Number(data?.unique_openers ?? 0),
    };
  } catch {
    return { totalViews: 0, uniqueOpeners: 0 };
  }
}
