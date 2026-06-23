import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  console.error("Set DATABASE_URL (Supabase connection URI) and rerun.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "../supabase/migrations/20260623180000_push_devices.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(sql);
await client.end();
console.log("push_devices table ready.");
