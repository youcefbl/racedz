"use client";

// Shared browser-push (Firebase Cloud Messaging) client helpers. Used by the account settings
// control and by lightweight in-context prompts (e.g. the coach dashboard) so the permission
// request, token registration, and foreground handler live in exactly one place.

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

export type FirebaseBrowserConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
};

type FirebaseMessagePayload = {
  notification?: { title?: string; body?: string };
  data?: { title?: string; body?: string; href?: string };
};

export type FirebaseMessagingClient = {
  getToken: (options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }) => Promise<string | null>;
  deleteToken: (token: string) => Promise<boolean>;
  onMessage: (callback: (payload: FirebaseMessagePayload) => void) => () => void;
};

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
export const PUSH_TOKEN_KEY = "racedz:fcm-token";

export type EnablePushResult =
  | { ok: true; token: string }
  | { ok: false; reason: "config" | "browser" | "permission" | "token" | "save" | "error"; message?: string };

export function isPushConfigured() {
  return Object.values(firebaseConfig).every(Boolean) && Boolean(vapidKey);
}

export function isPushBrowserReady() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function getStoredPushToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(PUSH_TOKEN_KEY);
}

/** Request permission, obtain an FCM token, register it server-side, and wire foreground messages. */
export async function enableBrowserPush(): Promise<EnablePushResult> {
  if (!isPushConfigured()) return { ok: false, reason: "config" };
  if (!isPushBrowserReady()) return { ok: false, reason: "browser" };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "permission" };

    const firebase = await getFirebaseMessagingClient();
    const registration = await registerFirebaseServiceWorker();
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: vapidKey as string, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, reason: "token" };

    const response = await fetch("/api/notifications/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, deviceLabel: navigator.userAgent.slice(0, 120) })
    });
    if (!response.ok) return { ok: false, reason: "save" };

    window.localStorage.setItem(PUSH_TOKEN_KEY, token);
    registerForegroundMessageHandler(messaging);
    return { ok: true, token };
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : undefined };
  }
}

export async function disableBrowserPush() {
  const token = getStoredPushToken();
  if (!token) return;

  if (window.firebase) {
    await window.firebase.messaging().deleteToken(token).catch(() => false);
  }

  await fetch("/api/notifications/push-subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  window.localStorage.removeItem(PUSH_TOKEN_KEY);
}

export async function getFirebaseMessagingClient() {
  await loadFirebaseCompatScripts();
  const firebase = window.firebase;
  if (!firebase) throw new Error("Firebase failed to load.");
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig as FirebaseBrowserConfig);
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

export function registerForegroundMessageHandler(messaging: FirebaseMessagingClient) {
  if (window.racedzFirebaseForegroundReady) return;

  messaging.onMessage((payload) => {
    if (Notification.permission !== "granted") return;
    const title = payload.notification?.title || payload.data?.title || "ZidRun";
    const body = payload.notification?.body || payload.data?.body || "You have a new ZidRun notification.";
    new Notification(title, { body, icon: "/icon-192.png", data: { href: payload.data?.href || "/" } });
  });

  window.racedzFirebaseForegroundReady = true;
}
