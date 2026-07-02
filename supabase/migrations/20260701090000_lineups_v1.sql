-- Match lineups: starting XI + bench per match, per team.
-- Fetched from ESPN's per-event summary endpoint by sync-espn once ESPN
-- publishes the sheet (~15-30 min before kickoff). No mid-match refresh —
-- we capture the sheet once and leave it alone.

CREATE TABLE public.match_lineups (
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_code text NOT NULL,
  idx smallint NOT NULL,
  full_name text NOT NULL,
  jersey_number smallint,
  position text,
  is_starter boolean NOT NULL DEFAULT true,
  captain boolean NOT NULL DEFAULT false,
  formation text,
  espn_player_id text,
  PRIMARY KEY (match_id, team_code, idx)
);
CREATE INDEX match_lineups_match_idx ON public.match_lineups (match_id);

ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_lineups read all" ON public.match_lineups FOR SELECT USING (true);
GRANT SELECT ON public.match_lineups TO anon, authenticated;
GRANT ALL ON public.match_lineups TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_lineups;
