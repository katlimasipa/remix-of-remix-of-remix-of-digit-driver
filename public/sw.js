// Basic offline-capable service worker + Web Push support.
const CACHE = "smrttrdr-v2";
const CORE = ["/", "/app-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok && (res.type === "basic" || res.type === "default")) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});

// ---------- Web Push ----------
self.addEventListener("push", (event) => {
  let payload = { title: "SmrtTrdr", body: "Update from your bot" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  const { title, body, tag, url, requireInteraction, vibrate } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || "smrttrdr",
      icon: "/app-icon.png",
      badge: "/app-icon.png",
      requireInteraction: !!requireInteraction,
      vibrate: vibrate || [80, 40, 80],
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try {
            await c.focus();
            if ("navigate" in c) await c.navigate(target);
            return;
          } catch {}
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
