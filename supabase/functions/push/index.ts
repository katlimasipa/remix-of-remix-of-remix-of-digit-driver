// Cross-device Web Push for signed-in app users.
// Stores each browser/phone subscription per user and fans out alerts to every one.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createECDH } from "node:crypto";

const VAPID_PUBLIC =
  "BIxX1GfQuYZgk_5CZRU20jnef4kCS4zA4IHtgncuLGtW_toSZUpDHr0Iip1B-SadS0oU7CT3aWQ95FLCQYdWoxA";
const VAPID_SUBJECT = "mailto:support@thdpstsmrttrdr.co.za";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const RATE_LIMIT = 90;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || now > e.resetAt) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  e.count += 1;
  return e.count > RATE_LIMIT;
}

function b64urlToBuf(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
function bufToB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function vapidKeysMatch(priv: string): boolean {
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(b64urlToBuf(priv));
    return bufToB64url(new Uint8Array(ecdh.getPublicKey())) === VAPID_PUBLIC;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PRIVATE = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = String(body.action ?? "");

  if (action === "health") {
    return json({ ok: true, vapidConfigured: !!VAPID_PRIVATE, vapidPairOk: vapidKeysMatch(VAPID_PRIVATE) });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Authentication required" }, 401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const userId = authError ? null : authData.user?.id;
  if (!userId) return json({ error: "Authentication required" }, 401);
  if (rateLimited(userId)) return json({ error: "Too many requests" }, 429);

  try {
    if (action === "subscribe") {
      const { endpoint, p256dh, auth, userAgent } = body as Record<string, string>;
      if (!endpoint || !p256dh || !auth) return json({ error: "Missing subscription fields" }, 400);
      const ep = String(endpoint).slice(0, 2000);
      // A browser belongs to whoever is signed in on it now.
      await admin.from("push_devices").delete().eq("endpoint", ep).neq("user_id", userId);
      const { error } = await admin.from("push_devices").upsert(
        {
          user_id: userId,
          endpoint: ep,
          p256dh: String(p256dh).slice(0, 500),
          auth: String(auth).slice(0, 500),
          user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error) return json({ error: error.message }, 500);
      const { count } = await admin
        .from("push_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      return json({ ok: true, devices: count ?? 0 });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint ?? "");
      if (!endpoint) return json({ error: "Missing endpoint" }, 400);
      await admin.from("push_devices").delete().eq("user_id", userId).eq("endpoint", endpoint);
      return json({ ok: true });
    }

    if (action === "devices") {
      const { count } = await admin
        .from("push_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      return json({ devices: count ?? 0 });
    }

    if (action === "send") {
      const title = String(body.title ?? "");
      if (!title) return json({ error: "Missing title" }, 400);
      if (!VAPID_PRIVATE) return json({ error: "VAPID_PRIVATE_KEY is not configured" }, 500);
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

      const { data: subs, error } = await admin
        .from("push_devices")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 500);
      if (!subs?.length) return json({ sent: 0, devices: 0 });

      const payload = JSON.stringify({
        title: title.slice(0, 120),
        body: String(body.body ?? "").slice(0, 300),
        tag: body.tag ? String(body.tag).slice(0, 80) : "smrttrdr",
        url: body.url ? String(body.url).slice(0, 500) : "/dashboard",
        requireInteraction: !!body.requireInteraction,
        vibrate: Array.isArray(body.vibrate) ? body.vibrate : undefined,
      });

      const expired: string[] = [];
      const failures: { status?: number; message: string }[] = [];
      let sent = 0;
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 3600, urgency: "high" },
            );
            sent++;
          } catch (err) {
            const e = err as { statusCode?: number; body?: string; message?: string };
            if (e.statusCode === 404 || e.statusCode === 410) expired.push(s.endpoint);
            failures.push({ status: e.statusCode, message: String(e.body || e.message || err).slice(0, 200) });
          }
        }),
      );
      if (expired.length) await admin.from("push_devices").delete().in("endpoint", expired);
      if (failures.length) console.warn("push failures", JSON.stringify(failures));
      return json({ sent, devices: subs.length, failed: failures.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("push handler error", e);
    return json({ error: e instanceof Error ? e.message : "Push handler failed" }, 500);
  }
});
