
-- Allow feed activities without a specific match (for Karim's daily summary)
ALTER TABLE public.feed_activities ALTER COLUMN match_id DROP NOT NULL;

-- Add body text for narrative feed posts (daily summary)
ALTER TABLE public.feed_activities ADD COLUMN IF NOT EXISTS body text;

-- Extend kind enum-as-check to include daily_summary
ALTER TABLE public.feed_activities DROP CONSTRAINT IF EXISTS feed_activities_kind_check;
ALTER TABLE public.feed_activities ADD CONSTRAINT feed_activities_kind_check
  CHECK (kind = ANY (ARRAY[
    'prediction_created'::text,
    'prediction_updated'::text,
    'points_awarded'::text,
    'daily_summary'::text
  ]));

-- One Karim comment per thread (used by the roast endpoint to stay idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS comments_karim_unique
  ON public.comments (target_type, target_id)
  WHERE player_id = 'ca710000-0000-4000-8000-000000000001'::uuid;
