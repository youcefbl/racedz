import "server-only";

import { createSign } from "crypto";

type SendFirebasePushInput = {
  token: string;
  title: string;
  body: string;
  href?: string;
};

type SendFirebasePushResult =
  | {
      ok: true;
      providerMessageId: string | null;
    }
  | {
      ok: false;
      error: string;
      shouldRevokeToken?: boolean;
    };

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function sendFirebasePush(input: SendFirebasePushInput): Promise<SendFirebasePushResult> {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    return { ok: false, error: "FIREBASE_PROJECT_ID is not configured." };
  }

  const tokenResult = await getAccessToken();

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: input.token,
        notification: {
          title: input.title,
          body: input.body
        },
        webpush: {
          fcm_options: {
            link: input.href ? new URL(input.href, getAppUrl()).toString() : getAppUrl()
          }
        },
        // Native Android delivery. High priority so reminders arrive promptly; the app reads
        // data.href on tap to route (Capacitor pushNotificationActionPerformed). Harmless for
        // web tokens, which ignore the android block.
        android: {
          priority: "high",
          notification: {
            default_sound: true
          }
        },
        data: {
          href: input.href ?? ""
        }
      }
    })
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Firebase network error.";

    return { ok: false as const, message };
  });

  if (!("json" in response)) {
    return { ok: false, error: response.message };
  }

  const payload = (await response.json().catch(() => null)) as { name?: string; error?: { status?: string; message?: string } } | null;

  if (!response.ok) {
    const status = payload?.error?.status;

    return {
      ok: false,
      error: payload?.error?.message ?? `Firebase returned ${response.status}.`,
      shouldRevokeToken: status === "NOT_FOUND" || status === "INVALID_ARGUMENT"
    };
  }

  return {
    ok: true,
    providerMessageId: payload?.name ?? null
  };
}

async function getAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return { ok: true, token: cachedAccessToken.token };
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    return { ok: false, error: "Firebase service account env vars are not configured." };
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT"
    },
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    },
    privateKey
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Google OAuth network error.";

    return { ok: false as const, message };
  });

  if (!("json" in response)) {
    return { ok: false, error: response.message };
  }

  const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;

  if (!response.ok || !payload?.access_token) {
    return { ok: false, error: payload?.error_description ?? `Google OAuth returned ${response.status}.` };
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000
  };

  return { ok: true, token: payload.access_token };
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256").update(data).sign(privateKey);

  return `${data}.${base64Url(signature)}`;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function getAppUrl() {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://127.0.0.1:3003";
}
