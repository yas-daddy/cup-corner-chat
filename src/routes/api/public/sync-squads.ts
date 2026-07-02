import { createFileRoute } from "@tanstack/react-router";
import { fetchAllSquads } from "@/lib/squads.server";

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

export const Route = createFileRoute("/api/public/sync-squads")({
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

  try {
    const { players, teams, missedSections } = await fetchAllSquads();

    if (players.length === 0) {
      return Response.json({
        ok: true,
        players: 0,
        teams,
        note: "Master article had no parseable squads yet",
        missed: missedSections,
      });
    }

    const nowIso = new Date().toISOString();
    const rows = players.map((p) => ({ ...p, last_synced_at: nowIso }));

    const { error: upErr } = await sb
      .from("squad_players")
      .upsert(rows, { onConflict: "id" });
    if (upErr) throw new Error(`squad_players upsert: ${upErr.message}`);

    // Remove any players that were previously synced but no longer appear in
    // the fresh payload (handles squad rotations).
    const freshIds = new Set(rows.map((r) => r.id));
    const teamCodes = Array.from(new Set(rows.map((r) => r.team_code)));
    const { data: existing } = await sb
      .from("squad_players")
      .select("id, team_code")
      .in("team_code", teamCodes);
    const stale = ((existing as Array<{ id: string; team_code: string }> | null) ?? [])
      .filter((r) => !freshIds.has(r.id))
      .map((r) => r.id);
    let removed = 0;
    if (stale.length > 0) {
      const { error: delErr } = await sb
        .from("squad_players")
        .delete()
        .in("id", stale);
      if (delErr) throw new Error(`squad_players delete: ${delErr.message}`);
      removed = stale.length;
    }

    return Response.json({
      ok: true,
      players: rows.length,
      teams,
      removed,
      missed: missedSections,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
