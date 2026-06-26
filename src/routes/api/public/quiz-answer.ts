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

function bad(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Server-enforced anti-cheat: a client must have fetched the question via
// /api/public/quiz-today within the last 13s (12s timer + 1s grace) before
// posting an answer. choice_index = -1 is the explicit "no answer".
export const Route = createFileRoute("/api/public/quiz-answer")({
  server: {
    handlers: {
      POST: handler,
    },
  },
});

async function handler({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    player_id?: string;
    question_id?: string;
    choice_index?: number;
    started_at?: string;
  } | null;
  if (!body) return bad("Invalid JSON body");
  const { player_id, question_id, choice_index, started_at } = body;
  if (!player_id) return bad("Missing player_id");
  if (!question_id) return bad("Missing question_id");
  if (!Number.isInteger(choice_index) || (choice_index! < -1 || choice_index! > 3))
    return bad("choice_index must be in [-1, 3]");
  if (!started_at) return bad("Missing started_at");

  const elapsedMs = Date.now() - Date.parse(started_at);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    return bad("started_at not parsable or in the future");
  if (elapsedMs > 13000) return bad("Time expired", 409);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: q, error: qErr } = await sb
    .from("quiz_questions")
    .select("id, unlock_date, correct_index")
    .eq("id", question_id)
    .maybeSingle();
  if (qErr) return bad(qErr.message, 500);
  if (!q) return bad("Question not found", 404);
  const question = q as { id: string; unlock_date: string; correct_index: number };
  if (question.unlock_date !== todayUtc())
    return bad("This question is not in today's window", 409);

  const correct = choice_index === question.correct_index;
  const points = choice_index === -1 ? 0 : correct ? 5 : -1;

  const { error: insErr } = await sb.from("quiz_answers").insert({
    player_id,
    question_id,
    choice_index,
    points,
  });
  if (insErr) {
    // Duplicate (already answered) is a 409 with a friendly message.
    const msg = insErr.message || "";
    if (msg.includes("duplicate key")) return bad("Already answered", 409);
    return bad(msg, 500);
  }

  return Response.json({
    ok: true,
    correct,
    points,
    correct_index: question.correct_index,
  });
}
