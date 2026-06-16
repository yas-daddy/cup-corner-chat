
CREATE TABLE public.espn_matches (
  id text PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_code text,
  away_code text,
  home_logo text,
  away_logo text,
  home_score integer,
  away_score integer,
  kickoff_at timestamptz NOT NULL,
  state text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  clock_display text,
  status_detail text,
  group_label text,
  stage text,
  linked_match_id text,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.espn_matches TO anon, authenticated;
GRANT ALL ON public.espn_matches TO service_role;
ALTER TABLE public.espn_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read espn_matches" ON public.espn_matches FOR SELECT USING (true);

CREATE TABLE public.espn_match_events (
  match_id text NOT NULL,
  idx integer NOT NULL,
  type_text text NOT NULL,
  clock_display text,
  team_code text,
  athlete_name text,
  is_scoring_play boolean NOT NULL DEFAULT false,
  is_penalty boolean NOT NULL DEFAULT false,
  is_own_goal boolean NOT NULL DEFAULT false,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, idx)
);
GRANT SELECT ON public.espn_match_events TO anon, authenticated;
GRANT ALL ON public.espn_match_events TO service_role;
ALTER TABLE public.espn_match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read espn_match_events" ON public.espn_match_events FOR SELECT USING (true);
CREATE INDEX espn_match_events_match_id_idx ON public.espn_match_events(match_id);

CREATE TABLE public.espn_standings (
  group_label text NOT NULL,
  team_code text NOT NULL,
  team_name text NOT NULL,
  team_logo text,
  gp integer NOT NULL DEFAULT 0,
  w integer NOT NULL DEFAULT 0,
  d integer NOT NULL DEFAULT 0,
  l integer NOT NULL DEFAULT 0,
  gf integer NOT NULL DEFAULT 0,
  ga integer NOT NULL DEFAULT 0,
  gd integer NOT NULL DEFAULT 0,
  pts integer NOT NULL DEFAULT 0,
  rank integer,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_label, team_code)
);
GRANT SELECT ON public.espn_standings TO anon, authenticated;
GRANT ALL ON public.espn_standings TO service_role;
ALTER TABLE public.espn_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read espn_standings" ON public.espn_standings FOR SELECT USING (true);
