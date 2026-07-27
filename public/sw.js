// Zivotix scanner service worker.
//
// Scope is deliberately narrow. This caches the app shell so the scanner
// opens instantly — and still opens at all on a venue's terrible wifi — but
// it never caches an API response.
//
// That restraint is the important part. A cached /api/scan response would
// mean a door showing "Valid, checked in" for a ticket the server never
// actually marked used, and two people walking in on one ticket. Check-ins
// must reach the server or fail visibly.

const CACHE = "zivotix-shell-v1";

// Only the things needed to render the shell before any network call.
const SHELL = ["/scan", "/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll rejects the whole batch if any single request 404s, which would
      // leave the worker permanently failing to install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch other origins, and never touch the API — see the note above.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for pages: door staff should always get the current build
  // when there's a connection, and the cache is a fallback rather than the
  // source of truth. A stale scanner is a support call waiting to happen.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match("/offline") ?? Response.error();
        })
    );
    return;
  }

  // Cache-first for static assets, which are content-hashed by Next and so
  // can't go stale under us.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
