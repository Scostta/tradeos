// TradeOS service worker.
// Conservative strategy so live data is never stale:
//   - navigations     → network-first, fall back to an offline page when offline
//   - static assets    → stale-while-revalidate (build files, generated icons)
//   - everything else  → default network (Supabase / API pass straight through)

const VERSION = "v1";
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
