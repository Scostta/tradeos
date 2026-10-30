// TradeOS service worker.
// Conservative strategy so live data is never stale:
//   - navigations     → network-first, fall back to an offline page when offline
//   - static assets    → stale-while-revalidate (build files, generated icons)
//   - everything else  → default network (Supabase / API pass straight through)

const VERSION = "v4";
const STATIC_CACHE = `tradeos-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin; let Supabase and other third parties pass through.
  if (url.origin !== self.location.origin) return;

  // Page navigations: always try the network first, fall back to offline page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static build assets + generated icons: serve cache, refresh in background.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    ["style", "script", "font", "image"].includes(request.destination);

  if (isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// ── Web Push ──────────────────────────────────────────────────────────────────
// Payload: { title, body, url, tag } (src/types/push.ts). Al tocar la
// notificación se enfoca una ventana abierta de la app o se abre una nueva.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "TradeOS", {
      body: data.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const sameOrigin = target.startsWith(self.location.origin);
      const win = sameOrigin ? wins.find((w) => w.url.startsWith(self.location.origin)) : null;
      if (win) return win.navigate(target).then((w) => (w || win).focus());
      return self.clients.openWindow(target);
    })
  );
});
