import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ??
  "BIxX1GfQuYZgk_5CZRU20jnef4kCS4zA4IHtgncuLGtW_toSZUpDHr0Iip1B-SadS0oU7CT3aWQ95FLCQYdWoxA";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:notify@smrttrdr.app";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdmin() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Push storage is not configured on the server");
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configureWebPush() {
  if (!VAPID_PRIVATE) throw new Error("VAPID_PRIVATE_KEY is not configured");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

async function requireUserId(req: VercelRequest): Promise<string | null> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await getAdmin().auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

// Simple in-memory rate limiter (per warm serverless instance).
const RATE_LIMIT = 90; // requests
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

function sameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser / same-origin form posts
  const host = req.headers.host;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Origin");

  // No cross-origin API access: this endpoint is only for this app.
  if (!sameOrigin(req)) {
    return res.status(403).json({ error: "Cross-origin requests are not allowed" });
  }

  const ipHeader = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader)?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(`ip:${ip}`)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests" });
  }

  const action =
    (typeof req.query.action === "string" ? req.query.action : undefined) ??
    (typeof req.body?.action === "string" ? req.body.action : undefined);

  if (req.method === "GET" && action === "vapid") {
    return res.status(200).json({ publicKey: VAPID_PUBLIC });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await requireUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    if (rateLimited(`user:${userId}`)) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Too many requests" });
    }


    if (action === "subscribe") {
      const { endpoint, p256dh, auth, userAgent } = req.body ?? {};
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing subscription fields" });
      }
      const supabase = getAdmin();
      const row = {
        user_id: userId,
        endpoint: String(endpoint).slice(0, 2000),
        p256dh: String(p256dh).slice(0, 500),
        auth: String(auth).slice(0, 500),
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      };
      const { error } = await supabase
        .from("push_devices")
        .upsert(row, { onConflict: "user_id,endpoint" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "unsubscribe") {
      const { endpoint } = req.body ?? {};
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
      const supabase = getAdmin();
      await supabase
        .from("push_devices")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", String(endpoint));
      return res.status(200).json({ ok: true });
    }

    if (action === "send") {
      const { title, body, tag, url, requireInteraction, vibrate } = req.body ?? {};
      if (!title) return res.status(400).json({ error: "Missing title" });
      configureWebPush();
      const supabase = getAdmin();
      const { data: subs, error } = await supabase
        .from("push_devices")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);
      if (error) return res.status(500).json({ error: error.message });
      if (!subs?.length) return res.status(200).json({ sent: 0 });
      // Deduplicate defensively in case a stale duplicate exists.
      const uniq = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
      for (const s of subs) uniq.set(s.endpoint, s);
      const unique = Array.from(uniq.values());

      const payload = JSON.stringify({
        title: String(title).slice(0, 120),
        body: String(body ?? "").slice(0, 300),
        tag: tag ? String(tag).slice(0, 80) : "smrttrdr",
        url: url ? String(url).slice(0, 500) : "/",
        requireInteraction: !!requireInteraction,
        vibrate: Array.isArray(vibrate) ? vibrate : undefined,
      });

      const expired: string[] = [];
      let sent = 0;
      await Promise.all(
        unique.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 60 },
            );
            sent++;
          } catch (err: unknown) {
            const code = (err as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) expired.push(s.endpoint);
          }
        }),
      );
      if (expired.length) {
        await supabase.from("push_devices").delete().in("endpoint", expired);
      }
      return res.status(200).json({ sent });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Push handler failed";
    return res.status(500).json({ error: message });
  }
}
