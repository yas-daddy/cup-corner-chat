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

export const Route = createFileRoute("/api/public/quiz-history")({
  server: {
    handlers: {
      POST: handler,
    },
  },
});

// Returns every question the player has answered so far, grouped by
// unlock_date (newest first). Answered questions ARE allowed to include
// correct_index and explanation — the point of history is showing what
// the right answer was.
async function handler({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as { player_id?: string } | null;
  const playerId = body?.player_id;
  if (!playerId) {
    return Response.json({ ok: false, error: "Missing player_id" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: answers, error: aErr } = await sb
    .from("quiz_answers")
    .select("question_id, choice_index, points, answered_at")
    .eq("player_id", playerId);
  if (aErr) return Response.json({ ok: false, error: aErr.message }, { status: 500 });

  const answered = (answers as Array<{
    question_id: string;
    choice_index: number;
    points: number;
    answered_at: string;
  }> | null) ?? [];

  if (answered.length === 0) {
    return Response.json({ ok: true, days: [] });
  }

  const questionIds = Array.from(new Set(answered.map((a) => a.question_id)));
  const { data: questions, error: qErr } = await sb
    .from("quiz_questions")
    .select("id, unlock_date, order_index, category, text, choices, correct_index, explanation")
    .in("id", questionIds);
  if (qErr) return Response.json({ ok: false, error: qErr.message }, { status: 500 });

  const qById = new Map<string, {
    id: string;
    unlock_date: string;
    order_index: number;
    category: string;
    text: string;
    choices: string[];
    correct_index: number;
    explanation: string | null;
  }>();
  for (const q of (questions as Array<{
    id: string;
    unlock_date: string;
    order_index: number;
    category: string;
    text: string;
    choices: string[];
    correct_index: number;
    explanation: string | null;
  }> | null) ?? []) {
    qById.set(q.id, q);
  }

  // Group by unlock_date.
  const byDate = new Map<
    string,
    {
      date: string;
      total: number;
      correct: number;
      wrong: number;
      no_answer: number;
      questions: Array<{
        id: string;
        order_index: number;
        category: string;
        text: string;
        choices: string[];
        correct_index: number;
        explanation: string | null;
        choice_index: number;
        points: number;
      }>;
    }
  >();

  for (const a of answered) {
    const q = qById.get(a.question_id);
    if (!q) continue;
    const bucket = byDate.get(q.unlock_date) ?? {
      date: q.unlock_date,
      total: 0,
      correct: 0,
      wrong: 0,
      no_answer: 0,
      questions: [],
    };
    bucket.total += a.points;
    if (a.choice_index === -1) bucket.no_answer += 1;
    else if (a.points > 0) bucket.correct += 1;
    else bucket.wrong += 1;
    bucket.questions.push({
      id: q.id,
      order_index: q.order_index,
      category: q.category,
      text: q.text,
      choices: q.choices,
      correct_index: q.correct_index,
      explanation: q.explanation,
      choice_index: a.choice_index,
      points: a.points,
    });
    byDate.set(q.unlock_date, bucket);
  }

  const days = Array.from(byDate.values())
    .map((d) => ({
      ...d,
      questions: d.questions.sort((a, b) => a.order_index - b.order_index),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return Response.json({ ok: true, days });
}
