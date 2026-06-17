-- Odds columns on the existing ESPN mirror.
ALTER TABLE public.espn_matches
  ADD COLUMN IF NOT EXISTS odds_provider text,
  ADD COLUMN IF NOT EXISTS odds_home_decimal numeric(8,2),
  ADD COLUMN IF NOT EXISTS odds_draw_decimal numeric(8,2),
  ADD COLUMN IF NOT EXISTS odds_away_decimal numeric(8,2),
  ADD COLUMN IF NOT EXISTS odds_updated_at timestamptz;

CREATE TABLE public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  selection text NOT NULL CHECK (selection IN ('home','draw','away')),
  stake int NOT NULL CHECK (stake >= 1),
  decimal_odds numeric(8,2) NOT NULL CHECK (decimal_odds >= 1.01),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','won','lost','void')),
  payout int,
  placed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (player_id, match_id)
);
CREATE INDEX bets_match_pending_idx ON public.bets (match_id) WHERE status = 'pending';
CREATE INDEX bets_player_idx ON public.bets (player_id);

CREATE TABLE public.bet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('grant','stipend','stake_debit','payout_credit','refund','adjustment')),
  amount int NOT NULL,
  bet_id uuid REFERENCES public.bets(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bet_tx_player_idx ON public.bet_transactions (player_id);
CREATE INDEX bet_tx_bet_idx ON public.bet_transactions (bet_id);

CREATE OR REPLACE VIEW public.bank_balances AS
SELECT player_id, COALESCE(SUM(amount), 0)::int AS balance
FROM public.bet_transactions
GROUP BY player_id;

CREATE OR REPLACE VIEW public.bank_leaderboard AS
SELECT
  p.id AS player_id,
  p.display_name,
  p.avatar,
  COALESCE(bb.balance, 0) AS balance,
  COUNT(b.id) FILTER (WHERE b.status = 'won')  AS wins,
  COUNT(b.id) FILTER (WHERE b.status = 'lost') AS losses,
  COUNT(b.id) FILTER (WHERE b.status IN ('won','lost')) AS settled_count,
  COALESCE(MAX(b.payout) FILTER (WHERE b.status = 'won'), 0)::int AS biggest_win
FROM public.players p
LEFT JOIN public.bank_balances bb ON bb.player_id = p.id
LEFT JOIN public.bets b ON b.player_id = p.id
GROUP BY p.id, p.display_name, p.avatar, bb.balance;

ALTER VIEW public.bank_balances SET (security_invoker = on);
ALTER VIEW public.bank_leaderboard SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.enforce_bet_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k timestamptz;
BEGIN
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Match % not found', NEW.match_id;
  END IF;
  IF now() >= k THEN
    RAISE EXCEPTION 'Bets are locked for this match';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bets_lock_trigger
BEFORE INSERT OR UPDATE ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.enforce_bet_lock();

CREATE OR REPLACE FUNCTION public.grant_starting_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bet_transactions (player_id, kind, amount, note)
  VALUES (NEW.id, 'grant', 100, 'Welcome bonus');
  RETURN NEW;
END;
$$;

CREATE TRIGGER players_grant_balance_trg
AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.grant_starting_balance();

INSERT INTO public.bet_transactions (player_id, kind, amount, note)
SELECT p.id, 'grant', 100, 'Backfill grant'
FROM public.players p
WHERE NOT EXISTS (
  SELECT 1 FROM public.bet_transactions t
  WHERE t.player_id = p.id AND t.kind = 'grant'
);

CREATE OR REPLACE FUNCTION public.settle_bets_on_match_finish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  IF NEW.status <> 'FINISHED' OR OLD.status = 'FINISHED' THEN
    RETURN NEW;
  END IF;
  IF NEW.home_score IS NULL OR NEW.away_score IS NULL THEN
    RETURN NEW;
  END IF;

  result := CASE
    WHEN NEW.home_score > NEW.away_score THEN 'home'
    WHEN NEW.home_score < NEW.away_score THEN 'away'
    ELSE 'draw'
  END;

  WITH won AS (
    UPDATE public.bets SET
      status = 'won',
      payout = (stake * decimal_odds)::int,
      settled_at = now()
    WHERE match_id = NEW.id
      AND status = 'pending'
      AND selection = result
    RETURNING id, player_id, (stake * decimal_odds)::int AS pay
  )
  INSERT INTO public.bet_transactions (player_id, kind, amount, bet_id, note)
  SELECT player_id, 'payout_credit', pay, id, 'Bet won' FROM won;

  UPDATE public.bets SET
    status = 'lost',
    payout = 0,
    settled_at = now()
  WHERE match_id = NEW.id
    AND status = 'pending'
    AND selection <> result;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bets_settle_on_finish
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.settle_bets_on_match_finish();

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bets read all" ON public.bets FOR SELECT USING (true);
CREATE POLICY "bet_tx read all" ON public.bet_transactions FOR SELECT USING (true);

GRANT SELECT ON public.bets, public.bet_transactions TO anon, authenticated;
GRANT SELECT ON public.bank_balances, public.bank_leaderboard TO anon, authenticated;
GRANT ALL ON public.bets, public.bet_transactions TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_transactions;