-- Push subscriptions keyed by Deriv account set (OAuth flow; no Supabase auth user).
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_devices_owner_idx ON public.push_devices(owner_key);

GRANT ALL ON public.push_devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO anon, authenticated;

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_devices_api_access"
  ON public.push_devices
  FOR ALL
  USING (true)
  WITH CHECK (true);
