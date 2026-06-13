import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TargetType = "activity" | "prediction" | "match";

export type Reaction = {
  id: string;
  target_type: "activity" | "prediction";
  target_id: string;
  player_id: string;
  value: 1 | -1;
};

export type Comment = {
  id: string;
  target_type: TargetType;
  target_id: string;
  player_id: string;
  body: string;
  created_at: string;
};

export type FeedActivity = {
  id: string;
  kind: "prediction_created" | "prediction_updated" | "points_awarded";
  actor_id: string;
  match_id: string;
  pred_home: number | null;
  pred_away: number | null;
  home_score: number | null;
  away_score: number | null;
  points: number | null;
  is_exact: boolean | null;
  is_correct_result: boolean | null;
  created_at: string;
};

export function predictionTargetId(playerId: string, matchId: string) {
  return `${playerId}::${matchId}`;
}

export async function toggleReaction(
  targetType: "activity" | "prediction",
  targetId: string,
  playerId: string,
  value: 1 | -1,
) {
  const { data: existing } = await supabase
    .from("reactions")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (existing && (existing as Reaction).value === value) {
    await supabase.from("reactions").delete().eq("id", (existing as Reaction).id);
    return null;
  }
  if (existing) {
    await supabase.from("reactions").update({ value }).eq("id", (existing as Reaction).id);
    return value;
  }
  await supabase.from("reactions").insert({
    target_type: targetType,
    target_id: targetId,
    player_id: playerId,
    value,
  });
  return value;
}

export async function addComment(
  targetType: TargetType,
  targetId: string,
  playerId: string,
  body: string,
) {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return null;
  const { data, error } = await supabase
    .from("comments")
    .insert({
      target_type: targetType,
      target_id: targetId,
      player_id: playerId,
      body: trimmed,
    })
    .select()
    .single();
  if (error) return null;
  return data as Comment;
}

export async function deleteComment(id: string) {
  await supabase.from("comments").delete().eq("id", id);
}

export type ReactionSummary = { likes: number; dislikes: number; mine: 1 | -1 | null };

export function useReactions(
  targetType: "activity" | "prediction",
  targetId: string,
  playerId: string | null,
) {
  const [summary, setSummary] = useState<ReactionSummary>({ likes: 0, dislikes: 0, mine: null });

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("reactions")
        .select("*")
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (!active) return;
      const rows = (data as Reaction[] | null) ?? [];
      const likes = rows.filter((r) => r.value === 1).length;
      const dislikes = rows.filter((r) => r.value === -1).length;
      const mine = playerId
        ? (rows.find((r) => r.player_id === playerId)?.value as 1 | -1 | undefined) ?? null
        : null;
      setSummary({ likes, dislikes, mine });
    }
    void load();
    const ch = supabase
      .channel(`reactions:${targetType}:${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `target_id=eq.${targetId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
  }, [targetType, targetId, playerId]);

  async function toggle(value: 1 | -1) {
    if (!playerId) return;
    // optimistic
    setSummary((s) => {
      const wasMine = s.mine;
      const next: ReactionSummary = { ...s, mine: wasMine === value ? null : value };
      if (wasMine === 1) next.likes -= 1;
      if (wasMine === -1) next.dislikes -= 1;
      if (next.mine === 1) next.likes += 1;
      if (next.mine === -1) next.dislikes += 1;
      return next;
    });
    await toggleReaction(targetType, targetId, playerId, value);
  }

  return { ...summary, toggle };
}

export function useComments(targetType: TargetType, targetId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at", { ascending: false });
      if (!active) return;
      setComments((data as Comment[] | null) ?? []);
      setLoading(false);
    }
    void load();
    const ch = supabase
      .channel(`comments:${targetType}:${targetId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `target_id=eq.${targetId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { active = false; void supabase.removeChannel(ch); };
  }, [targetType, targetId]);

  return { comments, loading };
}

/**
 * Fetch comment counts for many matches at once.
 * Returns map of matchId -> total comments (match-level + all predictions for that match).
 */
export async function fetchMatchCommentCounts(matchIds: string[]) {
  const out: Record<string, number> = {};
  if (matchIds.length === 0) return out;
  // match-level
  const { data: matchRows } = await supabase
    .from("comments")
    .select("target_id")
    .eq("target_type", "match")
    .in("target_id", matchIds);
  ((matchRows as { target_id: string }[] | null) ?? []).forEach((r) => {
    out[r.target_id] = (out[r.target_id] ?? 0) + 1;
  });
  // prediction-level (target_id = playerId::matchId)
  const { data: predRows } = await supabase
    .from("comments")
    .select("target_id")
    .eq("target_type", "prediction");
  ((predRows as { target_id: string }[] | null) ?? []).forEach((r) => {
    const idx = r.target_id.indexOf("::");
    if (idx === -1) return;
    const mid = r.target_id.slice(idx + 2);
    if (matchIds.includes(mid)) out[mid] = (out[mid] ?? 0) + 1;
  });
  return out;
}
