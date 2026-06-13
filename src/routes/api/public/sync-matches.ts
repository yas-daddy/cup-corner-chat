import { createFileRoute } from "@tanstack/react-router";
import { codeForTeam } from "@/lib/teams";

type DbMatch = {
  id: string;
  home_team: string;
  away_team: string;
  home_code: string | null;
  away_code: string | null;
  kickoff_at: string;
  stage: string | null;
  group_name: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  last_synced_at: string;
};

function mapStatus(s: string): string {
  const u = (s || "").toUpperCase();
  if (["IN_PLAY", "LIVE", "PAUSED"].includes(u)) return "LIVE";
  if (u === "FINISHED") return "FINISHED";
  return "SCHEDULED";
}

async function fetchFromFootballData(apiKey: string): Promise<DbMatch[]> {
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": apiKey },
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);
  const json = (await res.json()) as {
    matches?: Array<{
      id: number;
      utcDate: string;
      status: string;
      stage?: string;
      group?: string;
      homeTeam?: { name?: string };
      awayTeam?: { name?: string };
      score?: { fullTime?: { home?: number | null; away?: number | null } };
    }>;
  };
  const matches = json.matches ?? [];
  const now = new Date().toISOString();
  return matches
    .filter((m) => m.homeTeam?.name && m.awayTeam?.name && m.utcDate)
    .map((m) => {
      const home = m.homeTeam!.name!;
      const away = m.awayTeam!.name!;
      return {
        id: `fd:${m.id}`,
        home_team: home,
        away_team: away,
        home_code: codeForTeam(home),
        away_code: codeForTeam(away),
        kickoff_at: m.utcDate,
        stage: m.stage ?? null,
        group_name: m.group ?? null,
        status: mapStatus(m.status),
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        last_synced_at: now,
      };
    });
}

async function fetchFromOpenFootball(): Promise<DbMatch[]> {
  // Static public-domain dataset. May 404 if not yet published; caller handles.
  const urls = [
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/all.json",
  ];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = (await res.json()) as {
      matches?: Array<{
        num?: number;
        date: string;
        time?: string;
        team1: { name: string; code?: string };
        team2: { name: string; code?: string };
        group?: string;
        stage?: string;
        score?: { ft?: [number, number] };
      }>;
    };
    const ms = json.matches ?? [];
    const now = new Date().toISOString();
    return ms.map((m, i) => {
      const kickoff = new Date(`${m.date}T${m.time ?? "12:00"}:00Z`).toISOString();
      const finished = !!m.score?.ft;
      return {
        id: `of:${m.num ?? i}`,
        home_team: m.team1.name,
        away_team: m.team2.name,
        home_code: codeForTeam(m.team1.name) ?? m.team1.code ?? null,
        away_code: codeForTeam(m.team2.name) ?? m.team2.code ?? null,
        kickoff_at: kickoff,
        stage: m.stage ?? null,
        group_name: m.group ?? null,
        status: finished ? "FINISHED" : new Date(kickoff).getTime() < Date.now() ? "LIVE" : "SCHEDULED",
        home_score: m.score?.ft?.[0] ?? null,
        away_score: m.score?.ft?.[1] ?? null,
        last_synced_at: now,
      };
    });
  }
  return [];
}

export const Route = createFileRoute("/api/public/sync-matches")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  try {
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;
    let rows: DbMatch[] = [];
    let source = "none";
    if (apiKey) {
      try {
        rows = await fetchFromFootballData(apiKey);
        source = "football-data.org";
      } catch (e) {
        console.error("football-data fetch failed", e);
      }
    }
    if (rows.length === 0) {
      rows = await fetchFromOpenFootball();
      source = source === "none" ? "openfootball" : source;
    }

    if (rows.length === 0) {
      return Response.json({ ok: true, synced: 0, source, note: "No upstream data available yet" });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Merge by (home_team, away_team, kickoff date) to avoid duplicating rows
    // that were backfilled with non-upstream ids (e.g. "wc26:*").
    const { data: existing } = await supabaseAdmin
      .from("matches")
      .select("id,home_team,away_team,kickoff_at");
    const keyFor = (h: string, a: string, k: string) =>
      `${h.toLowerCase()}|${a.toLowerCase()}|${new Date(k).toISOString().slice(0, 10)}`;
    const idByKey = new Map<string, string>();
    (existing ?? []).forEach((m) => idByKey.set(keyFor(m.home_team, m.away_team, m.kickoff_at), m.id));

    const merged = rows.map((r) => {
      const existingId = idByKey.get(keyFor(r.home_team, r.away_team, r.kickoff_at));
      return existingId ? { ...r, id: existingId } : r;
    });

    const { error } = await supabaseAdmin.from("matches").upsert(merged, { onConflict: "id" });
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true, synced: merged.length, source });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
