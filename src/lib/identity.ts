import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "wc26.playerId";

export type Player = {
  id: string;
  display_name: string;
  avatar: string | null;
  created_at: string;
};


export function getStoredPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function storePlayerId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
}

export function useCurrentPlayer() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPlayerId(getStoredPlayerId());
  }, []);

  useEffect(() => {
    let active = true;
    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setPlayer(data as Player);
        else {
          // stored id no longer exists -> clear
          storePlayerId(null);
          setPlayerId(null);
          setPlayer(null);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [playerId]);

  return {
    player,
    loading,
    setPlayer: (p: Player | null) => {
      storePlayerId(p?.id ?? null);
      setPlayerId(p?.id ?? null);
      setPlayer(p);
    },
  };
}
