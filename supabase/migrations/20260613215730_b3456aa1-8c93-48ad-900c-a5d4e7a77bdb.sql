
CREATE TABLE public.champion_predictions (
  player_id uuid PRIMARY KEY,
  team text NOT NULL,
  team_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.champion_predictions TO authenticated, anon;
GRANT ALL ON public.champion_predictions TO service_role;

ALTER TABLE public.champion_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champion_predictions open" ON public.champion_predictions FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enforce_champion_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF now() >= timestamptz '2026-06-20 00:00:00+00' THEN
    RAISE EXCEPTION 'Champion prediction is locked';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER champion_predictions_lock
BEFORE INSERT OR UPDATE ON public.champion_predictions
FOR EACH ROW EXECUTE FUNCTION public.enforce_champion_lock();
