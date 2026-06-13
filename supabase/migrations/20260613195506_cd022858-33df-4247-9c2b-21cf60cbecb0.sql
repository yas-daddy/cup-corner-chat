
ALTER VIEW public.prediction_points SET (security_invoker = on);
ALTER VIEW public.leaderboard SET (security_invoker = on);

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  k timestamptz;
BEGIN
  SELECT kickoff_at INTO k FROM public.matches WHERE id = NEW.match_id;
  IF k IS NULL THEN
    RAISE EXCEPTION 'Match % not found', NEW.match_id;
  END IF;
  IF now() >= k THEN
    RAISE EXCEPTION 'Predictions are locked for this match';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_prediction_lock() FROM PUBLIC;
