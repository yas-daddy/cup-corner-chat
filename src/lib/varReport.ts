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
  homeCode: string | null;
  awayCode: string | null;
  predHome: number;
  predAway: number;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
  isExact: boolean;
};

// The "moment of genius": a contrarian correct call (few/no others saw it),
// else an exact score on the highest-scoring match, else the best-points pick.
export type VarGenius = VarBest & {
  kind: "contrarian" | "highscore" | "best";
  othersAgreed: number; // # of OTHER players who called the same result (contrarian only)
  totalGoals: number;
};

export type VarSoulmate = {
  name: string;
  avatar: string | null;
  agree: number; // # of matches you predicted the same outcome
  shared: number; // # of matches you both predicted
};

export type VarTeam = {
  code: string | null;
  name: string;
  points: number;
};

export type VarStanding = {
  rank: number;
  playerId: string;
  name: string;
  avatar: string | null;
  points: number;
};

export type VarNeighbor = { name: string; avatar: string | null; predictions: number };
export type VarQuizNeighbor = { name: string; avatar: string | null; accuracy: number };

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
  standings: VarStanding[];
  best: VarBest | null;
  genius: VarGenius | null;
  soulmate: VarSoulmate | null;
  topTeam: VarTeam | null;
  field: { avgPredictions: number; avgPoints: number };
  predNeighbors: { above: VarNeighbor | null; below: VarNeighbor | null };
  quiz: {
    answered: number;
    correct: number;
    points: number;
    accuracy: number; // your %
    fieldAccuracy: number; // league average %
    neighbors: { above: VarQuizNeighbor | null; below: VarQuizNeighbor | null };
  };
  bet: {
    staked: number;
    stakedRank: number; // 1-based among bettors
    totalBettors: number;
    decile: number | null; // 1 = top 10%, null = never bet
    balance: number;
    profit: number; // balance - VAR_STARTING_BANK
  };
};

// WC2026 Final is 19 Jul 2026. The report must only appear AFTER the Final —
// never during earlier rounds. We can't rely on "the last match is finished"
// alone: mid-tournament the schedule is incomplete (later rounds aren't added
// until earlier ones resolve), so the chronologically-last KNOWN match is
// often just the latest scheduled round. Gate on BOTH: the last match is
// FINISHED and its kickoff is on/after the Final's date floor.
const FINAL_KICKOFF_FLOOR = "2026-07-19T00:00:00Z";

export async function isVarReportUnlocked(): Promise<boolean> {
  const { data } = await sb
    .from("matches")
    .select("status,kickoff_at")
    .order("kickoff_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { status?: string; kickoff_at?: string } | null;
  if (!row?.kickoff_at) return false;
  return (
    row.status === "FINISHED" &&
    new Date(row.kickoff_at).getTime() >= new Date(FINAL_KICKOFF_FLOOR).getTime()
  );
}

export async function buildVarReport(playerId: string): Promise<VarReport | null> {
  const [
    { data: player },
    { data: board },
    { data: myPreds },
    { data: quizRow },
    { data: bank },
    { data: bets },
    { data: allPreds },
    { data: finishedMatches },
  ] = await Promise.all([
    sb.from("players").select("id,display_name,avatar").eq("id", playerId).maybeSingle(),
    sb.from("leaderboard").select("*"),
    sb
      .from("prediction_points")
      .select("*")
      .eq("player_id", playerId)
      .eq("status", "FINISHED")
      .order("points", { ascending: false }),
    sb.from("quiz_leaderboard").select("*"),
    sb.from("bank_leaderboard").select("*"),
    sb.from("bets").select("player_id,stake,status"),
    sb.from("predictions").select("player_id,match_id,pred_home,pred_away"),
    sb
      .from("matches")
      .select("id,home_team,away_team,home_code,away_code,home_score,away_score,status")
      .eq("status", "FINISHED"),
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
  const standings: VarStanding[] = rows.map((r, i) => ({
    rank: i + 1,
    playerId: r.player_id,
    name: r.display_name,
    avatar: r.avatar ?? null,
    points: num(r.total_points),
  }));

  // --- Match lookup (finished only) ----------------------------------------
  type MInfo = {
    homeTeam: string;
    awayTeam: string;
    homeCode: string | null;
    awayCode: string | null;
    homeScore: number | null;
    awayScore: number | null;
    totalGoals: number;
    outcome: "H" | "D" | "A" | null; // actual result direction
  };
  const matchInfo = new Map<string, MInfo>();
  const codeName = new Map<string, string>(); // team code -> display name
  for (const m of (finishedMatches as any[]) ?? []) {
    const hs = m.home_score == null ? null : num(m.home_score);
    const as = m.away_score == null ? null : num(m.away_score);
    const outcome = hs == null || as == null ? null : hs > as ? "H" : hs < as ? "A" : "D";
    matchInfo.set(m.id, {
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeCode: m.home_code ?? null,
      awayCode: m.away_code ?? null,
      homeScore: hs,
      awayScore: as,
      totalGoals: (hs ?? 0) + (as ?? 0),
      outcome,
    });
    if (m.home_code) codeName.set(m.home_code, m.home_team);
    if (m.away_code) codeName.set(m.away_code, m.away_team);
  }

  const predOutcome = (h: number, a: number): "H" | "D" | "A" => (h > a ? "H" : h < a ? "A" : "D");
  const myFinished = ((myPreds as any[]) ?? []).map((r) => ({
    matchId: r.match_id,
    predHome: num(r.pred_home),
    predAway: num(r.pred_away),
    homeScore: r.home_score == null ? null : num(r.home_score),
    awayScore: r.away_score == null ? null : num(r.away_score),
    points: num(r.points),
    isExact: !!r.is_exact,
    isCorrect: !!r.is_correct_result,
  }));

  const toBest = (
    matchId: string,
    predHome: number,
    predAway: number,
    points: number,
    isExact: boolean,
  ): VarBest | null => {
    const mi = matchInfo.get(matchId);
    if (!mi) return null;
    return {
      homeTeam: mi.homeTeam,
      awayTeam: mi.awayTeam,
      homeCode: mi.homeCode,
      awayCode: mi.awayCode,
      predHome,
      predAway,
      homeScore: mi.homeScore,
      awayScore: mi.awayScore,
      points,
      isExact,
    };
  };

  // --- Best prediction (highest points) — used by the summary bento ---------
  let best: VarBest | null = null;
  const bestRow = myFinished.find((r) => r.points > 0) ?? null;
  if (bestRow) best = toBest(bestRow.matchId, bestRow.predHome, bestRow.predAway, bestRow.points, bestRow.isExact);

  // --- Moment of genius -----------------------------------------------------
  // 1) Contrarian correct: you called the result, few/no others did.
  // 2) else exact score on the highest-scoring match (more goals = harder).
  // 3) else your best-points pick.
  let genius: VarGenius | null = null;
  const othersByMatch = new Map<string, { H: number; D: number; A: number }>();
  for (const p of (allPreds as any[]) ?? []) {
    if (p.player_id === playerId) continue;
    if (!matchInfo.has(p.match_id)) continue;
    const o = predOutcome(num(p.pred_home), num(p.pred_away));
    const rec = othersByMatch.get(p.match_id) ?? { H: 0, D: 0, A: 0 };
    rec[o]++;
    othersByMatch.set(p.match_id, rec);
  }
  const contrarians = myFinished
    .filter((r) => r.isCorrect)
    .map((r) => {
      const mi = matchInfo.get(r.matchId)!;
      const othersAgreed = mi.outcome ? (othersByMatch.get(r.matchId)?.[mi.outcome] ?? 0) : 999;
      return { ...r, othersAgreed, totalGoals: mi?.totalGoals ?? 0 };
    })
    .sort((a, b) => a.othersAgreed - b.othersAgreed || b.totalGoals - a.totalGoals || b.points - a.points);
  if (contrarians.length && matchInfo.has(contrarians[0].matchId)) {
    const c = contrarians[0];
    const b = toBest(c.matchId, c.predHome, c.predAway, c.points, c.isExact);
    if (b) genius = { ...b, kind: "contrarian", othersAgreed: c.othersAgreed, totalGoals: c.totalGoals };
  }
  if (!genius) {
    const exacts = myFinished
      .filter((r) => r.isExact)
      .map((r) => ({ ...r, totalGoals: matchInfo.get(r.matchId)?.totalGoals ?? 0 }))
      .sort((a, b) => b.totalGoals - a.totalGoals || b.points - a.points);
    const pick = exacts[0] ?? (bestRow ? { ...bestRow, totalGoals: matchInfo.get(bestRow.matchId)?.totalGoals ?? 0 } : null);
    if (pick) {
      const b = toBest(pick.matchId, pick.predHome, pick.predAway, pick.points, pick.isExact);
      if (b) genius = { ...b, kind: pick.isExact ? "highscore" : "best", othersAgreed: 0, totalGoals: pick.totalGoals };
    }
  }

  // --- Team that gave you the most points -----------------------------------
  const teamPts = new Map<string, number>();
  for (const r of myFinished) {
    if (r.points <= 0) continue;
    const mi = matchInfo.get(r.matchId);
    if (!mi) continue;
    if (mi.homeCode) teamPts.set(mi.homeCode, (teamPts.get(mi.homeCode) ?? 0) + r.points);
    if (mi.awayCode) teamPts.set(mi.awayCode, (teamPts.get(mi.awayCode) ?? 0) + r.points);
  }
  let topTeam: VarTeam | null = null;
  const topTeamEntry = [...teamPts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topTeamEntry) {
    topTeam = { code: topTeamEntry[0], name: codeName.get(topTeamEntry[0]) ?? topTeamEntry[0], points: topTeamEntry[1] };
  }

  // --- Prediction soulmate (most-agreed-with player) ------------------------
  const myOutcomes = new Map<string, "H" | "D" | "A">();
  for (const p of (allPreds as any[]) ?? []) {
    if (p.player_id === playerId) myOutcomes.set(p.match_id, predOutcome(num(p.pred_home), num(p.pred_away)));
  }
  const agreeBy = new Map<string, { agree: number; shared: number }>();
  for (const p of (allPreds as any[]) ?? []) {
    if (p.player_id === playerId) continue;
    const mine = myOutcomes.get(p.match_id);
    if (!mine) continue;
    const rec = agreeBy.get(p.player_id) ?? { agree: 0, shared: 0 };
    rec.shared++;
    if (predOutcome(num(p.pred_home), num(p.pred_away)) === mine) rec.agree++;
    agreeBy.set(p.player_id, rec);
  }
  let soulmate: VarSoulmate | null = null;
  const nameById = new Map<string, { name: string; avatar: string | null }>(
    rows.map((r) => [r.player_id, { name: r.display_name, avatar: r.avatar ?? null }]),
  );
  const bestMate = [...agreeBy.entries()]
    .filter(([, v]) => v.shared >= 3)
    .sort((a, b) => b[1].agree - a[1].agree || b[1].agree / b[1].shared - a[1].agree / a[1].shared)[0];
  if (bestMate) {
    const info = nameById.get(bestMate[0]);
    soulmate = {
      name: info?.name ?? "Someone",
      avatar: info?.avatar ?? null,
      agree: bestMate[1].agree,
      shared: bestMate[1].shared,
    };
  }

  // --- Field averages (for "vs the field" visuals) --------------------------
  const field = {
    avgPredictions: rows.length ? Math.round(rows.reduce((s, r) => s + num(r.predictions_made), 0) / rows.length) : 0,
    avgPoints: rows.length ? Math.round(rows.reduce((s, r) => s + num(r.total_points), 0) / rows.length) : 0,
  };

  // --- Prediction-volume neighbours (players just above / below you) ---------
  const byPreds = rows
    .slice()
    .sort(
      (a, b) =>
        num(b.predictions_made) - num(a.predictions_made) ||
        String(a.player_id).localeCompare(String(b.player_id)),
    );
  const pIdx = byPreds.findIndex((r) => r.player_id === playerId);
  const toNeighbor = (r: any): VarNeighbor => ({
    name: r.display_name,
    avatar: r.avatar ?? null,
    predictions: num(r.predictions_made),
  });
  const predNeighbors = {
    above: pIdx > 0 ? toNeighbor(byPreds[pIdx - 1]) : null,
    below: pIdx >= 0 && pIdx < byPreds.length - 1 ? toNeighbor(byPreds[pIdx + 1]) : null,
  };

  // --- Quiz (+ accuracy neighbours) ----------------------------------------
  const quizRows = (quizRow as any[]) ?? [];
  const myQuiz = quizRows.find((q) => q.player_id === playerId);
  const acc = (q: any) => (num(q.answered) > 0 ? Math.round((num(q.correct) / num(q.answered)) * 100) : 0);
  // Rank only players who actually answered — a 0/0 isn't a real accuracy.
  const quizRanked = quizRows
    .filter((q) => num(q.answered) > 0)
    .map((q) => ({ ...q, acc: acc(q) }))
    .sort(
      (a, b) =>
        b.acc - a.acc ||
        num(b.correct) - num(a.correct) ||
        String(a.player_id).localeCompare(String(b.player_id)),
    );
  const qIdx = quizRanked.findIndex((q) => q.player_id === playerId);
  const toQN = (q: any): VarQuizNeighbor => ({ name: q.display_name, avatar: q.avatar ?? null, accuracy: q.acc });
  const quiz = {
    answered: num(myQuiz?.answered),
    correct: num(myQuiz?.correct),
    points: num(myQuiz?.total_points),
    accuracy: myQuiz ? acc(myQuiz) : 0,
    fieldAccuracy: quizRanked.length
      ? Math.round(quizRanked.reduce((s, q) => s + q.acc, 0) / quizRanked.length)
      : 0,
    neighbors: {
      above: qIdx > 0 ? toQN(quizRanked[qIdx - 1]) : null,
      below: qIdx >= 0 && qIdx < quizRanked.length - 1 ? toQN(quizRanked[qIdx + 1]) : null,
    },
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
    standings,
    best,
    genius,
    soulmate,
    topTeam,
    field,
    predNeighbors,
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
