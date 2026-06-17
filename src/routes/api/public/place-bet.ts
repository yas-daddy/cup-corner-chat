import { createFileRoute } from "@tanstack/react-router";
import { MAX_STAKE_PCT, type Selection } from "@/lib/bet-config";

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

const SELECTIONS = new Set<Selection>(["home", "draw", "away"]);

export const Route = createFileRoute("/api/public/place-bet")({
  server: {
    handlers: {
      POST: place,
    },
  },
});

async function place({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    player_id?: string;
    match_id?: string;
    selection?: string;
    stake?: number;
  } | null;
  if (!body) return bad("Invalid JSON body");
  const { player_id, match_id, selection, stake } = body;
  if (!player_id || !match_id) return bad("Missing player_id or match_id");
  if (!selection || !SELECTIONS.has(selection as Selection)) return bad("Invalid selection");
  if (!Number.isInteger(stake) || (stake as number) < 1) return bad("Stake must be a positive integer");

  const ctx = await loadContext(player_id, match_id, selection as Selection);
  if ("error" in ctx) return bad(ctx.error, ctx.status ?? 400);

  const { sb, balance, decimal_odds, existingBetId } = ctx;
  if (existingBetId) return bad("You already have a bet on this match — edit it instead", 409);

  const cap = Math.floor(balance * MAX_STAKE_PCT);
  if ((stake as number) > balance) return bad("Insufficient balance");
  if ((stake as number) > cap) return bad(`Max stake on this bet is $${cap} (25% of balance)`);

  const placedAt = new Date().toISOString();
  const { data: bet, error: insErr } = await sb
    .from("bets")
    .insert({
      player_id,
      match_id,
      selection,
      stake,
      decimal_odds,
      placed_at: placedAt,
    })
    .select("id")
    .single();
  if (insErr) return bad(insErr.message, 500);

  const { error: txErr } = await sb.from("bet_transactions").insert({
    player_id,
    kind: "stake_debit",
    amount: -(stake as number),
    bet_id: (bet as { id: string }).id,
    note: "Bet placed",
  });
  if (txErr) return bad(txErr.message, 500);

  return Response.json({ ok: true, bet_id: (bet as { id: string }).id, decimal_odds });
}

type ContextErr = { error: string; status?: number };
type ContextOk = {
  sb: { from: (t: string) => any };
  balance: number;
  decimal_odds: number;
  existingBetId: string | null;
};

async function loadContext(
  player_id: string,
  match_id: string,
  selection: Selection,
): Promise<ContextOk | ContextErr> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: match } = await sb
    .from("matches")
    .select("id, kickoff_at, status")
    .eq("id", match_id)
    .maybeSingle();
  if (!match) return { error: "Match not found", status: 404 };
  if ((match as { status: string }).status === "FINISHED")
    return { error: "Match is finished" };
  if (new Date((match as { kickoff_at: string }).kickoff_at).getTime() <= Date.now())
    return { error: "Bets are locked at kickoff" };

  const { data: espnRows } = await sb
    .from("espn_matches")
    .select(
      "odds_home_decimal,odds_draw_decimal,odds_away_decimal,linked_match_id",
    )
    .eq("linked_match_id", match_id)
    .limit(1);
  const espn = (espnRows as Array<{
    odds_home_decimal: number | null;
    odds_draw_decimal: number | null;
    odds_away_decimal: number | null;
  }> | null)?.[0];
  if (!espn) return { error: "Odds not available for this match" };
  const odds =
    selection === "home"
      ? espn.odds_home_decimal
      : selection === "draw"
        ? espn.odds_draw_decimal
        : espn.odds_away_decimal;
  if (odds == null) return { error: "Odds not available for this selection" };

  const { data: bal } = await sb
    .from("bank_balances")
    .select("balance")
    .eq("player_id", player_id)
    .maybeSingle();
  const balance = (bal as { balance: number } | null)?.balance ?? 0;

  const { data: existing } = await sb
    .from("bets")
    .select("id")
    .eq("player_id", player_id)
    .eq("match_id", match_id)
    .eq("status", "pending")
    .maybeSingle();

  return {
    sb,
    balance,
    decimal_odds: Number(odds),
    existingBetId: (existing as { id: string } | null)?.id ?? null,
  };
}
