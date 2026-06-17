-- Harden enforce_bet_lock so a bet can never be voided via a normal UPDATE.
-- Settlement still writes 'won' / 'lost' freely (those bypass the kickoff
-- check). Only the system, with app.bypass_lock = 'on' set in the session
-- (e.g. a future "match cancelled" cleanup job), may transition a bet to
-- 'void'.

CREATE OR REPLACE FUNCTION public.enforce_bet_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k timestamptz;
BEGIN
  -- System bypass — only set inside trusted server-side routines.
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Direct transitions to 'void' are never allowed outside the bypass.
  IF TG_OP = 'UPDATE' AND NEW.status = 'void' THEN
    RAISE EXCEPTION 'Bets cannot be voided';
  END IF;

  -- Settlement transitions ('won' / 'lost') flow without a kickoff check —
  -- this lets settle_bets_on_match_finish() run after kickoff.
  IF TG_OP = 'UPDATE' AND NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Everything else (INSERT, or UPDATE that keeps status='pending') must
  -- still be before kickoff.
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
