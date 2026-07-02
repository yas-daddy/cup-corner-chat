import { createFileRoute } from "@tanstack/react-router";
import { fetchScoreboard, fetchStandings, fetchMatchSummary } from "@/lib/espn.server";

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

// Full WC2026 tournament window (opening match 11 Jun 2026 → final 19 Jul 2026,
// padded a day each side). ESPN handles `limit=200` comfortably for the 104
// scheduled matches, so we just fetch the whole thing every poll.
function dateWindow() {
  return { from: "20260610", to: "20260720" };
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

      // Link each ESPN row to an existing matches.id by (home, away, date).
      const { data: existingMatches } = await sb
        .from("matches")
        .select("id, home_team, away_team, kickoff_at");
      const linkKey = (h: string, a: string, k: string) =>
        `${h.toLowerCase()}|${a.toLowerCase()}|${new Date(k).toISOString().slice(0, 10)}`;
      const linkMap = new Map<string, string>();
      for (const m of (existingMatches as Array<{ id: string; home_team: string; away_team: string; kickoff_at: string }> | null) ?? []) {
        linkMap.set(linkKey(m.home_team, m.away_team, m.kickoff_at), m.id);
      }

      // Pull current espn_matches rows to diff against. Only matches whose
      // tracked fields actually changed get re-upserted — historical FINISHED
      // games are no-ops on every subsequent poll.
      const ids = matches.map((m) => m.id);
      const { data: existingEspn } = await sb
        .from("espn_matches")
        .select(
          "id,state,completed,home_score,away_score,clock_display,status_detail,group_label,kickoff_at,linked_match_id,odds_provider,odds_home_decimal,odds_draw_decimal,odds_away_decimal,is_knockout,advanced_side",
        )
        .in("id", ids);
      type Existing = {
        id: string;
        state: string;
        completed: boolean;
        home_score: number | null;
        away_score: number | null;
        clock_display: string | null;
        status_detail: string | null;
        group_label: string | null;
        kickoff_at: string;
        linked_match_id: string | null;
        odds_provider: string | null;
        odds_home_decimal: number | null;
        odds_draw_decimal: number | null;
        odds_away_decimal: number | null;
        is_knockout: boolean | null;
        advanced_side: "home" | "away" | null;
      };
      const existingMap = new Map<string, Existing>();
      for (const r of (existingEspn as Existing[] | null) ?? []) existingMap.set(r.id, r);

      const tracked: (keyof Existing)[] = [
        "state",
        "completed",
        "home_score",
        "away_score",
        "clock_display",
        "status_detail",
        "group_label",
        "kickoff_at",
        "linked_match_id",
        "odds_provider",
        "odds_home_decimal",
        "odds_draw_decimal",
        "odds_away_decimal",
        "is_knockout",
        "advanced_side",
      ];

      let skippedUnchanged = 0;
      const toUpsert: Array<Record<string, unknown>> = [];
      for (const r of matches) {
        const linked_match_id =
          linkMap.get(linkKey(r.home_team, r.away_team, r.kickoff_at)) ?? null;
        const candidate = { ...r, linked_match_id, last_synced_at: nowIso };
        const prior = existingMap.get(r.id);
        if (prior) {
          const changed = tracked.some((k) => {
            if (k === "kickoff_at") {
              return new Date(prior.kickoff_at).getTime() !== new Date(r.kickoff_at).getTime();
            }
            return (prior as unknown as Record<string, unknown>)[k] !== (candidate as unknown as Record<string, unknown>)[k];
          });
          if (!changed) {
            skippedUnchanged++;
            continue;
          }
        }
        toUpsert.push(candidate);
      }

      if (toUpsert.length) {
        const { error: upsertErr } = await sb
          .from("espn_matches")
          .upsert(toUpsert, { onConflict: "id" });
        if (upsertErr) throw new Error(`espn_matches upsert: ${upsertErr.message}`);

        // Propagate is_knockout + advanced_side onto public.matches so the
        // prediction_points view (which reads from public.matches) sees them.
        // Only rows that have a linked_match_id participate.
        const propagated = toUpsert.filter(
          (r) => typeof r.linked_match_id === "string" && r.linked_match_id,
        );
        await Promise.all(
          propagated.map((r) =>
            sb
              .from("matches")
              .update({
                is_knockout: r.is_knockout ?? false,
                advanced_side: r.advanced_side ?? null,
              })
              .eq("id", r.linked_match_id),
          ),
        );
      }
      result.matches_synced = toUpsert.length;
      result.matches_skipped_unchanged = skippedUnchanged;
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

  // Lineups: for matches that have kicked off, are about to kick off, or
  // just finished — and don't already have a lineup sheet stored. Once we
  // capture the sheet we don't refetch (per feature scope: no mid-match
  // updates).
  try {
    const nowMs = Date.now();
    const { data: eligible } = await sb
      .from("espn_matches")
      .select("id, linked_match_id, kickoff_at, state, home_code, away_code")
      .in("state", ["in", "pre", "post"])
      .not("linked_match_id", "is", null);
    const candidates =
      ((eligible as Array<{
        id: string;
        linked_match_id: string;
        kickoff_at: string;
        state: string;
        home_code: string | null;
        away_code: string | null;
      }> | null) ?? [])
        .filter((m) => {
          const kickMs = new Date(m.kickoff_at).getTime();
          const dtMin = (kickMs - nowMs) / 60000;
          if (m.state === "in") return true;
          if (m.state === "pre") return dtMin <= 90; // starting soon
          if (m.state === "post") return dtMin >= -24 * 60; // finished today-ish
          return false;
        })
        .slice(0, 6); // cap per-tick fanout

    // Skip matches we already have lineups for.
    const candidateMatchIds = candidates.map((c) => c.linked_match_id);
    const already = new Set<string>();
    if (candidateMatchIds.length) {
      const { data: existing } = await sb
        .from("match_lineups")
        .select("match_id")
        .in("match_id", candidateMatchIds);
      for (const r of (existing as Array<{ match_id: string }> | null) ?? []) {
        already.add(r.match_id);
      }
    }
    const toFetch = candidates.filter((c) => !already.has(c.linked_match_id));

    let lineupsAdded = 0;
    for (const c of toFetch) {
      try {
        const players = await fetchMatchSummary(c.id);
        if (players.length === 0) continue;
        // If ESPN's team_code doesn't match our stored home_code/away_code
        // (e.g. USA vs US), remap using team_side.
        const remapped = players.map((p) => ({
          match_id: c.linked_match_id,
          team_code:
            p.team_side === "home"
              ? c.home_code ?? p.team_code
              : c.away_code ?? p.team_code,
          idx: p.idx,
          full_name: p.full_name,
          jersey_number: p.jersey_number,
          position: p.position,
          is_starter: p.is_starter,
          captain: p.captain,
          formation: p.formation,
          espn_player_id: p.espn_player_id,
        }));
        const { error: insErr } = await sb
          .from("match_lineups")
          .upsert(remapped, { onConflict: "match_id,team_code,idx" });
        if (insErr) throw new Error(insErr.message);
        lineupsAdded += remapped.length;
      } catch (e) {
        console.error(`sync-espn lineups failed for ${c.id}`, e);
      }
    }
    result.lineups_added = lineupsAdded;
    result.lineups_matches_processed = toFetch.length;
  } catch (e) {
    console.error("sync-espn lineups failed", e);
    result.lineups_error = e instanceof Error ? e.message : String(e);
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
