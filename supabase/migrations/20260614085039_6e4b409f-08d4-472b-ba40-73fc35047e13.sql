
CREATE OR REPLACE FUNCTION public.enforce_champion_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_lock', true) = 'on' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF now() >= timestamptz '2026-06-20 00:00:00+00' THEN
    RAISE EXCEPTION 'Champion prediction is locked';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_champion(_player_id uuid, _team text, _team_code text)
RETURNS public.champion_predictions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result public.champion_predictions;
BEGIN
  PERFORM set_config('app.bypass_lock', 'on', true);
  INSERT INTO public.champion_predictions(player_id, team, team_code)
  VALUES (_player_id, _team, NULLIF(_team_code, ''))
  ON CONFLICT (player_id) DO UPDATE
    SET team = EXCLUDED.team,
        team_code = EXCLUDED.team_code
  RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_champion(_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.bypass_lock', 'on', true);
  DELETE FROM public.champion_predictions WHERE player_id = _player_id;
END;
$$;
