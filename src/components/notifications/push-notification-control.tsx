"use client";

import { Bell, BellOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  disableBrowserPush,
  enableBrowserPush,
  getFirebaseMessagingClient,
  getStoredPushToken,
  isPushBrowserReady,
  isPushConfigured,
  registerForegroundMessageHandler
} from "@/lib/notifications/push-client";

export function PushNotificationControl() {
  const [status, setStatus] = useState<string>("");
  const [working, setWorking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(() => Boolean(getStoredPushToken()));
  const configReady = useMemo(() => isPushConfigured(), []);
  const browserReady = isPushBrowserReady();

  async function enablePush() {
    setWorking(true);
    setStatus("");

    try {
      const result = await enableBrowserPush();
      if (result.ok) {
        setEnabled(true);
        setStatus("Push notifications are enabled on this browser.");
        return;
      }

      const message = {
        config: "Firebase web config is missing.",
        browser: "This browser does not support web push notifications.",
        permission: "Notification permission was not granted.",
        token: "Firebase did not return a push token.",
        save: "ZidRun could not save this push token.",
        error: result.message || "ZidRun could not enable push notifications."
      }[result.reason];
      setStatus(message);
    } finally {
      setWorking(false);
    }
  }

  async function disablePush() {
    setWorking(true);
    setStatus("");

    try {
      await disableBrowserPush();
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
        setStatus(payload?.error ?? "ZidRun could not send the test push.");
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
        setStatus(payload.pushDelivery.error ?? "ZidRun skipped push delivery.");
        return;
      }

      setStatus("Test notification created, but no push delivery record was returned.");
    } catch (error) {
      setStatus(getErrorMessage(error, "ZidRun could not send the test push."));
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
            Enable this browser to receive Firebase push notifications for important ZidRun updates.
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
