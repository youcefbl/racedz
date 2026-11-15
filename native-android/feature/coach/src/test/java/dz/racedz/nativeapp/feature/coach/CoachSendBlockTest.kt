package dz.racedz.nativeapp.feature.coach

import dz.racedz.nativeapp.core.network.ApiErrorCode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A question refused by the Coach's allowance or entitlement gate is not a failure Retry can fix.
 *
 * M21 production smoke (2026-11-15): after the trial's third answer of the day the app showed
 * "That answer did not come through" with a Retry that failed identically every time.
 */
class CoachSendBlockTest {

    @Test
    fun `allowance and entitlement refusals map to a block`() {
        assertEquals(CoachSendBlock.LimitReached, CoachSendBlock.from(ApiErrorCode.RateLimited))
        assertEquals(CoachSendBlock.SubscriptionRequired, CoachSendBlock.from(ApiErrorCode.SubscriptionRequired))
    }

    @Test
    fun `transient failures stay retryable`() {
        assertNull(CoachSendBlock.from(ApiErrorCode.Unavailable))
        assertNull(CoachSendBlock.from(ApiErrorCode.Offline))
        assertNull(CoachSendBlock.from(ApiErrorCode.Internal))
    }

    @Test
    fun `a blocked send offers no retry`() {
        val failed = ConversationUiState(sendError = "Daily AI coach limit reached.", pendingQuestion = "How do I taper?")
        assertTrue(failed.canRetry)
        assertFalse(failed.copy(sendBlock = CoachSendBlock.LimitReached).canRetry)
        assertFalse(failed.copy(sendBlock = CoachSendBlock.SubscriptionRequired).canRetry)
    }
}
