/* global firebase */

// ---------------------------------------------------------------------------
// Offline caching (PWA) lives in the SAME worker as Firebase messaging so the
// two never fight over the service-worker scope. FCM push handling is below.
// Strategy: navigations are network-first with an offline fallback (never cache
// authenticated HTML); hashed static assets are cache-first; /api is never cached.
// ---------------------------------------------------------------------------
const RACEDZ_CACHE = "racedz-cache-v1";
const RACEDZ_OFFLINE_URL = "/offline.html";
const RACEDZ_PRECACHE = [RACEDZ_OFFLINE_URL, "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(RACEDZ_CACHE)
      .then((cache) => cache.addAll(RACEDZ_PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== RACEDZ_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.startsWith("/api/")) return; // never cache API / auth responses

  // Page navigations: network-first, fall back to the offline page when offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(RACEDZ_OFFLINE_URL)));
    return;
  }

  // Immutable / static assets: serve from cache, refresh in the background.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RACEDZ_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId")
};

if (Object.values(firebaseConfig).every(Boolean)) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "RaceDZ";
    const options = {
      body: payload.notification?.body || payload.data?.body || "You have a new RaceDZ notification.",
      icon: "/racedz-logo.png",
      badge: "/favicon.ico",
      data: {
        href: payload.data?.href || "/"
      }
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => "focus" in client && new URL(client.url).pathname === new URL(href, self.location.origin).pathname);

      if (existingClient) {
        return existingClient.focus();
      }

      return self.clients.openWindow(href);
    })
  );
});
