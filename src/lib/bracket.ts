// WC2026 knockout bracket: structure + slot resolver.
//
// Pipeline:
//   1. WC2026_BRACKET defines every match from R32 through Final + 3rd-place
//      playoff using FIFA's official match numbers (M73–M104). Each match
//      has two slots referencing either a group position (e.g. "Winner
//      Group A"), one of the 8 best 3rd-placed teams, or the winner / loser
//      of another bracket match.
//   2. resolveBracket(standings, matches) walks the tree and replaces every
//      slot it can with a concrete team. Anything not yet known stays as a
//      human-readable placeholder.
//
// R32 pairings, R16 cross-bracket layout (it's NOT sequential winner pairs),
// and onward structure all match FIFA's published 2026 bracket — sourced
// from FIFA / bracketmundial2026 / match-later.

export type GroupSlot = { type: "group"; rank: 1 | 2; group: string };
// Third-place slots in the R32 are conditional on which 8 of the 12 thirds
// qualify: each slot has a fixed set of "allowed" groups, and FIFA's lookup
// table resolves the actual team after group stage ends. For now we display
// the allowed groups; ESPN's R32 fixtures will give us the concrete team
// once knockouts begin and we can backfill from there.
export type ThirdSlot = { type: "third"; allowedGroups: string[] };
export type WinnerSlot = { type: "winner_of"; matchId: string };
export type LoserSlot = { type: "loser_of"; matchId: string };
export type Slot = GroupSlot | ThirdSlot | WinnerSlot | LoserSlot;

export type Round = "R32" | "R16" | "QF" | "SF" | "F" | "3P";

export type BracketMatch = {
  id: string;
  round: Round;
  label: string;
  top: Slot;
  bottom: Slot;
};

const g = (rank: 1 | 2, group: string): GroupSlot => ({ type: "group", rank, group });
const th = (allowedGroups: string): ThirdSlot => ({
  type: "third",
  allowedGroups: allowedGroups.split(""),
});
const w = (matchId: string): WinnerSlot => ({ type: "winner_of", matchId });
const l = (matchId: string): LoserSlot => ({ type: "loser_of", matchId });

type R32Spec = { id: string; top: Slot; bottom: Slot };

// FIFA's published R32 pairings for World Cup 2026 (M73–M88).
const R32: R32Spec[] = [
  { id: "M73", top: g(2, "A"), bottom: g(2, "B") },
  { id: "M74", top: g(1, "E"), bottom: th("ABCDF") },
  { id: "M75", top: g(1, "F"), bottom: g(2, "C") },
  { id: "M76", top: g(1, "C"), bottom: g(2, "F") },
  { id: "M77", top: g(1, "I"), bottom: th("CDFGH") },
  { id: "M78", top: g(2, "E"), bottom: g(2, "I") },
  { id: "M79", top: g(1, "A"), bottom: th("CEFHI") },
  { id: "M80", top: g(1, "L"), bottom: th("EHIJK") },
  { id: "M81", top: g(1, "D"), bottom: th("BEFIJ") },
  { id: "M82", top: g(1, "G"), bottom: th("AEHIJ") },
  { id: "M83", top: g(2, "K"), bottom: g(2, "L") },
  { id: "M84", top: g(1, "H"), bottom: g(2, "J") },
  { id: "M85", top: g(1, "B"), bottom: th("EFGIJ") },
  { id: "M86", top: g(1, "J"), bottom: g(2, "H") },
  { id: "M87", top: g(1, "K"), bottom: th("DEIJL") },
  { id: "M88", top: g(2, "D"), bottom: g(2, "G") },
];

// FIFA's R16 cross-bracket pairings (not consecutive winner pairs).
const R16: Array<[string, string, string]> = [
  ["M89", "M74", "M77"],
  ["M90", "M73", "M75"],
  ["M91", "M76", "M78"],
  ["M92", "M79", "M80"],
  ["M93", "M83", "M84"],
  ["M94", "M81", "M82"],
  ["M95", "M86", "M88"],
  ["M96", "M85", "M87"],
];

const QF: Array<[string, string, string]> = [
  ["M97", "M89", "M90"],
  ["M98", "M93", "M94"],
  ["M99", "M91", "M92"],
  ["M100", "M95", "M96"],
];

const SF: Array<[string, string, string]> = [
  ["M101", "M97", "M98"],
  ["M102", "M99", "M100"],
];

export const WC2026_BRACKET: BracketMatch[] = (() => {
  const out: BracketMatch[] = [];
  for (const m of R32) out.push({ id: m.id, round: "R32", label: m.id, top: m.top, bottom: m.bottom });
  for (const [id, a, b] of R16) out.push({ id, round: "R16", label: id, top: w(a), bottom: w(b) });
  for (const [id, a, b] of QF) out.push({ id, round: "QF", label: id, top: w(a), bottom: w(b) });
  for (const [id, a, b] of SF) out.push({ id, round: "SF", label: id, top: w(a), bottom: w(b) });
  out.push({ id: "M103", round: "3P", label: "M103", top: l("M101"), bottom: l("M102") });
  out.push({ id: "M104", round: "F", label: "Final", top: w("M101"), bottom: w("M102") });
  return out;
})();

// --- Display order ----------------------------------------------------------
//
// The R16/QF/SF arrays above pair matches by FIFA's cross-bracket structure,
// which is NOT sequential (e.g. M89 = winner of M74 + M77, not M73 + M74).
// Rendering the bracket as columns of cards only draws correct connector
// lines if each on-screen adjacent pair (card 0+1, 2+3, ...) is actually the
// pair that feeds the same next-round match. This walks the tree from the
// Final backwards, expanding each match into its two feeder match ids, so
// the resulting order is display-ready: index 2n and 2n+1 always feed the
// same next-round slot.
const BRACKET_CHILDREN: Record<string, [string, string]> = {
  M104: ["M101", "M102"],
  ...Object.fromEntries(SF.map(([id, a, b]) => [id, [a, b] as [string, string]])),
  ...Object.fromEntries(QF.map(([id, a, b]) => [id, [a, b] as [string, string]])),
  ...Object.fromEntries(R16.map(([id, a, b]) => [id, [a, b] as [string, string]])),
};

const ROUND_DEPTH_FROM_FINAL: Round[] = ["F", "SF", "QF", "R16", "R32"];

export const BRACKET_DISPLAY_ORDER: Record<Round, string[]> = (() => {
  const table = {} as Record<Round, string[]>;
  let order = ["M104"];
  for (const round of ROUND_DEPTH_FROM_FINAL) {
    table[round] = order;
    order = order.flatMap((id) => BRACKET_CHILDREN[id] ?? [id]);
  }
  table["3P"] = ["M103"];
  return table;
})();

// --- Resolver -------------------------------------------------------------

export type StandingLite = {
  group_label: string;
  team_code: string;
  team_name: string;
  rank: number | null;
  pts: number;
  gd: number;
  gf: number;
  gp: number;
};

export type MatchLite = {
  state: "pre" | "in" | "post";
  home_code: string | null;
  away_code: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  is_knockout: boolean;
  advanced_side: "home" | "away" | null;
};

export type ResolvedSlot = {
  team_name: string | null;
  team_code: string | null;
  placeholder: string;
};

export type ResolvedMatch = {
  id: string;
  round: Round;
  label: string;
  top: ResolvedSlot;
  bottom: ResolvedSlot;
  winner: ResolvedSlot | null;
  loser: ResolvedSlot | null;
};

export function resolveBracket(standings: StandingLite[], matches: MatchLite[]): ResolvedMatch[] {
  const cache = new Map<string, ResolvedMatch>();
  return WC2026_BRACKET.map((m) => resolveMatch(m, standings, matches, cache));
}

function resolveMatch(
  m: BracketMatch,
  standings: StandingLite[],
  matches: MatchLite[],
  cache: Map<string, ResolvedMatch>,
): ResolvedMatch {
  const cached = cache.get(m.id);
  if (cached) return cached;

  let top = resolveSlot(m.top, standings, matches, cache);
  let bottom = resolveSlot(m.bottom, standings, matches, cache);

  // R32 backfill: once ESPN has scheduled the actual knockout fixtures the
  // FIFA "3rd of A/B/C/D/F" lookup becomes irrelevant — the fixture data is
  // the truth. If one side of an R32 slot is known (e.g. group-stage winner
  // resolved) and there's an ESPN knockout match involving that team, use
  // the ESPN opponent as the other side.
  if (m.round === "R32") {
    const backfill = (known: ResolvedSlot, keepPlaceholder: string): ResolvedSlot | null => {
      if (!known.team_code) return null;
      const em = matches.find(
        (x) =>
          x.is_knockout &&
          (x.home_code === known.team_code || x.away_code === known.team_code),
      );
      if (!em) return null;
      const knownIsHome = em.home_code === known.team_code;
      const opponentCode = knownIsHome ? em.away_code : em.home_code;
      const opponentName = knownIsHome ? em.away_team : em.home_team;
      if (!opponentCode || !opponentName) return null;
      return { team_code: opponentCode, team_name: opponentName, placeholder: keepPlaceholder };
    };
    if (top.team_code && !bottom.team_code) {
      const filled = backfill(top, bottom.placeholder);
      if (filled) bottom = filled;
    } else if (!top.team_code && bottom.team_code) {
      const filled = backfill(bottom, top.placeholder);
      if (filled) top = filled;
    }
  }

  let winner: ResolvedSlot | null = null;
  let loser: ResolvedSlot | null = null;

  if (top.team_code && bottom.team_code) {
    const em = matches.find(
      (x) =>
        x.state === "post" &&
        ((x.home_code === top.team_code && x.away_code === bottom.team_code) ||
          (x.home_code === bottom.team_code && x.away_code === top.team_code)),
    );
    if (em) {
      const topIsHome = em.home_code === top.team_code;
      // Prefer ESPN's advanced_side flag when set — it's the authoritative
      // "who progresses" answer for penalty-decided knockouts where the
      // scoreline stays tied.
      if (em.advanced_side) {
        const topAdvanced =
          (topIsHome && em.advanced_side === "home") ||
          (!topIsHome && em.advanced_side === "away");
        winner = topAdvanced ? top : bottom;
        loser = topAdvanced ? bottom : top;
      } else if (
        em.home_score !== null &&
        em.away_score !== null &&
        em.home_score !== em.away_score
      ) {
        const topScore = topIsHome ? em.home_score : em.away_score;
        const bottomScore = topIsHome ? em.away_score : em.home_score;
        winner = topScore > bottomScore ? top : bottom;
        loser = topScore > bottomScore ? bottom : top;
      }
    }
  }

  const resolved: ResolvedMatch = { id: m.id, round: m.round, label: m.label, top, bottom, winner, loser };
  cache.set(m.id, resolved);
  return resolved;
}

function resolveSlot(
  slot: Slot,
  standings: StandingLite[],
  matches: MatchLite[],
  cache: Map<string, ResolvedMatch>,
): ResolvedSlot {
  if (slot.type === "group") {
    const placeholder = `${slot.rank === 1 ? "Winner" : "Runner-up"} Group ${slot.group}`;
    const rows = standings.filter((s) => groupLetter(s.group_label) === slot.group);
    // Only resolve once every team in the group has played all 3 group games —
    // otherwise current standings are mid-stage and the rank can still flip.
    if (rows.length < 4 || rows.some((r) => r.gp < 3)) {
      return { team_name: null, team_code: null, placeholder };
    }
    const sorted = rows.slice().sort(rankOrPts);
    const r = sorted[slot.rank - 1];
    if (!r) return { team_name: null, team_code: null, placeholder };
    return { team_name: r.team_name, team_code: r.team_code, placeholder };
  }

  if (slot.type === "third") {
    // FIFA's lookup table decides which group's 3rd ends up here. Until the
    // R32 fixtures lock in (and we can backfill from ESPN), just surface the
    // allowed groups so it's clear what the slot represents.
    const placeholder = `3rd of ${slot.allowedGroups.join("/")}`;
    return { team_name: null, team_code: null, placeholder };
  }

  if (slot.type === "winner_of") {
    const placeholder = `Winner ${slot.matchId}`;
    const m = WC2026_BRACKET.find((x) => x.id === slot.matchId);
    if (!m) return { team_name: null, team_code: null, placeholder };
    const resolved = resolveMatch(m, standings, matches, cache);
    if (resolved.winner) return resolved.winner;
    return { team_name: null, team_code: null, placeholder };
  }

  // loser_of
  const placeholder = `Loser ${slot.matchId}`;
  const m = WC2026_BRACKET.find((x) => x.id === slot.matchId);
  if (!m) return { team_name: null, team_code: null, placeholder };
  const resolved = resolveMatch(m, standings, matches, cache);
  if (resolved.loser) return resolved.loser;
  return { team_name: null, team_code: null, placeholder };
}

function rankOrPts(a: StandingLite, b: StandingLite) {
  if (a.rank != null && b.rank != null && a.rank !== b.rank) return a.rank - b.rank;
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf;
}

function groupLetter(label: string): string {
  const m = label.match(/Group\s+([A-Z])/i);
  return m ? m[1].toUpperCase() : label;
}
