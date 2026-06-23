// PWA registration with Lovable preview guard.
// VAPID public key (safe to expose to the browser).
export const VAPID_PUBLIC_KEY =
  "BCHwuEFHo7loPQdF5Ec0EXzqqb9TvG2gWEjliPmjlvutxdusFd0AokdtX6B6ixpC0Hcn4tbC9haqk7trObpj2KA";

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (window.location.search.includes("sw=off")) return true;
  return false;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (isPreviewHost()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => (r.active?.scriptURL || "").endsWith("/sw.js"))
          .map((r) => r.unregister()),
      );
    } catch {}
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("SW register failed", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribePush(
  reg: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  if (!("PushManager" in window)) return null;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength,
      ) as ArrayBuffer,
    });
  }
  return sub;
}

export async function unsubscribePush(reg: ServiceWorkerRegistration): Promise<void> {
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

export function pushRequiresInstall(): boolean {
  return isIos() && !isStandalone();
}

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** Chrome / Edge install prompt (not available on all browsers). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function pwaSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isPreviewHost()) return false;
  return "serviceWorker" in navigator;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export type InstallBrowserHint =
  | "chrome-android"
  | "samsung"
  | "firefox-android"
  | "ios-safari"
  | "desktop-chrome"
  | "generic";

export function getInstallBrowserHint(): InstallBrowserHint {
  if (typeof navigator === "undefined") return "generic";
  const ua = navigator.userAgent;
  if (isIos()) return "ios-safari";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Firefox/i.test(ua) && isAndroid()) return "firefox-android";
  if (/Chrome|Edg/i.test(ua) && isAndroid()) return "chrome-android";
  if (/Chrome|Edg/i.test(ua)) return "desktop-chrome";
  return "generic";
}
