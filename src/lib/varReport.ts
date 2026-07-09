// World Cup "VAR Report" — a Spotify-Wrapped-style end-of-tournament recap.
//
// Everything here is computed CLIENT-SIDE from views that are already granted
// to anon/authenticated (leaderboard, quiz_leaderboard, bank_leaderboard,
// prediction_points, bets). No migration needed.
//
// The report unlocks once the tournament Final is finished. We detect that
// label-free: the Final is the chronologically last match, so if the match
// with the greatest kickoff_at is FINISHED, the tournament is done.

import { supabase } from "@/integrations/supabase/client";

const sb = supabase as unknown as { from: (t: string) => any };

// The starting bank every player was granted. NB: the app's bet-config.ts says
// 100, but the live grant was set to 500 directly in the DB — the P&L slide is
// measured against what players actually started with.
export const VAR_STARTING_BANK = 500;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export type VarBest = {
  homeTeam: string;
  awayTeam: string;
  predHome: number;
  predAway: number;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
  isExact: boolean;
};

export type VarReport = {
  player: { id: string; name: string; avatar: string | null };
  board: {
    rank: number;
    total: number;
    points: number;
    predictionsMade: number;
    correctResults: number;
    exactScores: number;
  };
  best: VarBest | null;
  quiz: { answered: number; correct: number; points: number };
  bet: {
    staked: number;
    stakedRank: number; // 1-based among bettors
    totalBettors: number;
    decile: number | null; // 1 = top 10%, null = never bet
    balance: number;
    profit: number; // balance - VAR_STARTING_BANK
  };
};

// The report is unlocked once the last-scheduled match (the Final) is FINISHED.
export async function isVarReportUnlocked(): Promise<boolean> {
  const { data } = await sb
    .from("matches")
    .select("status,kickoff_at")
    .order("kickoff_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { status?: string } | null)?.status === "FINISHED";
}

export async function buildVarReport(playerId: string): Promise<VarReport | null> {
  const [
    { data: player },
    { data: board },
    { data: myPreds },
    { data: quizRow },
    { data: bank },
    { data: bets },
  ] = await Promise.all([
    sb.from("players").select("id,display_name,avatar").eq("id", playerId).maybeSingle(),
    sb.from("leaderboard").select("*"),
    sb
      .from("prediction_points")
      .select("*")
      .eq("player_id", playerId)
      .eq("status", "FINISHED")
      .order("points", { ascending: false }),
    sb.from("quiz_leaderboard").select("*").eq("player_id", playerId).maybeSingle(),
    sb.from("bank_leaderboard").select("*"),
    sb.from("bets").select("player_id,stake,status"),
  ]);

  if (!player) return null;

  // --- Board placement -----------------------------------------------------
  const rows = ((board as any[]) ?? [])
    .map((r) => ({ ...r, total_points: num(r.total_points) }))
    .sort((a, b) => b.total_points - a.total_points);
  const myIdx = rows.findIndex((r) => r.player_id === playerId);
  const me = myIdx >= 0 ? rows[myIdx] : null;
  const boardData = {
    rank: myIdx >= 0 ? myIdx + 1 : rows.length + 1,
    total: rows.length,
    points: me ? num(me.total_points) : 0,
    predictionsMade: me ? num(me.predictions_made) : 0,
    correctResults: me ? num(me.correct_results) : 0,
    exactScores: me ? num(me.exact_scores) : 0,
  };

  // --- Best prediction -----------------------------------------------------
  let best: VarBest | null = null;
  const bestRow = ((myPreds as any[]) ?? []).find((r) => num(r.points) > 0) ?? null;
  if (bestRow) {
    const { data: m } = await sb
      .from("matches")
      .select("home_team,away_team")
      .eq("id", bestRow.match_id)
      .maybeSingle();
    best = {
      homeTeam: (m as any)?.home_team ?? "Home",
      awayTeam: (m as any)?.away_team ?? "Away",
      predHome: num(bestRow.pred_home),
      predAway: num(bestRow.pred_away),
      homeScore: bestRow.home_score == null ? null : num(bestRow.home_score),
      awayScore: bestRow.away_score == null ? null : num(bestRow.away_score),
      points: num(bestRow.points),
      isExact: !!bestRow.is_exact,
    };
  }

  // --- Quiz ----------------------------------------------------------------
  const quiz = {
    answered: num((quizRow as any)?.answered),
    correct: num((quizRow as any)?.correct),
    points: num((quizRow as any)?.total_points),
  };

  // --- Betting (decile by total staked, P&L from starting bank) ------------
  const stakeByPlayer = new Map<string, number>();
  for (const b of (bets as any[]) ?? []) {
    if (b.status === "void") continue; // voided bets were refunded — not real action
    stakeByPlayer.set(b.player_id, (stakeByPlayer.get(b.player_id) ?? 0) + num(b.stake));
  }
  const myStaked = stakeByPlayer.get(playerId) ?? 0;
  const bettors = [...stakeByPlayer.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const rankIdx = bettors.findIndex(([id]) => id === playerId);
  const totalBettors = bettors.length;
  const decile =
    myStaked > 0 && totalBettors > 0
      ? Math.max(1, Math.ceil(((rankIdx + 1) / totalBettors) * 10))
      : null;
  const myBank = ((bank as any[]) ?? []).find((r) => r.player_id === playerId);
  const balance = myBank ? num(myBank.balance) : VAR_STARTING_BANK;

  return {
    player: {
      id: (player as any).id,
      name: (player as any).display_name,
      avatar: (player as any).avatar ?? null,
    },
    board: boardData,
    best,
    quiz,
    bet: {
      staked: myStaked,
      stakedRank: rankIdx >= 0 ? rankIdx + 1 : totalBettors + 1,
      totalBettors,
      decile,
      balance,
      profit: balance - VAR_STARTING_BANK,
    },
  };
}
