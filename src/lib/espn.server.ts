// Single adapter for ESPN's public, undocumented FIFA World Cup feed.
// Everything that knows about ESPN URLs / shapes lives here. Callers get
// normalized rows ready for upsert and never touch raw JSON.
//
// Endpoints (verified live for 2026):
//   scoreboard: site/v2/sports/soccer/fifa.world/scoreboard
//   standings:  apis/v2/sports/soccer/fifa.world/standings  (note: NOT site/v2)

import { codeForTeam } from "@/lib/teams";
import { americanToDecimal } from "@/lib/odds";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings";
const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary";

const TIMEOUT_MS = 9000;

export type EspnMatchRow = {
  id: string;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  home_logo: string | null;
  away_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
  state: "pre" | "in" | "post";
  completed: boolean;
  clock_display: string | null;
  status_detail: string | null;
  group_label: string | null;
  stage: string | null;
  odds_provider: string | null;
  odds_home_decimal: number | null;
  odds_draw_decimal: number | null;
  odds_away_decimal: number | null;
  odds_updated_at: string | null;
  is_knockout: boolean;
  advanced_side: "home" | "away" | null;
};

export type EspnEventRow = {
  match_id: string;
  idx: number;
  type_text: string;
  clock_display: string | null;
  team_code: string | null;
  athlete_name: string | null;
  is_scoring_play: boolean;
  is_penalty: boolean;
  is_own_goal: boolean;
  payload: unknown;
};

export type EspnStandingRow = {
  group_label: string;
  team_code: string;
  team_name: string;
  team_logo: string | null;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  rank: number | null;
};

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`ESPN ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function asObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}
function asArr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
function asStr(x: unknown): string | null {
  return typeof x === "string" && x.length ? x : null;
}
function asNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string" && x.trim() !== "" && !Number.isNaN(Number(x))) return Number(x);
  return null;
}

// "FIFA World Cup, Group A" → "Group A"
function tidyGroup(note: string | null): string | null {
  if (!note) return null;
  const m = note.match(/Group\s+[A-Z0-9]+/i);
  return m ? m[0] : note;
}

// Knockout detection: no "Group X" altGameNote AND the season/competition
// label doesn't look like the group stage. We're conservative — anything we
// can't tell is treated as group-stage so existing scoring keeps applying.
function detectKnockout(
  comp: Record<string, unknown>,
  ev: Record<string, unknown>,
  seasonSlug: string | null,
): boolean {
  const note = asStr(comp.altGameNote) ?? asStr(comp.notes) ?? "";
  if (/Group\s+[A-Z0-9]/i.test(note)) return false;
  const labels = [
    note,
    asStr(asObj(ev.season).slug) ?? "",
    seasonSlug ?? "",
    asStr(asObj(asObj(comp.status).type).description) ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return /(round of|knockout|final|quarter|semi|playoff)/.test(labels);
}

export async function fetchScoreboard(dateRange?: { from: string; to: string }): Promise<{
  matches: EspnMatchRow[];
  events: EspnEventRow[];
}> {
  const url = dateRange
    ? `${SCOREBOARD}?dates=${dateRange.from}-${dateRange.to}&limit=200`
    : `${SCOREBOARD}?limit=200`;
  const json = await fetchJson(url);
  const events = asArr(asObj(json).events);

  const matches: EspnMatchRow[] = [];
  const allEvents: EspnEventRow[] = [];

  for (const ev of events) {
    const e = asObj(ev);
    const id = asStr(e.id);
    if (!id) continue;
    const competitions = asArr(e.competitions);
    const comp = asObj(competitions[0]);
    const competitors = asArr(comp.competitors);
    const homeC = asObj(competitors.find((c) => asObj(c).homeAway === "home"));
    const awayC = asObj(competitors.find((c) => asObj(c).homeAway === "away"));
    const homeTeam = asObj(homeC.team);
    const awayTeam = asObj(awayC.team);
    const home_team = asStr(homeTeam.displayName) ?? asStr(homeTeam.name) ?? "";
    const away_team = asStr(awayTeam.displayName) ?? asStr(awayTeam.name) ?? "";
    if (!home_team || !away_team) continue;

    const status = asObj(asObj(comp.status).type);
    const stateRaw = asStr(status.state) ?? "pre";
    const state: EspnMatchRow["state"] =
      stateRaw === "in" ? "in" : stateRaw === "post" ? "post" : "pre";

    const odds = parseOdds(comp);

    const row: EspnMatchRow = {
      id,
      home_team,
      away_team,
      home_code: codeForTeam(home_team),
      away_code: codeForTeam(away_team),
      home_logo: asStr(homeTeam.logo),
      away_logo: asStr(awayTeam.logo),
      home_score: asNum(homeC.score),
      away_score: asNum(awayC.score),
      kickoff_at: asStr(e.date) ?? asStr(comp.date) ?? new Date().toISOString(),
      state,
      completed: !!asObj(comp.status).type && asObj(asObj(comp.status).type).completed === true,
      clock_display: asStr(asObj(comp.status).displayClock),
      status_detail: asStr(status.shortDetail) ?? asStr(status.detail),
      group_label: tidyGroup(asStr(comp.altGameNote) ?? asStr(comp.notes)),
      stage: asStr(asObj(e.season).slug) ?? null,
      odds_provider: odds.provider,
      odds_home_decimal: odds.home,
      odds_draw_decimal: odds.draw,
      odds_away_decimal: odds.away,
      odds_updated_at: odds.home !== null || odds.draw !== null || odds.away !== null
        ? new Date().toISOString()
        : null,
      is_knockout: detectKnockout(comp, e, asStr(asObj(e.season).slug)),
      advanced_side:
        state === "post"
          ? (asObj(homeC).winner === true
              ? "home"
              : asObj(awayC).winner === true
                ? "away"
                : null)
          : null,
    };
    matches.push(row);

    const details = asArr(comp.details);
    details.forEach((d, idx) => {
      const det = asObj(d);
      const type = asObj(det.type);
      const type_text = asStr(type.text) ?? asStr(type.id) ?? "Event";
      const athletes = asArr(det.athletesInvolved);
      const athlete_name = asStr(asObj(athletes[0]).displayName);
      const teamRef = asObj(det.team);
      const teamId = asStr(teamRef.id);
      // Team for the event is one of the two competitors; map id → code
      let team_code: string | null = null;
      if (teamId) {
        const teamHomeId = asStr(homeTeam.id);
        const teamAwayId = asStr(awayTeam.id);
        if (teamId === teamHomeId) team_code = row.home_code;
        else if (teamId === teamAwayId) team_code = row.away_code;
      }
      allEvents.push({
        match_id: id,
        idx,
        type_text,
        clock_display: asStr(asObj(det.clock).displayValue),
        team_code,
        athlete_name,
        is_scoring_play: !!det.scoringPlay,
        is_penalty: !!det.penaltyKick,
        is_own_goal: !!det.ownGoal,
        payload: det,
      });
    });
  }

  return { matches, events: allEvents };
}

// ESPN exposes 1X2 odds under competitions[].odds[0] with American prices in
// moneyLine.{home,away,draw}.odds. Draw is sometimes mirrored at
// drawOdds.moneyLine. Many matches return [] until a few days before kickoff.
function parseOdds(comp: Record<string, unknown>): {
  provider: string | null;
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const oddsArr = asArr(comp.odds);
  if (!oddsArr.length) return { provider: null, home: null, draw: null, away: null };
  const first = asObj(oddsArr[0]);
  const provider = asStr(asObj(first.provider).name);
  // ESPN ships 1X2 odds under two different shapes depending on the endpoint:
  //   - scoreboard: odds[0].moneyline.{home,away,draw}.current.odds  (American as string)
  //   - older/legacy: odds[0].moneyLine.{home,away}.{odds|moneyLine} + drawOdds.moneyLine
  // Read both so the parser keeps working if ESPN flips it back.
  const sideAmerican = (side: "home" | "away" | "draw"): number | string | null | undefined => {
    const ml = asObj(first.moneyline);
    const node = asObj(ml[side]);
    // Prefer live (current), fall back to close → open for matches that
    // aren't actively trading yet (ESPN nulls `current` until kickoff day).
    for (const bucket of ["current", "close", "open"] as const) {
      const v = asObj(node[bucket]).odds;
      if (v !== undefined && v !== null) return v as number | string;
    }
    const mlOld = asObj(first.moneyLine);
    const oldNode = asObj(mlOld[side]);
    const fromOld = oldNode.odds ?? oldNode.moneyLine;
    if (fromOld !== undefined && fromOld !== null) return fromOld as number | string;
    if (side === "draw") return asObj(first.drawOdds).moneyLine as number | string | null;
    return null;
  };
  return {
    provider,
    home: americanToDecimal(sideAmerican("home")),
    draw: americanToDecimal(sideAmerican("draw")),
    away: americanToDecimal(sideAmerican("away")),
  };
}

export async function fetchStandings(): Promise<EspnStandingRow[]> {
  const json = await fetchJson(STANDINGS);
  // Two known shapes: { children: [{ name, standings: { entries: [...] } }] }
  //                    or { standings: { entries: [...] } } (no groups)
  const root = asObj(json);
  const groups: { name: string; entries: unknown[] }[] = [];

  const children = asArr(root.children);
  if (children.length) {
    for (const g of children) {
      const go = asObj(g);
      const name = asStr(go.name) ?? asStr(go.displayName) ?? "Group";
      const entries = asArr(asObj(go.standings).entries);
      groups.push({ name: tidyGroup(name) ?? name, entries });
    }
  } else {
    const entries = asArr(asObj(root.standings).entries);
    if (entries.length) groups.push({ name: "Overall", entries });
  }

  const out: EspnStandingRow[] = [];
  for (const g of groups) {
    for (const entry of g.entries) {
      const en = asObj(entry);
      const team = asObj(en.team);
      const team_name = asStr(team.displayName) ?? asStr(team.name);
      if (!team_name) continue;
      const team_code = codeForTeam(team_name) ?? asStr(team.abbreviation) ?? team_name.slice(0, 3).toUpperCase();
      const stats = asArr(en.stats);
      const stat = (key: string): number => {
        const s = stats.find((x) => {
          const o = asObj(x);
          return o.name === key || o.abbreviation === key || o.type === key;
        });
        return asNum(asObj(s).value) ?? 0;
      };
      const gf = stat("pointsFor");
      const ga = stat("pointsAgainst");
      const w = stat("wins");
      const d = stat("ties");
      const l = stat("losses");
      const pts = stat("points") || w * 3 + d;
      const gp = stat("gamesPlayed") || w + d + l;
      const gd = stat("pointDifferential") || gf - ga;
      const rank = asNum(en.rank);
      out.push({
        group_label: g.name,
        team_code,
        team_name,
        team_logo: asStr(team.logo) ?? asStr(team.logos && asArr(team.logos)[0] && asObj(asArr(team.logos)[0]).href),
        gp,
        w,
        d,
        l,
        gf,
        ga,
        gd,
        pts,
        rank: rank ?? null,
      });
    }
  }
  return out;
}

// --- Match lineups -------------------------------------------------------

export type EspnLineupPlayer = {
  team_code: string;
  team_side: "home" | "away";
  idx: number;
  full_name: string;
  jersey_number: number | null;
  position: string | null;
  is_starter: boolean;
  captain: boolean;
  formation: string | null;
  espn_player_id: string | null;
};

// ESPN publishes the starting sheet + bench under summary?event={id} once
// the lineups drop (~15-30 minutes before kickoff). Return normalized rows
// per team; caller writes them to public.match_lineups.
export async function fetchMatchSummary(eventId: string): Promise<EspnLineupPlayer[]> {
  const url = `${SUMMARY}?event=${encodeURIComponent(eventId)}`;
  const json = await fetchJson(url);
  const root = asObj(json);
  const rosters = asArr(root.rosters);
  if (rosters.length === 0) return [];

  const out: EspnLineupPlayer[] = [];
  for (const r of rosters) {
    const ro = asObj(r);
    const teamObj = asObj(ro.team);
    const teamName = asStr(teamObj.displayName) ?? asStr(teamObj.name) ?? "";
    const teamCode = codeForTeam(teamName) ?? asStr(teamObj.abbreviation) ?? "";
    if (!teamCode) continue;
    const side: "home" | "away" = asStr(ro.homeAway) === "away" ? "away" : "home";
    const formation = asStr(asObj(ro.formation).name);
    const players = asArr(ro.roster);
    let idx = 0;
    for (const p of players) {
      const po = asObj(p);
      const playerObj = asObj(po.athlete ?? po.player);
      const name = asStr(playerObj.displayName) ?? asStr(playerObj.fullName) ?? asStr(playerObj.shortName);
      if (!name) continue;
      const jerseyRaw = asStr(playerObj.jersey) ?? asStr(po.jersey);
      const jersey = jerseyRaw ? parseInt(jerseyRaw.replace(/\D/g, ""), 10) : null;
      const posAbbr = asStr(asObj(playerObj.position).abbreviation)
        ?? asStr(asObj(po.position).abbreviation)
        ?? asStr(asObj(playerObj.position).name);
      out.push({
        team_code: teamCode.toUpperCase(),
        team_side: side,
        idx: idx++,
        full_name: name,
        jersey_number: Number.isFinite(jersey) ? jersey : null,
        position: posAbbr,
        is_starter: po.starter === true,
        captain: po.captain === true || playerObj.captain === true,
        formation,
        espn_player_id: asStr(playerObj.id),
      });
    }
  }
  return out;
}
