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

function startOfUtcDay(d: Date) {
  const c = new Date(d);
  c.setUTCHours(0, 0, 0, 0);
  return c;
}

export const Route = createFileRoute("/api/public/karim-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return unauthorized();

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const now = new Date();
        const todayStart = startOfUtcDay(now);
        const yStart = new Date(todayStart);
        yStart.setUTCDate(yStart.getUTCDate() - 1);
        const yEnd = todayStart;
        const dayLabel = yStart.toISOString().slice(0, 10);

        // Skip if we already posted a summary today
        const { data: existing } = await supabaseAdmin
          .from("feed_activities")
          .select("id")
          .eq("kind", "daily_summary")
          .eq("actor_id", KARIM_ID)
          .gte("created_at", todayStart.toISOString())
          .limit(1)
          .maybeSingle();
        if (existing) return Response.json({ skipped: "already posted" });

        const { data: dayActs } = await supabaseAdmin
          .from("feed_activities")
          .select("kind, actor_id, points")
          .gte("created_at", yStart.toISOString())
          .lt("created_at", yEnd.toISOString());
        const rows = dayActs ?? [];

        const finishedMatches = new Set(
          rows.filter((r) => r.kind === "points_awarded").map((r) => (r as { match_id?: string }).match_id ?? ""),
        ).size;
        const newPicks = rows.filter(
          (r) => r.kind === "prediction_created" || r.kind === "prediction_updated",
        ).length;

        const totals = new Map<string, number>();
        rows
          .filter((r) => r.kind === "points_awarded" && r.actor_id !== KARIM_ID)
          .forEach((r) => {
            totals.set(r.actor_id, (totals.get(r.actor_id) ?? 0) + (r.points ?? 0));
          });
        let topScorerId: string | null = null;
        let topScorerPts = 0;
        for (const [id, pts] of totals) {
          if (pts > topScorerPts) {
            topScorerPts = pts;
            topScorerId = id;
          }
        }

        const { data: lb } = await supabaseAdmin
          .from("leaderboard")
          .select("player_id, display_name, total_points")
          .neq("player_id", KARIM_ID)
          .order("total_points", { ascending: false })
          .limit(1);
        const leader = lb?.[0];

        let topScorerName: string | null = null;
        if (topScorerId) {
          const { data: p } = await supabaseAdmin
            .from("players")
            .select("display_name")
            .eq("id", topScorerId)
            .maybeSingle();
          topScorerName = p?.display_name ?? null;
        }

        if (finishedMatches === 0 && newPicks === 0) {
          return Response.json({ skipped: "no activity yesterday" });
        }

        const { writeDailySummary } = await import("@/lib/karim.server");
        let body: string;
        try {
          body = await writeDailySummary({
            dayLabel,
            topScorerName,
            topScorerPts,
            finishedMatches,
            newPicks,
            leaderName: leader?.display_name ?? null,
            leaderPts: Number(leader?.total_points ?? 0),
          });
        } catch (err) {
          console.error("[karim-daily] AI call failed", err);
          return new Response("AI call failed", { status: 502 });
        }
        if (!body) return Response.json({ skipped: "empty summary" });

        const { error } = await supabaseAdmin.from("feed_activities").insert({
          kind: "daily_summary",
          actor_id: KARIM_ID,
          match_id: null,
          body: body.slice(0, 1000),
        });
        if (error) {
          console.error("[karim-daily] insert failed", error);
          return new Response(error.message, { status: 500 });
        }

        return Response.json({ ok: true, body });
      },
    },
  },
});
