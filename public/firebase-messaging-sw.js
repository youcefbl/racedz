/* global firebase */

// ---------------------------------------------------------------------------
// This worker exists ONLY for Firebase push messaging. It deliberately does NOT
// cache pages or assets: a caching SW could pin a stale/broken app shell in a
// single browser (loads fine elsewhere) until a manual hard-refresh. Cloudflare
// already edge-caches static assets, so we let every request hit the network.
//
// It is also self-healing: on activate it deletes ALL caches and takes control
// immediately, so any browser still carrying the old caching SW recovers on its
// next visit without the user doing anything.
// ---------------------------------------------------------------------------
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

// No fetch handler on purpose — nothing is served from cache.

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
    const title = payload.notification?.title || payload.data?.title || "ZidRun";
    const options = {
      body: payload.notification?.body || payload.data?.body || "You have a new ZidRun notification.",
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
