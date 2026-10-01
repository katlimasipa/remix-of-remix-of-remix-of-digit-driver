import { VAPID_PUBLIC_KEY, registerServiceWorker, subscribePush, unsubscribePush } from "@/lib/pwa";
import { supabase } from "@/integrations/supabase/client";

/** Returns stable notification context keys; delivery itself is app-user scoped. */
export function getNotificationOwnerKeys(accountIds: string[]): string[] {
  return Array.from(new Set(accountIds.filter(Boolean))).sort();
}

async function pushApi(action: string, body?: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to sync notifications across devices");
  // Runs on the app backend, so it works on any domain the site is hosted on.
  const { data, error } = await supabase.functions.invoke("push", {
    body: { action, ...body },
  });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const j = ctx ? await ctx.json() : null;
      if (j?.error) message = j.error;
    } catch {
      /* keep original message */
    }
    throw new Error(message || "Push request failed");
  }
  return data ?? {};
}

export async function ensurePushSubscription(ownerKeys: string[]): Promise<boolean> {
  if (!ownerKeys.length) return false;
  const reg = await registerServiceWorker();
  if (!reg) return false;
  await navigator.serviceWorker.ready;
  const sub = await subscribePush(reg);
  if (!sub) return false;
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  await pushApi("subscribe", {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: navigator.userAgent.slice(0, 500),
  });
  return true;
}

export async function disablePushSubscription(): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const json = sub.toJSON();
    await unsubscribePush(reg);
    if (json.endpoint) {
      await pushApi("unsubscribe", { endpoint: json.endpoint }).catch(() => {});
    }
  }
  return true;
}

export async function sendPushToDevices(
  ownerKeys: string[],
  payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    requireInteraction?: boolean;
    vibrate?: number[];
  },
): Promise<number> {
  if (!ownerKeys.length) return 0;
  const res = await pushApi("send", payload);
  return typeof res.sent === "number" ? res.sent : 0;
}

export async function showLocalNotification(payload: {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  vibrate?: number[];
}): Promise<void> {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag ?? "smrttrdr",
        icon: "/app-icon-192.png",
        badge: "/app-icon-192.png",
        requireInteraction: !!payload.requireInteraction,
        data: { url: "/" },
        ...({ vibrate: payload.vibrate ?? [80, 40, 80] } as Record<string, unknown>),
      } as NotificationOptions);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/app-icon-192.png",
    });
  } catch {
    /* ignore */
  }
}

export { VAPID_PUBLIC_KEY };
