ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS deriv_token_demo text,
  ADD COLUMN IF NOT EXISTS deriv_token_real text,
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'demo';

-- Migrate existing token to demo slot
UPDATE public.profiles SET deriv_token_demo = deriv_token WHERE deriv_token_demo IS NULL AND deriv_token IS NOT NULL;