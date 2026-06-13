
SET LOCAL session_replication_role = 'replica';

INSERT INTO public.matches (id, home_team, away_team, home_code, away_code, kickoff_at, stage, group_name, status)
VALUES ('wc26:2','Korea Republic','Czechia','KR','CZ','2026-06-12 02:00:00+00','GROUP_STAGE','A','SCHEDULED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.predictions (player_id, match_id, pred_home, pred_away)
SELECT p.id, 'wc26:2', 1, 0 FROM public.players p WHERE lower(p.display_name) = 'taha'
ON CONFLICT DO NOTHING;
