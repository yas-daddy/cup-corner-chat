import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/public/hooks/emit-pending-predictions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const cutoff = new Date(Date.now() - 60_000).toISOString();
        const { data: preds, error } = await supabaseAdmin
          .from("predictions")
          .select(
            "id,player_id,match_id,pred_home,pred_away,last_emitted_home,last_emitted_away,last_emitted_at,updated_at",
          )
          .lte("updated_at", cutoff);

        if (error) {
          return new Response(error.message, { status: 500 });
        }

        const pending = (preds ?? []).filter(
          (p) =>
            p.last_emitted_at === null ||
            p.last_emitted_home !== p.pred_home ||
            p.last_emitted_away !== p.pred_away,
        );

        let emitted = 0;
        for (const p of pending) {
          const isFirst = p.last_emitted_at === null;
          const { error: insErr } = await supabaseAdmin
            .from("feed_activities")
            .insert({
              kind: isFirst ? "prediction_created" : "prediction_updated",
              actor_id: p.player_id,
              match_id: p.match_id,
              pred_home: p.pred_home,
              pred_away: p.pred_away,
            });
          if (insErr) continue;

          await supabaseAdmin
            .from("predictions")
            .update({
              last_emitted_home: p.pred_home,
              last_emitted_away: p.pred_away,
              last_emitted_at: new Date().toISOString(),
            })
            .eq("id", p.id);
          emitted++;
        }

        return Response.json({ scanned: preds?.length ?? 0, emitted });
      },
    },
  },
});
