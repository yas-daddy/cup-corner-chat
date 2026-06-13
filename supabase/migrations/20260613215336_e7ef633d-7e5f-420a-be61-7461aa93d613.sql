
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL CHECK (kind IN ('like','comment','reply','result')),
  target_type text NOT NULL CHECK (target_type IN ('prediction','activity','match')),
  target_id text NOT NULL,
  match_id text,
  points integer,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications (
  recipient_id, kind, target_type, target_id, COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(points, -1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, anon;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications open" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Reactions trigger
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  mid text;
  sep int;
BEGIN
  IF NEW.target_type = 'prediction' THEN
    sep := position('::' in NEW.target_id);
    IF sep = 0 THEN RETURN NEW; END IF;
    recipient := substring(NEW.target_id from 1 for sep - 1)::uuid;
    mid := substring(NEW.target_id from sep + 2);
  ELSIF NEW.target_type = 'activity' THEN
    SELECT actor_id, match_id INTO recipient, mid
    FROM public.feed_activities WHERE id::text = NEW.target_id;
  ELSE
    RETURN NEW;
  END IF;
  IF recipient IS NULL OR recipient = NEW.player_id THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (recipient_id, actor_id, kind, target_type, target_id, match_id)
  VALUES (recipient, NEW.player_id, 'like', NEW.target_type, NEW.target_id, mid)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reactions_notify AFTER INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- Comments trigger (owner + thread participants)
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
  mid text;
  sep int;
  participant uuid;
BEGIN
  IF NEW.target_type = 'prediction' THEN
    sep := position('::' in NEW.target_id);
    IF sep > 0 THEN
      owner := substring(NEW.target_id from 1 for sep - 1)::uuid;
      mid := substring(NEW.target_id from sep + 2);
    END IF;
  ELSIF NEW.target_type = 'activity' THEN
    SELECT actor_id, match_id INTO owner, mid
    FROM public.feed_activities WHERE id::text = NEW.target_id;
  ELSIF NEW.target_type = 'match' THEN
    mid := NEW.target_id;
  END IF;

  IF owner IS NOT NULL AND owner <> NEW.player_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, kind, target_type, target_id, match_id)
    VALUES (owner, NEW.player_id, 'comment', NEW.target_type, NEW.target_id, mid)
    ON CONFLICT DO NOTHING;
  END IF;

  FOR participant IN
    SELECT DISTINCT player_id FROM public.comments
    WHERE target_type = NEW.target_type AND target_id = NEW.target_id
      AND player_id <> NEW.player_id
      AND (owner IS NULL OR player_id <> owner)
  LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, kind, target_type, target_id, match_id)
    VALUES (participant, NEW.player_id, 'reply', NEW.target_type, NEW.target_id, mid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER comments_notify AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Result trigger on feed_activities
CREATE OR REPLACE FUNCTION public.notify_on_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'points_awarded' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, kind, target_type, target_id, match_id, points)
    VALUES (NEW.actor_id, NULL, 'result', 'activity', NEW.id::text, NEW.match_id, NEW.points)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feed_activities_notify AFTER INSERT ON public.feed_activities
FOR EACH ROW EXECUTE FUNCTION public.notify_on_result();
