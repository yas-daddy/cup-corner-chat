-- "That's all folks" finale takeover: a god-mode switch that replaces the
-- Picks home tab with the closing-credits animation + VAR Report prompt for
-- EVERYONE. Third flag on the app_settings singleton; realtime already covers
-- the table, so flipping it propagates to open clients instantly.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS finale_takeover boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_set_finale_takeover(_on boolean)
RETURNS public.app_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result public.app_settings;
BEGIN
  UPDATE public.app_settings
    SET finale_takeover = _on,
        updated_at = now()
    WHERE id = true
  RETURNING * INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_finale_takeover(boolean) TO anon, authenticated;
