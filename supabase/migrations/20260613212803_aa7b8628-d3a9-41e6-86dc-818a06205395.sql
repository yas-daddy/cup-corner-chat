
-- feed_activities
CREATE TABLE public.feed_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('prediction_created','prediction_updated','points_awarded')),
  actor_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  match_id text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  pred_home int,
  pred_away int,
  home_score int,
  away_score int,
  points int,
  is_exact boolean,
  is_correct_result boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feed_activities_created_idx ON public.feed_activities (created_at DESC);
CREATE INDEX feed_activities_match_idx ON public.feed_activities (match_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_activities TO anon, authenticated;
GRANT ALL ON public.feed_activities TO service_role;
ALTER TABLE public.feed_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_activities open" ON public.feed_activities FOR ALL USING (true) WITH CHECK (true);

-- reactions
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('activity','prediction')),
  target_id text NOT NULL,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, player_id)
);
CREATE INDEX reactions_target_idx ON public.reactions (target_type, target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO anon, authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions open" ON public.reactions FOR ALL USING (true) WITH CHECK (true);

-- comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('activity','prediction','match')),
  target_id text NOT NULL,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_target_idx ON public.comments (target_type, target_id);
CREATE INDEX comments_created_idx ON public.comments (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO anon, authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments open" ON public.comments FOR ALL USING (true) WITH CHECK (true);

-- Trigger: emit feed activity on predictions
CREATE OR REPLACE FUNCTION public.emit_prediction_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feed_activities (kind, actor_id, match_id, pred_home, pred_away)
  VALUES (
    CASE WHEN TG_OP = 'INSERT' THEN 'prediction_created' ELSE 'prediction_updated' END,
    NEW.player_id, NEW.match_id, NEW.pred_home, NEW.pred_away
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER predictions_emit_activity
AFTER INSERT OR UPDATE OF pred_home, pred_away ON public.predictions
FOR EACH ROW EXECUTE FUNCTION public.emit_prediction_activity();

-- Trigger: when a match becomes FINISHED (or score changes while finished), emit points_awarded for each prediction
CREATE OR REPLACE FUNCTION public.emit_match_finished_activities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'FINISHED'
     AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM 'FINISHED'
       OR OLD.home_score IS DISTINCT FROM NEW.home_score
       OR OLD.away_score IS DISTINCT FROM NEW.away_score
     )
  THEN
    -- Clear prior points_awarded for this match to keep feed consistent on re-scoring
    DELETE FROM public.feed_activities WHERE match_id = NEW.id AND kind = 'points_awarded';
    INSERT INTO public.feed_activities (kind, actor_id, match_id, pred_home, pred_away, home_score, away_score, points, is_exact, is_correct_result)
    SELECT
      'points_awarded',
      p.player_id, p.match_id, p.pred_home, p.pred_away, NEW.home_score, NEW.away_score,
      CASE
        WHEN p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score THEN 8
        WHEN sign(p.pred_home - p.pred_away) = sign(NEW.home_score - NEW.away_score) THEN 3
        ELSE 0
      END,
      (p.pred_home = NEW.home_score AND p.pred_away = NEW.away_score),
      (sign(p.pred_home - p.pred_away) = sign(NEW.home_score - NEW.away_score))
    FROM public.predictions p WHERE p.match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_emit_finished
AFTER UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.emit_match_finished_activities();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
