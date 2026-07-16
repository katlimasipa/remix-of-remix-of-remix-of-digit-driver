import { VAPID_PUBLIC_KEY, registerServiceWorker, subscribePush, unsubscribePush } from "@/lib/pwa";

/**
 * Returns one owner key per Deriv account. Push rows are keyed per-account so
 * that any device signed in to at least one of these accounts still receives
 * the push — even if the two devices have different subsets of accounts logged
 * in (e.g. laptop has [demo, real], phone has [real] only).
 */
export function getNotificationOwnerKeys(accountIds: string[]): string[] {
  return Array.from(new Set(accountIds.filter(Boolean))).sort();
}

async function pushApi(action: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/push?action=${encodeURIComponent(action)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Push API failed (${res.status})`);
  }
  return data;
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
    ownerKeys,
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
  ownerKey: string,
  payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    requireInteraction?: boolean;
    vibrate?: number[];
  },
): Promise<void> {
  await pushApi("send", { ownerKey, ...payload });
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
        icon: "/app-icon.png",
        badge: "/app-icon.png",
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
      icon: "/app-icon.png",
    });
  } catch {
    /* ignore */
  }
}

export { VAPID_PUBLIC_KEY };
