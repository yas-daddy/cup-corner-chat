import { createFileRoute } from "@tanstack/react-router";
import { fetchScoreboard, fetchStandings } from "@/lib/espn.server";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function authorize(request: Request) {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  const got =
    request.headers.get("apikey") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return !!expected && got === expected;
}

// Window: yesterday → +14 days, ESPN format YYYYMMDD
function dateWindow() {
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return { from: fmt(from), to: fmt(to) };
}

export const Route = createFileRoute("/api/public/sync-espn")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const result: Record<string, unknown> = { ok: true };

  try {
    const { matches, events } = await fetchScoreboard(dateWindow());
    if (matches.length) {
      const nowIso = new Date().toISOString();
      const rows = matches.map((m) => ({ ...m, last_synced_at: nowIso }));

      // Try to link each ESPN row to an existing matches.id by (home, away, date).
      // Best-effort — no FK requirement.
      const { data: existingMatches } = await sb
        .from("matches")
        .select("id, home_team, away_team, kickoff_at");
      const linkKey = (h: string, a: string, k: string) =>
        `${h.toLowerCase()}|${a.toLowerCase()}|${new Date(k).toISOString().slice(0, 10)}`;
      const linkMap = new Map<string, string>();
      for (const m of (existingMatches as Array<{ id: string; home_team: string; away_team: string; kickoff_at: string }> | null) ?? []) {
        linkMap.set(linkKey(m.home_team, m.away_team, m.kickoff_at), m.id);
      }
      const linkedRows = rows.map((r) => ({
        ...r,
        linked_match_id: linkMap.get(linkKey(r.home_team, r.away_team, r.kickoff_at)) ?? null,
      }));

      const { error: upsertErr } = await sb
        .from("espn_matches")
        .upsert(linkedRows, { onConflict: "id" });
      if (upsertErr) throw new Error(`espn_matches upsert: ${upsertErr.message}`);
      result.matches_synced = linkedRows.length;
    }

    // Diff events: only insert new (match_id, idx) pairs.
    if (events.length) {
      const matchIds = Array.from(new Set(events.map((e) => e.match_id)));
      const { data: existingEvents } = await sb
        .from("espn_match_events")
        .select("match_id, idx")
        .in("match_id", matchIds);
      const seen = new Set(
        ((existingEvents as Array<{ match_id: string; idx: number }> | null) ?? []).map(
          (r) => `${r.match_id}|${r.idx}`,
        ),
      );
      const fresh = events.filter((e) => !seen.has(`${e.match_id}|${e.idx}`));
      if (fresh.length) {
        const { error: evErr } = await sb.from("espn_match_events").insert(fresh);
        if (evErr) throw new Error(`espn_match_events insert: ${evErr.message}`);
      }
      result.events_added = fresh.length;
    }
  } catch (e) {
    console.error("sync-espn scoreboard failed", e);
    result.scoreboard_error = e instanceof Error ? e.message : String(e);
    result.ok = false;
  }

  try {
    const standings = await fetchStandings();
    if (standings.length) {
      const nowIso = new Date().toISOString();
      const rows = standings.map((s) => ({ ...s, last_synced_at: nowIso }));
      const { error: stErr } = await sb
        .from("espn_standings")
        .upsert(rows, { onConflict: "group_label,team_code" });
      if (stErr) throw new Error(`espn_standings upsert: ${stErr.message}`);
      result.standings_updated = rows.length;
    } else {
      result.standings_updated = 0;
    }
  } catch (e) {
    console.error("sync-espn standings failed", e);
    result.standings_error = e instanceof Error ? e.message : String(e);
    // Don't flip ok=false for standings alone — scoreboard is the load-bearing call.
  }

  return Response.json(result, { status: result.ok ? 200 : 502 });
}
