ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS last_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS pwa_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pwa_display_mode text;