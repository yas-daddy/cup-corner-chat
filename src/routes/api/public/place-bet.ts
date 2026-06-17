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
      PATCH: edit,
      DELETE: cancel,
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

async function edit({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as {
    bet_id?: string;
    selection?: string;
    stake?: number;
  } | null;
  if (!body?.bet_id) return bad("Missing bet_id");
  const { bet_id } = body;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: bet, error: bErr } = await sb
    .from("bets")
    .select("id, player_id, match_id, selection, stake, status")
    .eq("id", bet_id)
    .maybeSingle();
  if (bErr) return bad(bErr.message, 500);
  if (!bet) return bad("Bet not found", 404);
  if ((bet as { status: string }).status !== "pending") return bad("Cannot edit a settled bet", 409);

  const newSelection = (body.selection ?? (bet as { selection: Selection }).selection) as Selection;
  const newStake = body.stake ?? (bet as { stake: number }).stake;
  if (!SELECTIONS.has(newSelection)) return bad("Invalid selection");
  if (!Number.isInteger(newStake) || newStake < 1) return bad("Stake must be a positive integer");

  const ctx = await loadContext(
    (bet as { player_id: string }).player_id,
    (bet as { match_id: string }).match_id,
    newSelection,
  );
  if ("error" in ctx) return bad(ctx.error, ctx.status ?? 400);

  const oldStake = (bet as { stake: number }).stake;
  // Effective available balance for this edit = current balance + the stake
  // we already debited for this bet (which we're about to refund).
  const effectiveBalance = ctx.balance + oldStake;
  const cap = Math.floor(effectiveBalance * MAX_STAKE_PCT);
  if (newStake > effectiveBalance) return bad("Insufficient balance");
  if (newStake > cap) return bad(`Max stake on this bet is $${cap} (25% of effective balance)`);

  const { error: updErr } = await ctx.sb
    .from("bets")
    .update({
      selection: newSelection,
      stake: newStake,
      decimal_odds: ctx.decimal_odds,
    })
    .eq("id", bet_id);
  if (updErr) return bad(updErr.message, 500);

  // Refund the old stake, debit the new one. Two ledger rows so the trail
  // shows what changed.
  const playerId = (bet as { player_id: string }).player_id;
  const { error: refundErr } = await ctx.sb.from("bet_transactions").insert([
    { player_id: playerId, kind: "refund", amount: oldStake, bet_id, note: "Bet edited — old stake refunded" },
    { player_id: playerId, kind: "stake_debit", amount: -newStake, bet_id, note: "Bet edited — new stake" },
  ]);
  if (refundErr) return bad(refundErr.message, 500);

  return Response.json({ ok: true, bet_id, decimal_odds: ctx.decimal_odds });
}

async function cancel({ request }: { request: Request }) {
  if (!authorize(request)) return unauthorized();
  const body = (await request.json().catch(() => null)) as { bet_id?: string } | null;
  if (!body?.bet_id) return bad("Missing bet_id");
  const { bet_id } = body;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data: bet, error: bErr } = await sb
    .from("bets")
    .select("id, player_id, match_id, stake, status")
    .eq("id", bet_id)
    .maybeSingle();
  if (bErr) return bad(bErr.message, 500);
  if (!bet) return bad("Bet not found", 404);
  if ((bet as { status: string }).status !== "pending") return bad("Cannot cancel a settled bet", 409);

  // The lock trigger blocks deletes after kickoff, but we want a friendlier
  // message — check kickoff explicitly first.
  const { data: match } = await sb
    .from("matches")
    .select("kickoff_at")
    .eq("id", (bet as { match_id: string }).match_id)
    .maybeSingle();
  if (match && new Date((match as { kickoff_at: string }).kickoff_at).getTime() <= Date.now()) {
    return bad("Bets are locked at kickoff", 409);
  }

  const { error: delErr } = await sb.from("bets").update({ status: "void" }).eq("id", bet_id);
  if (delErr) return bad(delErr.message, 500);
  const playerId = (bet as { player_id: string }).player_id;
  const stake = (bet as { stake: number }).stake;
  const { error: txErr } = await sb.from("bet_transactions").insert({
    player_id: playerId,
    kind: "refund",
    amount: stake,
    bet_id,
    note: "Bet cancelled",
  });
  if (txErr) return bad(txErr.message, 500);

  return Response.json({ ok: true });
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
