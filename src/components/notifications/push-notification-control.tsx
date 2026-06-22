"use client";

import { Bell, BellOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      initializeApp: (config: FirebaseBrowserConfig) => unknown;
      app: () => unknown;
      messaging: () => FirebaseMessagingClient;
    };
    racedzFirebaseForegroundReady?: boolean;
  }
}

type FirebaseBrowserConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
};

type FirebaseMessagePayload = {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: {
    title?: string;
    body?: string;
    href?: string;
  };
};

type FirebaseMessagingClient = {
  getToken: (options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }) => Promise<string | null>;
  deleteToken: (token: string) => Promise<boolean>;
  onMessage: (callback: (payload: FirebaseMessagePayload) => void) => () => void;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const localStorageKey = "racedz:fcm-token";

export function PushNotificationControl() {
  const [status, setStatus] = useState<string>("");
  const [working, setWorking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(() => (typeof window === "undefined" ? false : Boolean(window.localStorage.getItem(localStorageKey))));
  const configReady = useMemo(() => Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey), []);
  const browserReady = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

  async function enablePush() {
    setWorking(true);
    setStatus("");

    try {
      if (!configReady) {
        setStatus("Firebase web config is missing.");
        return;
      }

      if (!browserReady) {
        setStatus("This browser does not support web push notifications.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("Notification permission was not granted.");
        return;
      }

      const firebase = await getFirebaseMessagingClient();
      const registration = await registerFirebaseServiceWorker();

      const messaging = firebase.messaging();
      const token = await messaging.getToken({
        vapidKey: vapidKey as string,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        setStatus("Firebase did not return a push token.");
        return;
      }

      const response = await fetch("/api/notifications/push-subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          deviceLabel: navigator.userAgent.slice(0, 120)
        })
      });

      if (!response.ok) {
        setStatus("RaceDZ could not save this push token.");
        return;
      }

      window.localStorage.setItem(localStorageKey, token);
      registerForegroundMessageHandler(messaging);
      setEnabled(true);
      setStatus("Push notifications are enabled on this browser.");
    } catch (error) {
      setStatus(getErrorMessage(error, "RaceDZ could not enable push notifications."));
    } finally {
      setWorking(false);
    }
  }

  async function disablePush() {
    setWorking(true);
    setStatus("");

    try {
      const token = window.localStorage.getItem(localStorageKey);

      if (!token) {
        setEnabled(false);
        return;
      }

      if (window.firebase) {
        await window.firebase.messaging().deleteToken(token).catch(() => false);
      }

      await fetch("/api/notifications/push-subscriptions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token })
      });

      window.localStorage.removeItem(localStorageKey);
      setEnabled(false);
      setStatus("Push notifications are disabled on this browser.");
    } finally {
      setWorking(false);
    }
  }

  async function sendTestPush() {
    setTesting(true);
    setStatus("");

    try {
      if (browserReady && Notification.permission === "granted") {
        const firebase = await getFirebaseMessagingClient();
        registerForegroundMessageHandler(firebase.messaging());
      }

      const response = await fetch("/api/notifications/test-push", {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        pushDelivery?: {
          status: string;
          error: string | null;
        } | null;
      } | null;

      if (!response.ok) {
        setStatus(payload?.error ?? "RaceDZ could not send the test push.");
        return;
      }

      if (payload?.pushDelivery?.status === "SENT") {
        setStatus("Test push sent. If this tab is focused, the browser may show it as a foreground notification.");
        return;
      }

      if (payload?.pushDelivery?.status === "FAILED") {
        setStatus(payload.pushDelivery.error ?? "Firebase rejected the test push.");
        return;
      }

      if (payload?.pushDelivery?.status === "SKIPPED") {
        setStatus(payload.pushDelivery.error ?? "RaceDZ skipped push delivery.");
        return;
      }

      setStatus("Test notification created, but no push delivery record was returned.");
    } catch (error) {
      setStatus(getErrorMessage(error, "RaceDZ could not send the test push."));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-950">Browser push notifications</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Enable this browser to receive Firebase push notifications for important RaceDZ updates.
          </p>
          {status ? <p className="mt-2 text-sm font-semibold text-brand-teal">{status}</p> : null}
          {!configReady ? <p className="mt-2 text-xs font-semibold text-orange-700">Firebase public web config is not configured yet.</p> : null}
        </div>
        {enabled ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="secondary" size="sm" disabled={working || testing || !configReady || !browserReady} onClick={sendTestPush}>
              <Bell className="size-4" aria-hidden="true" />
              Send test
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={working || testing || !configReady || !browserReady} onClick={enablePush}>
              Reconnect
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={working || testing} onClick={disablePush}>
              <BellOff className="size-4" aria-hidden="true" />
              Disable
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled={working || !configReady || !browserReady} onClick={enablePush}>
            <Bell className="size-4" aria-hidden="true" />
            Enable
          </Button>
        )}
      </div>
    </div>
  );
}

async function getFirebaseMessagingClient() {
  await loadFirebaseCompatScripts();
  const firebase = window.firebase;

  if (!firebase) {
    throw new Error("Firebase failed to load.");
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig as FirebaseBrowserConfig);
  }

  return firebase;
}

async function registerFirebaseServiceWorker() {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? "",
    authDomain: firebaseConfig.authDomain ?? "",
    projectId: firebaseConfig.projectId ?? "",
    messagingSenderId: firebaseConfig.messagingSenderId ?? "",
    appId: firebaseConfig.appId ?? ""
  });

  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

async function loadFirebaseCompatScripts() {
  await loadScript("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

function registerForegroundMessageHandler(messaging: FirebaseMessagingClient) {
  if (window.racedzFirebaseForegroundReady) {
    return;
  }

  messaging.onMessage((payload) => {
    if (Notification.permission !== "granted") {
      return;
    }

    const title = payload.notification?.title || payload.data?.title || "RaceDZ";
    const body = payload.notification?.body || payload.data?.body || "You have a new RaceDZ notification.";

    new Notification(title, {
      body,
      icon: "/icon-192.png",
      data: {
        href: payload.data?.href || "/"
      }
    });
  });

  window.racedzFirebaseForegroundReady = true;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
