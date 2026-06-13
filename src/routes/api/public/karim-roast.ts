import { createFileRoute } from "@tanstack/react-router";

const KARIM_ID = "ca710000-0000-4000-8000-000000000001";

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

export const Route = createFileRoute("/api/public/karim-roast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();

        const payload = (await request.json().catch(() => ({}))) as {
          activity_id?: string;
        };
        if (!payload.activity_id) {
          return new Response("Missing activity_id", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: act } = await supabaseAdmin
          .from("feed_activities")
          .select("*")
          .eq("id", payload.activity_id)
          .maybeSingle();

        if (!act || act.kind !== "points_awarded" || (act.points ?? 0) !== 0) {
          return Response.json({ skipped: "not a zero-point result" });
        }
        if (act.actor_id === KARIM_ID || !act.match_id) {
          return Response.json({ skipped: "bot or missing match" });
        }

        const targetId = `${act.actor_id}::${act.match_id}`;

        // Idempotency — the partial unique index also enforces this in DB.
        const { data: already } = await supabaseAdmin
          .from("comments")
          .select("id")
          .eq("player_id", KARIM_ID)
          .eq("target_type", "prediction")
          .eq("target_id", targetId)
          .maybeSingle();
        if (already) return Response.json({ skipped: "already roasted" });

        const [{ data: player }, { data: match }] = await Promise.all([
          supabaseAdmin
            .from("players")
            .select("display_name")
            .eq("id", act.actor_id)
            .maybeSingle(),
          supabaseAdmin
            .from("matches")
            .select("home_team,away_team")
            .eq("id", act.match_id)
            .maybeSingle(),
        ]);
        if (!player || !match) {
          return new Response("Missing player or match", { status: 404 });
        }

        const { roastPrediction } = await import("@/lib/karim.server");
        let body: string;
        try {
          body = await roastPrediction({
            playerName: player.display_name,
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            predHome: act.pred_home ?? 0,
            predAway: act.pred_away ?? 0,
            finalHome: act.home_score ?? 0,
            finalAway: act.away_score ?? 0,
          });
        } catch (err) {
          console.error("[karim-roast] AI call failed", err);
          return new Response("AI call failed", { status: 502 });
        }

        if (!body) return Response.json({ skipped: "empty roast" });
        // Comments are capped at 500 chars in DB.
        const safe = body.slice(0, 500);

        const { error } = await supabaseAdmin.from("comments").insert({
          player_id: KARIM_ID,
          target_type: "prediction",
          target_id: targetId,
          body: safe,
        });
        if (error && !/duplicate key/i.test(error.message)) {
          console.error("[karim-roast] insert failed", error);
          return new Response(error.message, { status: 500 });
        }

        return Response.json({ ok: true, body: safe });
      },
    },
  },
});
