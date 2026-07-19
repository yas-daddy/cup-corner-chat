import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global feature flags, controlled from god mode and stored in
// public.app_settings (singleton row). Reads are public; writes go through
// SECURITY DEFINER admin_* RPCs.

const sb = supabase as unknown as { from: (t: string) => any };
type UntypedRpc = { rpc: (fn: string, args: unknown) => Promise<{ error: { message: string } | null }> };

export type VarFlags = {
  visible: boolean; // VAR Report card in the Picks feed
  popup: boolean; // one-time "your report is ready" popup
  finale: boolean; // "That's all folks" takeover of the Picks page
};

// Fallback used before the migrations are applied — keeps the current live
// behaviour (card shown, popup off, no takeover) during the transition.
const DEFAULT_FLAGS: VarFlags = { visible: true, popup: false, finale: false };

export async function fetchVarFlags(): Promise<VarFlags> {
  try {
    // select("*") so a not-yet-migrated column doesn't error the whole read.
    const { data, error } = await sb.from("app_settings").select("*").eq("id", true).maybeSingle();
    if (error || !data) return DEFAULT_FLAGS;
    return {
      visible: !!data.var_report_visible,
      popup: !!data.var_report_popup,
      finale: !!data.finale_takeover,
    };
  } catch {
    return DEFAULT_FLAGS;
  }
}

export async function setVarFlags(flags: VarFlags): Promise<{ error: string | null }> {
  const { error } = await (supabase as unknown as UntypedRpc).rpc("admin_set_var_flags", {
    _visible: flags.visible,
    _popup: flags.popup,
  });
  return { error: error?.message ?? null };
}

export async function setFinaleTakeover(on: boolean): Promise<{ error: string | null }> {
  const { error } = await (supabase as unknown as UntypedRpc).rpc("admin_set_finale_takeover", { _on: on });
  return { error: error?.message ?? null };
}

// Live-updating flags, shared app-wide. Multiple components mount this hook
// (HomePage + VarReportEntry), so the realtime channel is a module-level
// singleton — creating a second channel with the same topic and calling .on()
// after subscribe() throws in supabase-js. The channel lives for the app's
// lifetime; hooks just attach/detach listeners.
let cachedFlags: VarFlags | null = null;
const flagListeners = new Set<(f: VarFlags) => void>();
let channelStarted = false;

async function refreshFlags() {
  const f = await fetchVarFlags();
  cachedFlags = f;
  flagListeners.forEach((l) => l(f));
}

function ensureFlagsChannel() {
  if (channelStarted) return;
  channelStarted = true;
  try {
    supabase
      .channel("app_settings_flags")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => void refreshFlags())
      .subscribe();
  } catch {
    // channel() returns an existing subscribed channel if the topic is already
    // live (e.g. after an HMR module reset), and .on() then throws. Realtime
    // updates are a nice-to-have — reads still refresh on every mount.
  }
}

// Returns null until the first read completes.
export function useVarFlags(): VarFlags | null {
  const [flags, setFlags] = useState<VarFlags | null>(cachedFlags);
  useEffect(() => {
    flagListeners.add(setFlags);
    ensureFlagsChannel();
    void refreshFlags();
    return () => {
      flagListeners.delete(setFlags);
    };
  }, []);
  return flags;
}
