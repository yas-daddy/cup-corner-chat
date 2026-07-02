-- Squads / rosters for WC26. Populated from Wikipedia via the
-- /api/public/sync-squads route. Squads barely change during the
-- tournament so a daily cron is plenty.
-- Table named squad_players deliberately — we already have public.players
-- for our human users.

CREATE TABLE public.squad_players (
  id text PRIMARY KEY,                   -- 'wiki:{team_code}:{slugified_name}'
  team_code text NOT NULL,
  full_name text NOT NULL,
  display_name text,
  jersey_number smallint,
  position text,                         -- 'GK' | 'D' | 'M' | 'F'
  club text,
  club_country_code text,
  image_url text,
  dob date,
  height_cm smallint,
  captain boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX squad_players_team_idx ON public.squad_players (team_code);
CREATE INDEX squad_players_pos_idx ON public.squad_players (team_code, position);

ALTER TABLE public.squad_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_players read all" ON public.squad_players FOR SELECT USING (true);
GRANT SELECT ON public.squad_players TO anon, authenticated;
GRANT ALL ON public.squad_players TO service_role;
