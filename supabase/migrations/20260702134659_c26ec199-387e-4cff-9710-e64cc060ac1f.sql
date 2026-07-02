
CREATE TABLE IF NOT EXISTS public.squad_players (
  id text PRIMARY KEY,
  team_code text NOT NULL,
  full_name text NOT NULL,
  display_name text,
  jersey_number int,
  position text CHECK (position IN ('GK','D','M','F')),
  club text,
  club_country_code text,
  image_url text,
  dob date,
  height_cm int,
  captain boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS squad_players_team_code_idx ON public.squad_players(team_code);

GRANT SELECT ON public.squad_players TO anon, authenticated;
GRANT ALL ON public.squad_players TO service_role;

ALTER TABLE public.squad_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Squads are publicly readable" ON public.squad_players;
CREATE POLICY "Squads are publicly readable"
  ON public.squad_players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages squads" ON public.squad_players;
CREATE POLICY "Service role manages squads"
  ON public.squad_players FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.squad_players_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_squad_players_updated_at ON public.squad_players;
CREATE TRIGGER trg_squad_players_updated_at
  BEFORE UPDATE ON public.squad_players
  FOR EACH ROW EXECUTE FUNCTION public.squad_players_touch_updated_at();
