-- VAR Report analytics: log each time a player opens their report so god mode
-- can show unique openers + total watches.

CREATE TABLE IF NOT EXISTS public.var_report_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS var_report_views_player_idx ON public.var_report_views (player_id);

ALTER TABLE public.var_report_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "var_report_views read all" ON public.var_report_views;
CREATE POLICY "var_report_views read all" ON public.var_report_views FOR SELECT USING (true);
GRANT SELECT ON public.var_report_views TO anon, authenticated;
GRANT ALL ON public.var_report_views TO service_role;

-- Client logs a watch through this (PIN-less; best-effort analytics).
CREATE OR REPLACE FUNCTION public.log_var_report_view(_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.var_report_views(player_id) VALUES (_player_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_var_report_view(uuid) TO anon, authenticated;

CREATE OR REPLACE VIEW public.var_report_view_stats AS
SELECT
  count(*)::int AS total_views,
  count(DISTINCT player_id)::int AS unique_openers
FROM public.var_report_views;
ALTER VIEW public.var_report_view_stats SET (security_invoker = on);
GRANT SELECT ON public.var_report_view_stats TO anon, authenticated;
