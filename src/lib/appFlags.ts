import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global VAR Report availability flags, controlled from god mode and stored in
// public.app_settings (singleton row). Reads are public; writes go through the
// admin_set_var_flags RPC.

const sb = supabase as unknown as { from: (t: string) => any };

export type VarFlags = { visible: boolean; popup: boolean };

// Fallback used before the migration is applied (table missing) — keeps the
// current live behaviour (card shown, popup off) during the transition.
const DEFAULT_FLAGS: VarFlags = { visible: true, popup: false };

export async function fetchVarFlags(): Promise<VarFlags> {
  try {
    const { data, error } = await sb
      .from("app_settings")
      .select("var_report_visible,var_report_popup")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return DEFAULT_FLAGS;
    return { visible: !!data.var_report_visible, popup: !!data.var_report_popup };
  } catch {
    return DEFAULT_FLAGS;
  }
}

export async function setVarFlags(flags: VarFlags): Promise<{ error: string | null }> {
  // admin_set_var_flags isn't in the generated types until the migration is
  // applied + types regenerated, so call through an untyped rpc.
  const rpc = (supabase as unknown as { rpc: (fn: string, args: unknown) => Promise<{ error: { message: string } | null }> }).rpc;
  const { error } = await rpc("admin_set_var_flags", { _visible: flags.visible, _popup: flags.popup });
  return { error: error?.message ?? null };
}

// Live-updating flags. Returns null until the first read completes.
export function useVarFlags(): VarFlags | null {
  const [flags, setFlags] = useState<VarFlags | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const f = await fetchVarFlags();
      if (active) setFlags(f);
    };
    void load();
    const ch = supabase
      .channel("app_settings_flags")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => void load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);
  return flags;
}
