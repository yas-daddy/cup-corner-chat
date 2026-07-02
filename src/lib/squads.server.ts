// Wikipedia squad-parser. The master article "2026 FIFA World Cup squads"
// lists every nation's 26-player squad under a section per team, using the
// {{fs player|...}} template. We fetch the raw wikitext via Wikipedia's
// action=parse API (which needs no key) and pull out the templates with
// regex — the template is single-line, well-formed, and stable across squads.
//
// If the master article isn't available (early in the tournament cycle),
// caller should gracefully return zero rows and log a warning.

import { codeForTeam } from "@/lib/teams";

const MASTER_ARTICLE = "2026_FIFA_World_Cup_squads";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const TIMEOUT_MS = 15000;

export type SquadPlayerRow = {
  id: string;
  team_code: string;
  full_name: string;
  display_name: string | null;
  jersey_number: number | null;
  position: "GK" | "D" | "M" | "F" | null;
  club: string | null;
  club_country_code: string | null;
  image_url: string | null;
  dob: string | null;
  height_cm: number | null;
  captain: boolean;
};

async function fetchWikitext(page: string): Promise<string> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2&origin=*`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${page}`);
    const json = (await res.json()) as { parse?: { wikitext?: string } };
    return json.parse?.wikitext ?? "";
  } finally {
    clearTimeout(t);
  }
}

// Split the master article into per-team sections keyed by canonical
// team name. The article uses "=== TeamName ===" headers.
function splitByTeam(wikitext: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = wikitext.split("\n");
  let currentTeam: string | null = null;
  let buffer: string[] = [];
  const commit = () => {
    if (currentTeam) out.set(currentTeam, buffer.join("\n"));
  };
  for (const line of lines) {
    // Match "== TeamName ==" (level-2) or "=== TeamName ===" (level-3).
    const m = line.match(/^={2,3}\s*([^=]+?)\s*={2,3}\s*$/);
    if (m) {
      commit();
      currentTeam = m[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  commit();
  return out;
}

// Pull a single |name=value| pair from a template body. Handles wikilinks
// like [[Real Madrid]] or [[Real Madrid|Real Madrid CF]] on the value side.
function paramFromTemplate(body: string, name: string): string | null {
  // Values run from |name= up to the next unescaped | or }} at brace-depth 0.
  const re = new RegExp(`\\|\\s*${name}\\s*=`, "i");
  const m = body.match(re);
  if (!m) return null;
  const start = (m.index ?? 0) + m[0].length;
  let depth = 0;
  let squareDepth = 0;
  let end = start;
  for (; end < body.length; end++) {
    const c = body[end];
    if (c === "{" && body[end + 1] === "{") depth++;
    else if (c === "}" && body[end + 1] === "}") depth--;
    else if (c === "[" && body[end + 1] === "[") squareDepth++;
    else if (c === "]" && body[end + 1] === "]") squareDepth--;
    else if (c === "|" && depth === 0 && squareDepth === 0) break;
    else if (c === "}" && body[end + 1] === "}" && depth < 0) break;
  }
  return body.slice(start, end).trim();
}

// Strip wikilinks: [[Text]] -> Text, [[Link|Text]] -> Text. Also drop
// template noise like {{flagicon|USA}}.
function stripWiki(raw: string | null): string | null {
  if (raw == null) return null;
  let s = raw;
  // Remove templates entirely — flagicon etc.
  s = s.replace(/\{\{[^{}]*\}\}/g, "");
  // [[Target|Text]] -> Text
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  // [[Text]] -> Text
  s = s.replace(/\[\[([^\]|]+)\]\]/g, "$1");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/'{2,}/g, "");
  return s.trim() || null;
}

const POSITION_MAP: Record<string, "GK" | "D" | "M" | "F"> = {
  GK: "GK",
  DF: "D",
  MF: "M",
  FW: "F",
  D: "D",
  M: "M",
  F: "F",
  "1-GK": "GK",
  "2-DF": "D",
  "3-MF": "M",
  "4-FW": "F",
};

function normalisePosition(raw: string | null): "GK" | "D" | "M" | "F" | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return POSITION_MAP[key] ?? null;
}

// Detect a flagicon in the club column so we can capture the club's
// country. Value looks like: {{flagicon|USA}} [[Inter Miami CF]]
function extractClubCountry(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/\{\{\s*(?:flagicon|flagIcon|fb)\s*\|\s*([A-Za-z]{2,4})/);
  return m ? m[1].toUpperCase() : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract every {{fs player|...}} template body from a wikitext section.
function extractFsPlayers(sectionText: string): string[] {
  const out: string[] = [];
  const marker = "{{fs player";
  let i = 0;
  const lower = sectionText.toLowerCase();
  while (true) {
    const start = lower.indexOf(marker, i);
    if (start === -1) break;
    // Find matching }} respecting nested {{ }}.
    let depth = 1;
    let j = start + marker.length;
    for (; j < sectionText.length && depth > 0; j++) {
      const c = sectionText[j];
      if (c === "{" && sectionText[j + 1] === "{") {
        depth++;
        j++;
      } else if (c === "}" && sectionText[j + 1] === "}") {
        depth--;
        j++;
      }
    }
    if (depth === 0) {
      out.push(sectionText.slice(start, j));
      i = j;
    } else {
      break;
    }
  }
  return out;
}

function parseFsPlayerTemplate(
  template: string,
  teamCode: string,
): SquadPlayerRow | null {
  const body = template.replace(/^\{\{fs player/i, "").replace(/\}\}$/, "");
  const number = paramFromTemplate(body, "no");
  const pos = paramFromTemplate(body, "pos");
  const name = stripWiki(paramFromTemplate(body, "name"));
  const club = stripWiki(paramFromTemplate(body, "club"));
  const clubRaw = paramFromTemplate(body, "club");
  const clubnat = paramFromTemplate(body, "clubnat");
  const birthRaw = paramFromTemplate(body, "birth_date");
  const captainMarker = /\b(captain|C\)|\(c\))/i.test(body);

  if (!name) return null;

  const jersey = number ? parseInt(number.replace(/\D/g, ""), 10) : null;
  const position = normalisePosition(pos);

  // Try to derive DOB from a {{Birth date and age|1998|9|18}} block or
  // just a "yyyy-mm-dd" string.
  let dob: string | null = null;
  if (birthRaw) {
    const bd = birthRaw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (bd) {
      const y = bd[1];
      const m = bd[2].padStart(2, "0");
      const d = bd[3].padStart(2, "0");
      dob = `${y}-${m}-${d}`;
    }
  }

  return {
    id: `wiki:${teamCode}:${slugify(name)}`,
    team_code: teamCode,
    full_name: name,
    display_name: null,
    jersey_number: Number.isFinite(jersey) ? jersey : null,
    position,
    club,
    club_country_code:
      (clubnat && stripWiki(clubnat)?.toUpperCase()) || extractClubCountry(clubRaw),
    image_url: null,
    dob,
    height_cm: null,
    captain: captainMarker,
  };
}

// Map Wikipedia team-section name to our canonical team_code.
function teamCodeFor(sectionName: string): string | null {
  return codeForTeam(sectionName);
}

export async function fetchAllSquads(): Promise<{
  players: SquadPlayerRow[];
  teams: number;
  missedSections: string[];
}> {
  const wikitext = await fetchWikitext(MASTER_ARTICLE);
  const sections = splitByTeam(wikitext);

  const players: SquadPlayerRow[] = [];
  const missed: string[] = [];
  let teamsSynced = 0;

  for (const [name, section] of sections) {
    const code = teamCodeFor(name);
    if (!code) {
      // Skip meta sections like "Squads" or "Group A".
      if (!/^(Group\s|Squads|References|Notes|See also|External)/i.test(name)) {
        missed.push(name);
      }
      continue;
    }
    const templates = extractFsPlayers(section);
    if (templates.length === 0) continue;
    let added = 0;
    for (const tpl of templates) {
      const row = parseFsPlayerTemplate(tpl, code);
      if (row) {
        players.push(row);
        added++;
      }
    }
    if (added > 0) teamsSynced++;
  }

  return { players, teams: teamsSynced, missedSections: missed };
}
