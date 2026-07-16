import type { VercelRequest, VercelResponse } from "@vercel/node";
import pg from "pg";

const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_devices'::regclass
      AND contype = 'u'
      AND conname = 'push_devices_endpoint_key'
  ) THEN
    ALTER TABLE public.push_devices DROP CONSTRAINT push_devices_endpoint_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_devices'::regclass
      AND contype = 'u'
      AND conname = 'push_devices_endpoint_owner_key'
  ) THEN
    ALTER TABLE public.push_devices
      ADD CONSTRAINT push_devices_endpoint_owner_key UNIQUE (endpoint, owner_key);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS push_devices_owner_idx ON public.push_devices(owner_key);
GRANT ALL ON public.push_devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO anon, authenticated;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_devices' AND policyname = 'push_devices_api_access'
  ) THEN
    CREATE POLICY push_devices_api_access ON public.push_devices FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const expected = process.env.PUSH_SETUP_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: "DATABASE_URL is not configured" });
  }

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(SETUP_SQL);
    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Setup failed";
    return res.status(500).json({ error: message });
  } finally {
    await client.end().catch(() => {});
  }
}
