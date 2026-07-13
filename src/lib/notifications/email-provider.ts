import "server-only";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendEmailResult =
  | {
      ok: true;
      providerMessageId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export async function sendNotificationEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }

  if (!from) {
    return { ok: false, error: "EMAIL_FROM is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Resend network error.";

    return { ok: false as const, message };
  });

  if (!("json" in response)) {
    return {
      ok: false,
      error: response.message
    };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string; error?: string } | null;

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.message ?? payload?.error ?? `Resend returned ${response.status}.`
    };
  }

  return {
    ok: true,
    providerMessageId: payload?.id ?? null
  };
}
