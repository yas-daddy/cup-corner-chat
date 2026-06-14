import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoredPlayerId } from "@/lib/identity";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // iOS Safari
    if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  } catch {
    /* noop */
  }
  return false;
}

let lastBeacon = 0;

async function beacon() {
  const id = getStoredPlayerId();
  if (!id) return;
  const now = Date.now();
  if (now - lastBeacon < 60_000) return; // throttle to once per minute per tab
  lastBeacon = now;
  const standalone = isStandalone();
  if (standalone) {
    await supabase
      .from("players")
      .update({ pwa_installed_at: new Date().toISOString() })
      .eq("id", id)
      .is("pwa_installed_at", null);
  }
  await supabase
    .from("players")
    .update({
      last_open_at: new Date().toISOString(),
      pwa_display_mode: standalone ? "standalone" : "browser",
    })
    .eq("id", id);
}

export function usePresenceBeacon() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    void beacon();
    const onVis = () => {
      if (document.visibilityState === "visible") void beacon();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);
}
