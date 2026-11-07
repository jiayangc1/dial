// Dial service worker: makes the installed app open offline.
// - App shell (/app) is network-first, falling back to the cached copy.
// - Hashed build assets (/_next/static) and icons are cache-first (immutable).
// - API calls and auth are never cached: the app keeps its own snapshot in
//   localStorage and queues writes while offline.
const VERSION = "dial-v1";
const SHELL = ["/app", "/icon.svg", "/apple-touch-icon.png", "/pwa-icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname.startsWith("/app")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(VERSION).then((c) => c.put("/app", res.clone()));
          return res;
        })
        .catch(() => caches.match("/app").then((hit) => hit || Response.error())),
    );
  }
});
