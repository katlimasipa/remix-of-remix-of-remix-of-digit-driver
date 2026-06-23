import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC =
  process.env.VAPID_PUBLIC_KEY ??
  "BCHwuEFHo7loPQdF5Ec0EXzqqb9TvG2gWEjliPmjlvutxdusFd0AokdtX6B6ixpC0Hcn4tbC9haqk7trObpj2KA";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:notify@smrttrdr.app";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

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
    if (action === "subscribe") {
      const { ownerKey, endpoint, p256dh, auth, userAgent } = req.body ?? {};
      if (!ownerKey || !endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing subscription fields" });
      }
      const supabase = getAdmin();
      const { error } = await supabase.from("push_devices").upsert(
        {
          owner_key: String(ownerKey).slice(0, 500),
          endpoint: String(endpoint).slice(0, 2000),
          p256dh: String(p256dh).slice(0, 500),
          auth: String(auth).slice(0, 500),
          user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        },
        { onConflict: "endpoint" },
      );
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === "unsubscribe") {
      const { endpoint } = req.body ?? {};
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
      const supabase = getAdmin();
      await supabase.from("push_devices").delete().eq("endpoint", String(endpoint));
      return res.status(200).json({ ok: true });
    }

    if (action === "send") {
      const { ownerKey, title, body, tag, url, requireInteraction, vibrate } = req.body ?? {};
      if (!ownerKey || !title) {
        return res.status(400).json({ error: "Missing ownerKey or title" });
      }
      configureWebPush();
      const supabase = getAdmin();
      const { data: subs, error } = await supabase
        .from("push_devices")
        .select("endpoint, p256dh, auth")
        .eq("owner_key", String(ownerKey));
      if (error) return res.status(500).json({ error: error.message });
      if (!subs?.length) return res.status(200).json({ sent: 0 });

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
        subs.map(async (s) => {
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
