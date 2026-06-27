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
      .select(
        "id,home_team,away_team,home_code,away_code,kickoff_at,stage,group_name,status,home_score,away_score",
      );
    type ExistingRow = NonNullable<typeof existing>[number];
    const keyFor = (h: string, a: string, k: string) =>
      `${h.toLowerCase()}|${a.toLowerCase()}|${new Date(k).toISOString().slice(0, 10)}`;
    const byKey = new Map<string, ExistingRow>();
    const byId = new Map<string, ExistingRow>();
    (existing ?? []).forEach((m) => {
      byKey.set(keyFor(m.home_team, m.away_team, m.kickoff_at), m);
      byId.set(m.id, m);
    });

    // ESPN is the source of truth for final scores. football-data.org has
    // shipped incorrect finals (e.g. Iran-Egypt 1-1 reported as 2-1). For
    // any match ESPN reports as completed, override the upstream score with
    // ESPN's. Keyed by linked_match_id AND (home, away, date) tuple so it
    // works even when the ESPN row hasn't been linked yet.
    const { data: espnFinals } = await supabaseAdmin
      .from("espn_matches")
      .select("home_team,away_team,home_score,away_score,kickoff_at,completed,linked_match_id")
      .eq("completed", true);
    const espnByLinkedId = new Map<string, { home: number; away: number }>();
    const espnByKey = new Map<string, { home: number; away: number }>();
    for (const e of (espnFinals as Array<{
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
      kickoff_at: string;
      completed: boolean;
      linked_match_id: string | null;
    }> | null) ?? []) {
      if (e.home_score === null || e.away_score === null) continue;
      const score = { home: e.home_score, away: e.away_score };
      if (e.linked_match_id) espnByLinkedId.set(e.linked_match_id, score);
      espnByKey.set(keyFor(e.home_team, e.away_team, e.kickoff_at), score);
    }

    // Resolve upstream rows against existing ones, applying two guards:
    //   1) Once a match is FINISHED in our DB, never downgrade its status or
    //      null-out its scores from upstream. This is the root cause of the
    //      duplicate-notification flap we saw on Canada–Bosnia.
    //   2) Only include rows in the upsert payload when at least one tracked
    //      field actually changed — keeps the matches_emit_finished trigger
    //      from firing on no-op writes.
    const tracked = [
      "home_team",
      "away_team",
      "home_code",
      "away_code",
      "kickoff_at",
      "stage",
      "group_name",
      "status",
      "home_score",
      "away_score",
    ] as const;
    type Tracked = (typeof tracked)[number];
    function sameKickoff(a: string, b: string) {
      return new Date(a).getTime() === new Date(b).getTime();
    }

    const merged: DbMatch[] = [];
    const toUpsert: DbMatch[] = [];
    let skippedFinished = 0;
    let skippedUnchanged = 0;

    for (const r of rows) {
      const matchedExisting = byKey.get(keyFor(r.home_team, r.away_team, r.kickoff_at));
      const resolved: DbMatch = matchedExisting ? { ...r, id: matchedExisting.id } : r;
      merged.push(resolved);

      const prior = byId.get(resolved.id) ?? matchedExisting ?? null;

      let candidate: DbMatch = resolved;
      if (
        prior &&
        prior.status === "FINISHED" &&
        prior.home_score !== null &&
        prior.away_score !== null
      ) {
        const downgrade =
          candidate.status !== "FINISHED" ||
          candidate.home_score === null ||
          candidate.away_score === null;
        if (downgrade) {
          candidate = {
            ...candidate,
            status: "FINISHED",
            home_score: prior.home_score,
            away_score: prior.away_score,
          };
          skippedFinished++;
        }
      }

      if (prior) {
        const changed = tracked.some((k: Tracked) => {
          const a = (candidate as unknown as Record<string, unknown>)[k];
          const b = (prior as unknown as Record<string, unknown>)[k];
          if (k === "kickoff_at" && typeof a === "string" && typeof b === "string") {
            return !sameKickoff(a, b);
          }
          return a !== b;
        });
        if (!changed) {
          skippedUnchanged++;
          continue;
        }
      }
      toUpsert.push(candidate);
    }

    if (toUpsert.length > 0) {
      const { error } = await supabaseAdmin.from("matches").upsert(toUpsert, { onConflict: "id" });
      if (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500 });
      }
    }


    // Detect truly new SCHEDULED matches with a future kickoff and fire
    // "new fixtures" pushes to every subscribed player who hasn't been
    // notified about them yet. Fire-and-forget — never blocks the sync.
    try {
      const existingIds = new Set((existing ?? []).map((m) => m.id));
      const nowIso = new Date().toISOString();
      const newMatches = merged.filter(
        (m) =>
          !existingIds.has(m.id) &&
          m.status === "SCHEDULED" &&
          new Date(m.kickoff_at).getTime() > Date.now(),
      );
      if (newMatches.length > 0) {
        await dispatchNewFixturePushes(
          newMatches.map((m) => m.id),
          nowIso,
        );
      }
    } catch (e) {
      console.error("new-fixture push dispatch failed", e);
    }

    return Response.json({
      ok: true,
      synced: toUpsert.length,
      scanned: merged.length,
      skipped_unchanged: skippedUnchanged,
      skipped_finished_downgrade: skippedFinished,
      source,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

async function dispatchNewFixturePushes(newMatchIds: string[], nowIso: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPushToPlayers } = await import("@/lib/webpush.server");

  // Get every player who has at least one push subscription
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("player_id");
  const playerIds = Array.from(new Set((subs ?? []).map((s) => s.player_id)));
  if (playerIds.length === 0) return;

  // For each player, find matches in newMatchIds that they:
  //  - haven't been notified about (push_seen_matches)
  //  - haven't predicted (predictions)
  const { data: seen } = await supabaseAdmin
    .from("push_seen_matches")
    .select("player_id, match_id")
    .in("player_id", playerIds)
    .in("match_id", newMatchIds);
  const seenSet = new Set((seen ?? []).map((r) => `${r.player_id}|${r.match_id}`));

  const { data: preds } = await supabaseAdmin
    .from("predictions")
    .select("player_id, match_id")
    .in("player_id", playerIds)
    .in("match_id", newMatchIds);
  const predSet = new Set((preds ?? []).map((r) => `${r.player_id}|${r.match_id}`));

  const inserts: { player_id: string; match_id: string; notified_at: string }[] = [];

  for (const pid of playerIds) {
    const fresh = newMatchIds.filter(
      (mid) => !seenSet.has(`${pid}|${mid}`) && !predSet.has(`${pid}|${mid}`),
    );
    if (fresh.length === 0) continue;
    const body =
      fresh.length === 1
        ? "1 new match — tap to make your pick"
        : `${fresh.length} new matches — tap to make your picks`;
    void sendPushToPlayers([pid], {
      title: "New matches added",
      body,
      url: "/",
      tag: "new-fixtures",
    });
    for (const mid of fresh) {
      inserts.push({ player_id: pid, match_id: mid, notified_at: nowIso });
    }
  }

  if (inserts.length > 0) {
    await supabaseAdmin.from("push_seen_matches").upsert(inserts, {
      onConflict: "player_id,match_id",
    });
  }
}
