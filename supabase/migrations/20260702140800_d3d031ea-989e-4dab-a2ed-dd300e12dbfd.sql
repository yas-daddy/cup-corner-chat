
CREATE TABLE IF NOT EXISTS public.match_lineups (
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_code text NOT NULL,
  idx integer NOT NULL,
  full_name text NOT NULL,
  jersey_number integer,
  position text,
  is_starter boolean NOT NULL DEFAULT false,
  captain boolean NOT NULL DEFAULT false,
  formation text,
  espn_player_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, team_code, idx)
);

GRANT SELECT ON public.match_lineups TO anon, authenticated;
GRANT ALL ON public.match_lineups TO service_role;

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_lineups readable by all"
  ON public.match_lineups FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS match_lineups_match_idx ON public.match_lineups(match_id);

CREATE OR REPLACE FUNCTION public.match_lineups_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_lineups_touch_updated_at ON public.match_lineups;
CREATE TRIGGER match_lineups_touch_updated_at
  BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.match_lineups_touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_lineups'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.match_lineups';
  END IF;
END $$;
