
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  k timestamptz;
BEGIN
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Allow non-score updates (e.g. last_emitted_* bookkeeping) even after lock
  IF TG_OP = 'UPDATE'
     AND NEW.pred_home IS NOT DISTINCT FROM OLD.pred_home
     AND NEW.pred_away IS NOT DISTINCT FROM OLD.pred_away
  THEN
    RETURN NEW;
  END IF;

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
$function$;
