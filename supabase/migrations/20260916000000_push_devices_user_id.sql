ALTER TABLE public.push_devices DROP CONSTRAINT IF EXISTS push_devices_endpoint_key;
ALTER TABLE public.push_devices RENAME COLUMN owner_key TO user_id;
ALTER TABLE public.push_devices ADD CONSTRAINT push_devices_user_endpoint_key UNIQUE (user_id, endpoint);
