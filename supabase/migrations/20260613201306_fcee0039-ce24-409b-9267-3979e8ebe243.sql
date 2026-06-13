
SET LOCAL session_replication_role = 'replica';

WITH mapping(old_id, new_id) AS (
  VALUES
    ('wc26:1','fd:537327'),
    ('wc26:2','fd:537328'),
    ('wc26:3','fd:537333'),
    ('wc26:4','fd:537345'),
    ('wc26:5','fd:537340'),
    ('wc26:6','fd:537346'),
    ('wc26:7','fd:537339'),
    ('wc26:8','fd:537334')
)
UPDATE predictions p
SET match_id = m.new_id
FROM mapping m
WHERE p.match_id = m.old_id;

DELETE FROM matches WHERE id IN
  ('wc26:1','wc26:2','wc26:3','wc26:4','wc26:5','wc26:6','wc26:7','wc26:8');
