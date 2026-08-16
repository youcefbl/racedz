package dz.racedz.nativeapp.feature.coach

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The rules that decide whether a composer edit retires the pending turn.
 *
 * This is the logic behind Retry. A pending turn that disappears too early takes the runner's Retry
 * with it, and Retry is what replays a reply the server already generated instead of buying it a
 * second time — so the boundary between "acknowledged" and "still in flight" is worth pinning.
 */
class PendingTurnDismissalTest {

    private fun state(
        generating: Boolean = false,
        sendError: String? = null,
        pendingQuestion: String? = null,
        pendingRunAnalysis: Boolean = false,
    ) = ConversationUiState(
        generating = generating,
        sendError = sendError,
        pendingQuestion = pendingQuestion,
        pendingRunAnalysis = pendingRunAnalysis,
    )

    @Test
    fun `a failed question is retired once the runner types again`() {
        assertTrue(shouldRetirePendingTurn(state(sendError = "Timed out", pendingQuestion = "How do I taper?")))
    }

    @Test
    fun `a failed run analysis is retired too`() {
        assertTrue(shouldRetirePendingTurn(state(sendError = "Timed out", pendingRunAnalysis = true)))
    }

    @Test
    fun `an in-flight run analysis survives a quick-reply tap`() {
        // The regression: quick replies are not disabled while generating, and they route through
        // the same draft update as typing. Retiring here dropped the marker Retry depends on, so a
        // timeout straight afterwards left the runner with no Retry at all.
        assertFalse(shouldRetirePendingTurn(state(generating = true, pendingRunAnalysis = true)))
    }

    @Test
    fun `an in-flight question survives a quick-reply tap`() {
        assertFalse(shouldRetirePendingTurn(state(generating = true, pendingQuestion = "How do I taper?")))
    }

    @Test
    fun `an idle composer has nothing to retire`() {
        assertFalse(shouldRetirePendingTurn(state()))
    }

    @Test
    fun `a reply awaiting refetch is retired, since the runner moved on`() {
        // Generation succeeded but the transcript refetch did not: no sendError, yet the question is
        // still pending. Typing is a real acknowledgement here, so the turn goes.
        assertTrue(shouldRetirePendingTurn(state(pendingQuestion = "How do I taper?")))
    }

    @Test
    fun `retry is offered for both kinds of pending turn and withheld behind a consent gate`() {
        assertTrue(state(pendingQuestion = "How do I taper?").canRetry)
        assertTrue(state(pendingRunAnalysis = true).canRetry)
        assertFalse(state().canRetry)
        assertEquals(
            false,
            ConversationUiState(pendingQuestion = "How do I taper?", consentRequired = true).canRetry,
        )
    }
}
