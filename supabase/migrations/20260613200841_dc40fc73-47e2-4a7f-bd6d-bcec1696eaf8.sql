
-- Bypass the enforce_prediction_lock trigger for this seed
SET LOCAL session_replication_role = 'replica';

-- Matches (WC26 group stage)
INSERT INTO public.matches (id, home_team, away_team, home_code, away_code, kickoff_at, stage, group_name, status)
VALUES
  ('wc26:1',  'Mexico',                 'South Africa',  'MX','ZA','2026-06-12 01:00:00+00','GROUP_STAGE','A','SCHEDULED'),
  ('wc26:3',  'Canada',                 'Bosnia and Herzegovina','CA','BA','2026-06-12 23:00:00+00','GROUP_STAGE','B','SCHEDULED'),
  ('wc26:4',  'United States',          'Paraguay',      'US','PY','2026-06-13 01:00:00+00','GROUP_STAGE','D','SCHEDULED'),
  ('wc26:8',  'Qatar',                  'Switzerland',   'QA','CH','2026-06-13 19:00:00+00','GROUP_STAGE','B','SCHEDULED'),
  ('wc26:7',  'Brazil',                 'Morocco',       'BR','MA','2026-06-13 22:00:00+00','GROUP_STAGE','C','SCHEDULED'),
  ('wc26:5',  'Haiti',                  'Scotland',      'HT','GB','2026-06-14 01:00:00+00','GROUP_STAGE','C','SCHEDULED'),
  ('wc26:6',  'Australia',              'Türkiye',       'AU','TR','2026-06-14 04:00:00+00','GROUP_STAGE','D','SCHEDULED')
ON CONFLICT (id) DO NOTHING;

-- Players
INSERT INTO public.players (display_name)
SELECT n FROM (VALUES ('Taha'),('Ali'),('Amin'),('Yasin'),('Ebrahim'),('Melika'),('Mehdi'),('Ala')) AS t(n)
WHERE NOT EXISTS (SELECT 1 FROM public.players p WHERE lower(p.display_name) = lower(t.n));

-- Predictions: (player_name, match_id, pred_home, pred_away)
WITH preds(name, match_id, h, a) AS (
  VALUES
    -- Mexico vs South Africa (wc26:1)
    ('Taha','wc26:1',2,0), ('Ali','wc26:1',2,0), ('Amin','wc26:1',3,1),
    ('Yasin','wc26:1',1,0), ('Ebrahim','wc26:1',1,0), ('Melika','wc26:1',2,1),
    -- Canada vs Bosnia (wc26:3)
    ('Taha','wc26:3',1,1), ('Melika','wc26:3',1,0), ('Mehdi','wc26:3',1,2),
    -- USA vs Paraguay (wc26:4)
    ('Taha','wc26:4',2,1), ('Mehdi','wc26:4',1,1),
    -- Qatar vs Switzerland (wc26:8)  [home=Qatar, away=Switzerland]
    ('Ali','wc26:8',1,3), ('Amin','wc26:8',2,4), ('Mehdi','wc26:8',0,2),
    ('Melika','wc26:8',0,2), ('Yasin','wc26:8',0,2), ('Ala','wc26:8',0,1),
    ('Taha','wc26:8',0,3),
    -- Brazil vs Morocco (wc26:7)
    ('Ali','wc26:7',2,1), ('Amin','wc26:7',2,2), ('Mehdi','wc26:7',0,0),
    ('Melika','wc26:7',1,1), ('Yasin','wc26:7',1,0), ('Ala','wc26:7',1,1),
    -- Haiti vs Scotland (wc26:5)  [home=Haiti, away=Scotland]
    ('Amin','wc26:5',0,0), ('Mehdi','wc26:5',0,1), ('Melika','wc26:5',0,2),
    ('Yasin','wc26:5',0,2), ('Ala','wc26:5',0,0),
    -- Australia vs Türkiye (wc26:6)  [home=Australia, away=Türkiye]
    ('Amin','wc26:6',1,1), ('Mehdi','wc26:6',1,2), ('Yasin','wc26:6',1,1),
    ('Ala','wc26:6',1,1)
)
INSERT INTO public.predictions (player_id, match_id, pred_home, pred_away)
SELECT p.id, preds.match_id, preds.h, preds.a
FROM preds
JOIN public.players p ON lower(p.display_name) = lower(preds.name)
ON CONFLICT DO NOTHING;
