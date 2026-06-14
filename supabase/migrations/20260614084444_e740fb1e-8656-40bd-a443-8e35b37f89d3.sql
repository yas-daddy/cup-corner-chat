
-- push_subscriptions: one row per browser/device subscription
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_player_idx ON public.push_subscriptions (player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated, anon;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions open" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- push_seen_matches: dedupe new-fixture pushes per player
CREATE TABLE public.push_seen_matches (
  player_id uuid NOT NULL,
  match_id text NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, match_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_seen_matches TO authenticated, anon;
GRANT ALL ON public.push_seen_matches TO service_role;
ALTER TABLE public.push_seen_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_seen_matches open" ON public.push_seen_matches FOR ALL USING (true) WITH CHECK (true);

-- Trigger: on new notification, ping the /api/public/send-push route
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--bdd50858-c6d6-4698-b754-84bbaed5dc0b.lovable.app/api/public/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_aiEVl5kzyeo3ABrxXxbChQ_dFWY17_L'
    ),
    body := jsonb_build_object('notification_id', NEW.id::text)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_push_on_notification_trg
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();
