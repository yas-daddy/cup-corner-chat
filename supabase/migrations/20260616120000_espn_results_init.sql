-- Results tab: ESPN-backed mirror tables, realtime, 60s pg_cron poll.
-- Purely additive. The prediction game keeps scoring against public.matches —
-- nothing here writes to it.

-- 1) Fixtures mirrored from ESPN scoreboard
CREATE TABLE public.espn_matches (
  id text PRIMARY KEY,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_code text,
  away_code text,
  home_logo text,
  away_logo text,
  home_score int,
  away_score int,
  kickoff_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pre',
  completed boolean NOT NULL DEFAULT false,
  clock_display text,
  status_detail text,
  group_label text,
  stage text,
  linked_match_id text REFERENCES public.matches(id) ON DELETE SET NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX espn_matches_kickoff_idx ON public.espn_matches (kickoff_at);
CREATE INDEX espn_matches_state_idx ON public.espn_matches (state);

-- 2) Key events (goals, cards) per match
CREATE TABLE public.espn_match_events (
  match_id text NOT NULL REFERENCES public.espn_matches(id) ON DELETE CASCADE,
  idx int NOT NULL,
  type_text text NOT NULL,
  clock_display text,
  team_code text,
  athlete_name text,
  is_scoring_play boolean NOT NULL DEFAULT false,
  is_penalty boolean NOT NULL DEFAULT false,
  is_own_goal boolean NOT NULL DEFAULT false,
  payload jsonb,
  PRIMARY KEY (match_id, idx)
);
CREATE INDEX espn_match_events_match_idx ON public.espn_match_events (match_id);

-- 3) Group standings
CREATE TABLE public.espn_standings (
  group_label text NOT NULL,
  team_code text NOT NULL,
  team_name text NOT NULL,
  team_logo text,
  gp int NOT NULL DEFAULT 0,
  w int NOT NULL DEFAULT 0,
  d int NOT NULL DEFAULT 0,
  l int NOT NULL DEFAULT 0,
  gf int NOT NULL DEFAULT 0,
  ga int NOT NULL DEFAULT 0,
  gd int NOT NULL DEFAULT 0,
  pts int NOT NULL DEFAULT 0,
  rank int,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_label, team_code)
);
CREATE INDEX espn_standings_group_idx ON public.espn_standings (group_label, rank);

-- RLS: read-only for clients, writes via service_role only
ALTER TABLE public.espn_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.espn_match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.espn_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "espn_matches read" ON public.espn_matches FOR SELECT USING (true);
CREATE POLICY "espn_match_events read" ON public.espn_match_events FOR SELECT USING (true);
CREATE POLICY "espn_standings read" ON public.espn_standings FOR SELECT USING (true);

GRANT SELECT ON public.espn_matches, public.espn_match_events, public.espn_standings TO anon, authenticated;
GRANT ALL ON public.espn_matches, public.espn_match_events, public.espn_standings TO service_role;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.espn_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.espn_match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.espn_standings;

-- 60s cron: hit the /api/public/sync-espn route every minute
SELECT cron.schedule(
  'sync-espn-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--bdd50858-c6d6-4698-b754-84bbaed5dc0b.lovable.app/api/public/sync-espn',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aiEVl5kzyeo3ABrxXxbChQ_dFWY17_L'
    ),
    body := '{}'::jsonb
  );
  $$
);
