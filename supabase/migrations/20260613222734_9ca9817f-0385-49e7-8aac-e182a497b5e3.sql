
DROP TRIGGER IF EXISTS trg_emit_prediction_activity ON public.predictions;
DROP TRIGGER IF EXISTS emit_prediction_activity_trigger ON public.predictions;
DROP TRIGGER IF EXISTS emit_prediction_activity ON public.predictions;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.tgname FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND c.relname = 'predictions'
      AND p.proname = 'emit_prediction_activity'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.predictions', r.tgname);
  END LOOP;
END$$;

ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS last_emitted_home int,
  ADD COLUMN IF NOT EXISTS last_emitted_away int,
  ADD COLUMN IF NOT EXISTS last_emitted_at timestamptz;

SET LOCAL "app.bypass_lock" = 'on';

WITH latest AS (
  SELECT DISTINCT ON (actor_id, match_id)
    actor_id, match_id, pred_home, pred_away, created_at
  FROM public.feed_activities
  WHERE kind IN ('prediction_created', 'prediction_updated')
  ORDER BY actor_id, match_id, created_at DESC
)
UPDATE public.predictions p
SET last_emitted_home = l.pred_home,
    last_emitted_away = l.pred_away,
    last_emitted_at   = l.created_at
FROM latest l
WHERE p.player_id = l.actor_id AND p.match_id = l.match_id
  AND p.last_emitted_at IS NULL;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY actor_id, match_id
           ORDER BY created_at DESC
         ) AS rn
  FROM public.feed_activities
  WHERE kind IN ('prediction_created', 'prediction_updated')
)
DELETE FROM public.feed_activities f
USING ranked r
WHERE f.id = r.id AND r.rn > 1;
