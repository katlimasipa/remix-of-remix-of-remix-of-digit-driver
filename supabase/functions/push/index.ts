// Web Push relay: subscribe / unsubscribe / send.
// Called by the authenticated client via supabase.functions.invoke("push", { body }).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const VAPID_PUBLIC_KEY =
  "BA5_emacth6TtdY5059cT8eBoGtVhUY1YiyA_3FsXq7F68TdJVfHcL-tJgE0S-LSHjEXNulDvgdsNwL50Zmk6aM";
const VAPID_PRIVATE_KEY = "oFiys_YUOuT_orQ3ZVDfEGRmCBrMBQocoNfk_7f2pFw";
webpush.setVapidDetails("mailto:notifications@smrttrdr.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userRes.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const action = String(body.action ?? "");

  if (action === "vapid") {
    return json({ publicKey: VAPID_PUBLIC_KEY });
  }

  if (action === "subscribe") {
    const endpoint = String(body.endpoint ?? "");
    const p256dh = String(body.p256dh ?? "");
    const auth = String(body.auth ?? "");
    const userAgent = body.userAgent ? String(body.userAgent).slice(0, 500) : null;
    if (!endpoint || !p256dh || !auth) return json({ error: "Missing fields" }, 400);
    const { error } = await admin
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint, p256dh, auth, user_agent: userAgent },
        { onConflict: "endpoint" },
      );
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "unsubscribe") {
    const endpoint = String(body.endpoint ?? "");
    await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    return json({ ok: true });
  }

  if (action === "send") {
    const title = String(body.title ?? "").slice(0, 120);
    const text = String(body.body ?? "").slice(0, 500);
    const tag = body.tag ? String(body.tag).slice(0, 120) : undefined;
    const url = body.url ? String(body.url).slice(0, 500) : "/";
    const requireInteraction = !!body.requireInteraction;
    const vibrate = Array.isArray(body.vibrate)
      ? (body.vibrate as unknown[]).slice(0, 10).map((n) => Number(n) || 0)
      : undefined;
    if (!title || !text) return json({ error: "Missing title/body" }, 400);

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error) return json({ error: error.message }, 500);

    const payload = JSON.stringify({ title, body: text, tag, url, requireInteraction, vibrate });
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 },
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode ?? 0;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("web-push error", status, err);
        }
      }),
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    return json({ sent });
  }

  return json({ error: "Unknown action" }, 400);
});
