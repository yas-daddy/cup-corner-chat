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

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/public/quiz-today")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  let playerId: string | null = null;
  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as { player_id?: string } | null;
    playerId = body?.player_id ?? null;
  } else {
    playerId = new URL(request.url).searchParams.get("player_id");
  }
  if (!playerId) {
    return Response.json({ ok: false, error: "Missing player_id" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const today = todayUtc();

  // The correct_index column is deliberately omitted from the SELECT here so
  // it never crosses the network even if the route is misused.
  const { data: rows, error } = await sb
    .from("quiz_questions")
    .select("id, order_index, category, text, choices, explanation")
    .eq("unlock_date", today)
    .order("order_index", { ascending: true });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const questions = (rows as Array<{
    id: string;
    order_index: number;
    category: string;
    text: string;
    choices: string[];
    explanation: string | null;
  }> | null) ?? [];

  if (questions.length === 0) {
    return Response.json({ ok: true, server_now: new Date().toISOString(), today, questions: [], answered: {} });
  }

  const { data: answeredRows } = await sb
    .from("quiz_answers")
    .select("question_id, choice_index, points")
    .eq("player_id", playerId)
    .in("question_id", questions.map((q) => q.id));

  const answered: Record<string, { choice_index: number; points: number }> = {};
  for (const r of (answeredRows as Array<{ question_id: string; choice_index: number; points: number }> | null) ?? []) {
    answered[r.question_id] = { choice_index: r.choice_index, points: r.points };
  }

  // Strip explanation on unanswered questions — keeps the joy intact.
  const safeQuestions = questions.map((q) =>
    answered[q.id]
      ? q
      : { id: q.id, order_index: q.order_index, category: q.category, text: q.text, choices: q.choices },
  );

  return Response.json({
    ok: true,
    server_now: new Date().toISOString(),
    today,
    questions: safeQuestions,
    answered,
  });
}
