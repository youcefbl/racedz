import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// A short-lived, HMAC-signed handoff between the first factor (password or Google) and the dedicated
// second-factor page (/login/mfa). It carries the user id, whether the first factor actually passed
// (`ff` — signed so the client can't flip it), and an optional post-login destination. No session is
// granted until the code entered on the MFA page verifies, so this ticket is NOT a credential: even if
// it leaks, an attacker still needs the live authenticator/recovery code. Stateless (no DB/migration);
// the TTL is short enough that replay is not a practical concern.

const TICKET_TTL_MS = 3 * 60_000; // 3 minutes to enter the second factor.

export type MfaTicketPayload = {
  /** User id the second factor is being checked for. */
  uid: string;
  /** First factor (password / Google) verified. False when the password was wrong — the MFA page is
   *  still shown so the login page never reveals whether the password was correct. */
  ff: boolean;
  /** Safe same-origin callback path to return to after a full login. */
  cb?: string;
};

type SignedTicket = MfaTicketPayload & { exp: number };

function ticketSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set; cannot sign MFA tickets.");
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", ticketSecret()).update(body).digest("base64url");
}

export function createMfaTicket(payload: MfaTicketPayload): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TICKET_TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify signature + expiry and return the payload, or null if the ticket is missing/tampered/expired. */
export function readMfaTicket(ticket: string | null | undefined): SignedTicket | null {
  if (!ticket || typeof ticket !== "string") return null;
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedTicket;
    if (typeof parsed?.uid !== "string" || typeof parsed?.exp !== "number") return null;
    if (typeof parsed.ff !== "boolean") return null;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
