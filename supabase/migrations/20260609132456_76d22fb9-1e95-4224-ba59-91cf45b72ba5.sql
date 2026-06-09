ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deriv_oauth_token TEXT,
  ADD COLUMN IF NOT EXISTS deriv_oauth_expires_at TIMESTAMPTZ;