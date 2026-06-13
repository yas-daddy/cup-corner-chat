
CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  k timestamptz;
BEGIN
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
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
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_prediction(
  _player_id uuid,
  _match_id text,
  _home int,
  _away int
) RETURNS public.predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.predictions;
BEGIN
  PERFORM set_config('app.bypass_lock', 'on', true);
  INSERT INTO public.predictions(player_id, match_id, pred_home, pred_away)
  VALUES (_player_id, _match_id, _home, _away)
  ON CONFLICT (player_id, match_id) DO UPDATE
    SET pred_home = EXCLUDED.pred_home,
        pred_away = EXCLUDED.pred_away
  RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_prediction(
  _player_id uuid,
  _match_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_lock', 'on', true);
  DELETE FROM public.predictions
   WHERE player_id = _player_id AND match_id = _match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_prediction(uuid, text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_prediction(uuid, text) TO anon, authenticated;
