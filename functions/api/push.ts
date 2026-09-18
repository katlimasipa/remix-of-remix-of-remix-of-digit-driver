import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Rate limiting state (in-memory per isolate)
const RATE_LIMIT = 90;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const VAPID_PUBLIC = env.VAPID_PUBLIC_KEY ?? "BIxX1GfQuYZgk_5CZRU20jnef4kCS4zA4IHtgncuLGtW_toSZUpDHr0Iip1B-SadS0oU7CT3aWQ95FLCQYdWoxA";
  const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = env.VAPID_SUBJECT ?? "mailto:notify@smrttrdr.app";
  const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const corsHeaders = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  };

  const jsonResponse = (data: any, status = 200, headers = {}) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders, ...headers }
    });
  };

  // Same-origin check
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return jsonResponse({ error: "Cross-origin requests are not allowed" }, 403);
      }
    } catch {
      return jsonResponse({ error: "Cross-origin requests are not allowed" }, 403);
    }
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited(\ip:\\)) {
    return jsonResponse({ error: "Too many requests" }, 429, { "Retry-After": "60" });
  }

  let body: any = {};
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const action = url.searchParams.get("action") ?? body?.action;

  if (request.method === "GET" && action === "vapid") {
    return jsonResponse({ publicKey: VAPID_PUBLIC });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Push storage is not configured on the server");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse({ error: "Authentication required" }, 401);
    
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const userId = authError ? null : (authData.user?.id ?? null);
    
    if (!userId) return jsonResponse({ error: "Authentication required" }, 401);

    if (rateLimited(\user:\\)) {
      return jsonResponse({ error: "Too many requests" }, 429, { "Retry-After": "60" });
    }

    if (action === "subscribe") {
      const { endpoint, p256dh, auth, userAgent } = body;
      if (!endpoint || !p256dh || !auth) {
        return jsonResponse({ error: "Missing subscription fields" }, 400);
      }
      const row = {
        owner_key: userId,
        endpoint: String(endpoint).slice(0, 2000),
        p256dh: String(p256dh).slice(0, 500),
        auth: String(auth).slice(0, 500),
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      };
      const { error } = await supabase.from("push_devices").upsert(row, { onConflict: "endpoint" });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (action === "unsubscribe") {
      const { endpoint } = body;
      if (!endpoint) return jsonResponse({ error: "Missing endpoint" }, 400);
      await supabase.from("push_devices").delete().eq("owner_key", userId).eq("endpoint", String(endpoint));
      return jsonResponse({ ok: true });
    }

    if (action === "send") {
      const { title, body: msgBody, tag, url: pushUrl, requireInteraction, vibrate } = body;
      if (!title) return jsonResponse({ error: "Missing title" }, 400);
      
      if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY is not configured");
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

      const { data: subs, error } = await supabase.from("push_devices").select("endpoint, p256dh, auth").eq("owner_key", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!subs?.length) return jsonResponse({ sent: 0 });

      const uniq = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
      for (const s of subs) uniq.set(s.endpoint, s);
      const unique = Array.from(uniq.values());

      const payload = JSON.stringify({
        title: String(title).slice(0, 120),
        body: String(msgBody ?? "").slice(0, 300),
        tag: tag ? String(tag).slice(0, 80) : "smrttrdr",
        url: pushUrl ? String(pushUrl).slice(0, 500) : "/",
        requireInteraction: !!requireInteraction,
        vibrate: Array.isArray(vibrate) ? vibrate : undefined,
      });

      const expired: string[] = [];
      let sent = 0;
      await Promise.all(
        unique.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 });
            sent++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(s.endpoint);
          }
        })
      );
      if (expired.length) {
        await supabase.from("push_devices").delete().in("endpoint", expired);
      }
      return jsonResponse({ sent });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return jsonResponse({ error: e.message || "Push handler failed" }, 500);
  }
}
