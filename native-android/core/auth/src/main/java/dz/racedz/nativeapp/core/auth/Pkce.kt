package dz.racedz.nativeapp.core.auth

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * PKCE (RFC 7636) parameters for the system-browser sign-in.
 *
 * The verifier is a high-entropy secret that never leaves the app process: it is generated here,
 * only its SHA-256 challenge travels to the server in the browser URL, and it is sent directly to
 * /api/v1/auth/token over TLS when redeeming the code. That is what makes the authorization code
 * useless to another app that registers the same zidrun:// scheme and intercepts the redirect.
 */
data class PkceChallenge(
    val verifier: String,
    val challenge: String,
    /** CSRF guard: echoed back on the redirect and compared before the code is redeemed. */
    val state: String,
) {
    companion object {
        private val random = SecureRandom()

        fun generate(): PkceChallenge {
            // 64 bytes -> 86 base64url chars, comfortably inside RFC 7636's 43..128 range.
            val verifier = randomUrlSafe(64)
            val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII))
            return PkceChallenge(
                verifier = verifier,
                challenge = encoder.encodeToString(digest),
                state = randomUrlSafe(16),
            )
        }

        private fun randomUrlSafe(bytes: Int): String {
            val buffer = ByteArray(bytes)
            random.nextBytes(buffer)
            return encoder.encodeToString(buffer)
        }

        /** java.util.Base64 rather than android.util.Base64: it exists from API 26 (this app's
         *  minSdk), produces the same unpadded base64url, and keeps this class unit-testable on the
         *  JVM without Robolectric. Padding is omitted because '=' is outside RFC 7636's
         *  unreserved character set. */
        private val encoder: Base64.Encoder = Base64.getUrlEncoder().withoutPadding()
    }
}
