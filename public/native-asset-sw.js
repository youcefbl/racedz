/* ZidRun native asset cache — registered ONLY inside the Capacitor app (see
   service-worker-register.tsx). It caches exactly one thing: hashed Next.js build assets under
   /_next/static/<hash>. Those are content-addressed and immutable — a new deploy references new
   hashes — so caching them can NEVER pin a stale/broken shell (the failure mode that got the old
   caching SW disabled). Everything else — HTML, navigation, API, uploads — is not intercepted and
   always hits the network.

   There is intentionally NO client-side `controllerchange → reload` (that reloaded the WebView at
   bad moments and looped). skipWaiting()/clients.claim() only let this worker start serving assets
   sooner; they do not reload the page. */

const CACHE = "zidrun-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Drop every other cache — our current one, plus any legacy caches a previous (bad) SW left.
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .catch(() => undefined)
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Same-origin immutable build assets only. Everything else falls through to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only store complete, successful responses (skip opaque/partial/errors).
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
