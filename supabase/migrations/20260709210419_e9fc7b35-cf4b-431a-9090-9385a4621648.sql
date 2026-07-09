CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  var_report_visible boolean NOT NULL DEFAULT true,
  var_report_popup boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings read all" ON public.app_settings;
CREATE POLICY "app_settings read all" ON public.app_settings FOR SELECT USING (true);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_var_flags(_visible boolean, _popup boolean)
RETURNS public.app_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result public.app_settings;
BEGIN
  UPDATE public.app_settings
    SET var_report_visible = _visible,
        var_report_popup = _popup,
        updated_at = now()
    WHERE id = true
  RETURNING * INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_var_flags(boolean, boolean) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;