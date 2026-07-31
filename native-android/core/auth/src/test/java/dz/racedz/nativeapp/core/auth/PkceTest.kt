package dz.racedz.nativeapp.core.auth

import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * PKCE parameters have to satisfy RFC 7636 exactly, because the server validates them with the same
 * rules (see src/app/api/v1/auth/authorize/route.ts). A verifier outside 43..128 characters, or one
 * containing a character outside the unreserved set, is rejected there — so it is worth pinning here
 * rather than discovering it as a sign-in failure on a device.
 */
class PkceTest {

    private val unreserved = Regex("^[A-Za-z0-9._~-]+$")

    @Test
    fun `verifier and state satisfy the RFC 7636 character set and length bounds`() {
        repeat(50) {
            val challenge = PkceChallenge.generate()

            assertTrue("verifier too short: ${challenge.verifier.length}", challenge.verifier.length >= 43)
            assertTrue("verifier too long: ${challenge.verifier.length}", challenge.verifier.length <= 128)
            assertTrue("verifier has illegal characters", unreserved.matches(challenge.verifier))

            assertTrue("challenge has illegal characters", unreserved.matches(challenge.challenge))
            assertTrue("state too short", challenge.state.length >= 8)
            assertTrue("state has illegal characters", unreserved.matches(challenge.state))

            // base64url must never be padded — '=' is outside the unreserved set the server accepts.
            assertFalse(challenge.verifier.contains('='))
            assertFalse(challenge.challenge.contains('='))
        }
    }

    @Test
    fun `challenge is the base64url SHA-256 of the verifier`() {
        val challenge = PkceChallenge.generate()

        val digest = MessageDigest.getInstance("SHA-256")
            .digest(challenge.verifier.toByteArray(Charsets.US_ASCII))
        val expected = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(digest)

        // If this drifts, the server's timing-safe comparison rejects every browser sign-in.
        assertEquals(expected, challenge.challenge)
    }

    @Test
    fun `each generation is unique`() {
        val first = PkceChallenge.generate()
        val second = PkceChallenge.generate()

        assertNotEquals(first.verifier, second.verifier)
        assertNotEquals(first.state, second.state)
    }
}
