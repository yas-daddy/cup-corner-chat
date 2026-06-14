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
          .select("kind, actor_id, points, match_id, home_score, away_score")
          .gte("created_at", yStart.toISOString())
          .lt("created_at", yEnd.toISOString());
        const rows = (dayActs ?? []) as Array<{
          kind: string;
          actor_id: string;
          points: number | null;
          match_id: string | null;
          home_score: number | null;
          away_score: number | null;
        }>;

        const pointsRows = rows.filter((r) => r.kind === "points_awarded");
        const finishedMatchIds = Array.from(
          new Set(pointsRows.map((r) => r.match_id).filter((x): x is string => !!x)),
        );
        const finishedMatches = finishedMatchIds.length;
        const newPicks = rows.filter(
          (r) => r.kind === "prediction_created" || r.kind === "prediction_updated",
        ).length;

        const totals = new Map<string, number>();
        pointsRows
          .filter((r) => r.actor_id !== KARIM_ID)
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

        // Fetch match details + all players so we can name names
        const [{ data: matchRows }, { data: allPlayers }] = await Promise.all([
          finishedMatchIds.length
            ? supabaseAdmin
                .from("matches")
                .select("id, home_team, away_team, home_score, away_score")
                .in("id", finishedMatchIds)
            : Promise.resolve({ data: [] as Array<{ id: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null }> }),
          supabaseAdmin.from("players").select("id, display_name"),
        ]);

        const nameById = new Map<string, string>();
        (allPlayers ?? []).forEach((p) => nameById.set(p.id, p.display_name));
        const matchById = new Map<string, { home_team: string; away_team: string; home_score: number | null; away_score: number | null }>();
        (matchRows ?? []).forEach((m) => matchById.set(m.id, m));

        const topScorerName = topScorerId ? nameById.get(topScorerId) ?? null : null;

        // Build per-match result objects (exclude Karim from winner lists)
        type MR = import("@/lib/karim.server").MatchResult;
        const matches: MR[] = finishedMatchIds.map((mid) => {
          const meta = matchById.get(mid);
          const picks = pointsRows.filter((r) => r.match_id === mid && r.actor_id !== KARIM_ID);
          const exactWinners = picks
            .filter((r) => (r.points ?? 0) === 8)
            .map((r) => nameById.get(r.actor_id))
            .filter((n): n is string => !!n);
          const zeroCount = picks.filter((r) => (r.points ?? 0) === 0).length;
          const firstWithScore = picks.find((r) => r.home_score !== null && r.away_score !== null);
          return {
            homeTeam: meta?.home_team ?? "Home",
            awayTeam: meta?.away_team ?? "Away",
            homeScore: meta?.home_score ?? firstWithScore?.home_score ?? 0,
            awayScore: meta?.away_score ?? firstWithScore?.away_score ?? 0,
            exactWinners,
            zeroCount,
            totalPicks: picks.length,
          };
        });

        // Biggest upset = match with highest zero ratio (min 2 picks)
        const biggestUpset = matches
          .filter((m) => m.totalPicks >= 2)
          .sort((a, b) => b.zeroCount / b.totalPicks - a.zeroCount / a.totalPicks)[0] ?? null;

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
            matches,
            biggestUpset,
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
