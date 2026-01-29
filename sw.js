/* sw.js - ZeroLog Service Worker */
const VERSION = "zerolog-v1.0.0";
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;

// Keep this list small and stable.
// Add/remove items here when you change your root files.
const PRECACHE_URLS = [
  "/",               // helpful for servers that map / -> index.html
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![PRECACHE, RUNTIME].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();

      // Notify pages that a new SW is active
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({ type: "SW_ACTIVATED", version: VERSION });
      });
    })()
  );
});

// Helper: Stale-While-Revalidate for same-origin GET requests
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      // Only cache successful basic (same-origin) responses
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached immediately if exists, else network (or null)
  return cached || (await fetchPromise);
}

// Fetch: serve from cache where possible
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only cache same-origin (avoid caching ad scripts, analytics, CDNs etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation requests: prefer cached shell, fall back to network.
  // This makes refresh work offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PRECACHE);
        const cached = await cache.match("/index.html");
        try {
          const network = await fetch(req);
          // Optional: refresh cached index in runtime
          const runtime = await caches.open(RUNTIME);
          runtime.put("/index.html", network.clone());
          return network;
        } catch {
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // App shell assets: cache-first
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PRECACHE);
        const cached = await cache.match(req);
        return cached || fetch(req);
      })()
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

// Optional: allow pages to tell SW to skip waiting (for instant updates)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
