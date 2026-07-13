import assert from "node:assert";
import {
  consumeBackupCode,
  generateBackupCodes,
  generateMfaSecret,
  hashBackupCode,
  hashBackupCodes,
  totpCodeForCounter,
  verifyTotp
} from "../src/lib/mfa";

// RFC 6238 reference secret: ASCII "12345678901234567890" → base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// RFC 6238 Appendix B (SHA1) test vectors, truncated to the low 6 digits.
// T=59 → counter 1 → 94287082; T=1111111109 → counter 37037036 → 07081804.
assert.strictEqual(totpCodeForCounter(RFC_SECRET, 1), "287082", "RFC vector T=59");
assert.strictEqual(totpCodeForCounter(RFC_SECRET, 37037036), "081804", "RFC vector T=1111111109");
assert.strictEqual(totpCodeForCounter(RFC_SECRET, 1234567890 / 30), "005924" /* T=1234567890 → 89005924 */, "RFC vector T=1234567890");

// Round-trip: the current code verifies; adjacent-window tolerance works; wrong code fails.
const secret = generateMfaSecret();
assert.match(secret, /^[A-Z2-7]{32}$/, "secret is 160-bit base32");
const now = Math.floor(Date.now() / 1000 / 30);
assert.ok(verifyTotp(secret, totpCodeForCounter(secret, now)), "current code verifies");
assert.ok(verifyTotp(secret, totpCodeForCounter(secret, now - 1)), "previous window tolerated");
assert.ok(verifyTotp(secret, totpCodeForCounter(secret, now + 1)), "next window tolerated");
assert.ok(!verifyTotp(secret, totpCodeForCounter(secret, now + 5)), "far-future code rejected");
assert.ok(!verifyTotp(secret, "abc"), "non-numeric rejected");
assert.ok(!verifyTotp(secret, "12345"), "wrong-length rejected");
assert.ok(!verifyTotp("", "123456"), "empty secret rejected");

// Backup codes: format, single-use consumption, and no double-spend.
const codes = generateBackupCodes();
assert.strictEqual(codes.length, 10, "10 backup codes");
codes.forEach((code) => assert.match(code, /^[0-9a-f]{5}-[0-9a-f]{5}$/, "backup code format"));
const hashes = hashBackupCodes(codes);
assert.strictEqual(new Set(hashes).size, 10, "distinct hashes");
// Case/format-insensitive match, and the used code is removed from the remaining set.
const remaining = consumeBackupCode(codes[3].toUpperCase().replace("-", ""), hashes);
assert.ok(remaining, "valid backup code consumes");
assert.strictEqual(remaining!.length, 9, "one code removed");
assert.ok(!remaining!.includes(hashBackupCode(codes[3])), "used code no longer present");
assert.strictEqual(consumeBackupCode(codes[3], remaining!), null, "consumed code cannot be reused");
assert.strictEqual(consumeBackupCode("00000-00000", hashes), null, "unknown code rejected");

console.log("MFA TOTP + backup-code checks passed.");
