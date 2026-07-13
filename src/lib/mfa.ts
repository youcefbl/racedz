import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Self-contained TOTP (RFC 6238) + recovery codes for opt-in two-factor auth. Implemented with the
// Node crypto stdlib so we don't add an auth-critical third-party dependency. Compatible with Google
// Authenticator, Authy, 1Password, etc. (SHA1, 6 digits, 30s step — the authenticator-app default).

const DIGITS = 6;
const STEP_SECONDS = 30;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648, no padding

/** Generate a new base32 TOTP secret (160 bits, the RFC-recommended length). */
export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Build the otpauth:// URI an authenticator app scans / imports. */
export function buildOtpAuthUrl(secret: string, accountEmail: string, issuer = "ZidRun"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Verify a user-entered TOTP code against the secret. Accepts the current 30s window plus the
 * adjacent past/future windows (±`window` steps) to tolerate clock skew and entry latency.
 */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const normalized = (token ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  const key = base32Decode(secret);
  if (key.length === 0) return false;

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let offset = -window; offset <= window; offset += 1) {
    if (constantTimeEqualStrings(generateTotp(key, counter + offset), normalized)) {
      return true;
    }
  }
  return false;
}

/** The TOTP code for a specific 30s counter. Exposed for deterministic tests (RFC 6238 vectors). */
export function totpCodeForCounter(secret: string, counter: number): string {
  return generateTotp(base32Decode(secret), counter);
}

/** Generate `count` single-use recovery codes (plaintext, shown to the user once). */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    // 10 hex chars, grouped as XXXXX-XXXXX for readability.
    const raw = randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

/** Hash a recovery code for storage (codes are high-entropy, so a fast SHA-256 is sufficient). */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

/**
 * If `code` matches one of the stored hashes, return the remaining hashes (the used one removed) so
 * the caller can persist the consumption. Returns null when the code doesn't match any.
 */
export function consumeBackupCode(code: string, storedHashes: string[]): string[] | null {
  const candidate = hashBackupCode(code);
  const index = storedHashes.findIndex((stored) => constantTimeEqualStrings(stored, candidate));
  if (index === -1) return null;
  return storedHashes.filter((_, i) => i !== index);
}

export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(hashBackupCode);
}

function normalizeBackupCode(code: string): string {
  return (code ?? "").replace(/[\s-]/g, "").toLowerCase();
}

function generateTotp(key: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  // 64-bit big-endian counter.
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

function constantTimeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = (input ?? "").replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return Buffer.alloc(0); // reject invalid secrets rather than decode garbage
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
