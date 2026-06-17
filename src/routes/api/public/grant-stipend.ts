import { createFileRoute } from "@tanstack/react-router";
import { STIPEND_THRESHOLD, WEEKLY_STIPEND } from "@/lib/bet-config";

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

export const Route = createFileRoute("/api/public/grant-stipend")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

// Top up every player whose balance is under STIPEND_THRESHOLD by WEEKLY_STIPEND.
// Idempotent per call — calling it twice in the same minute just adds two
// stipend rows to anyone still below threshold; the cron schedule keeps it weekly.
async function handler({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data, error } = await sb
    .from("bank_balances")
    .select("player_id, balance")
    .lt("balance", STIPEND_THRESHOLD);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const eligible = (data as Array<{ player_id: string; balance: number }> | null) ?? [];
  if (eligible.length === 0) return Response.json({ ok: true, granted: 0 });

  const rows = eligible.map((r) => ({
    player_id: r.player_id,
    kind: "stipend",
    amount: WEEKLY_STIPEND,
    note: "Weekly stipend",
  }));
  const { error: insErr } = await sb.from("bet_transactions").insert(rows);
  if (insErr) return Response.json({ ok: false, error: insErr.message }, { status: 500 });

  return Response.json({ ok: true, granted: rows.length });
}
