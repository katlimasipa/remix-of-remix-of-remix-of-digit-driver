CREATE TABLE public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_devices_user_endpoint_key UNIQUE (user_id, endpoint)
);
GRANT INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users register their own push devices"
  ON public.push_devices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own push devices"
  ON public.push_devices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove their own push devices"
  ON public.push_devices FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX push_devices_user_id_idx ON public.push_devices(user_id);
CREATE OR REPLACE FUNCTION public.touch_push_device_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER push_devices_touch_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW EXECUTE FUNCTION public.touch_push_device_updated_at();