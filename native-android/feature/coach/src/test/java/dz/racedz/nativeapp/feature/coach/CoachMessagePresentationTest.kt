package dz.racedz.nativeapp.feature.coach

import dz.racedz.nativeapp.core.network.CoachMessageDto
import dz.racedz.nativeapp.core.network.CoachReplyDto
import dz.racedz.nativeapp.core.network.CoachSafetyDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The safety-state matrix for one conversation message.
 *
 * This logic decides whether a runner who reported chest pain sees the urgent treatment or the same
 * chip as someone who asked for a couscous recipe. It lived inside a Composable `when` block, where
 * the only way to check it was to photograph a phone — and two regressions in exactly this logic
 * (COACH-F2, COACH-F3) reached a physical device before anyone noticed.
 */
class CoachMessagePresentationTest {

    private fun message(
        status: String,
        safetyLevel: String? = null,
        summary: String? = null,
    ) = CoachMessageDto(
        id = "m1",
        type = "CHAT",
        status = status,
        userMessage = "q",
        response = summary?.let { CoachReplyDto(summary = it) },
        safety = safetyLevel?.let { CoachSafetyDto(level = it) },
    )

    private fun notice(message: CoachMessageDto) =
        presentCoachMessage(message) as CoachMessagePresentation.Notice

    // ---- BLOCKED by the topicality filter: safety is CLEAR, nothing to do with health ------------
    @Test
    fun `off-topic block is informational and uses the server text`() {
        val result = notice(message("BLOCKED", safetyLevel = "CLEAR", summary = "I only cover running."))
        assertEquals(NoticeLevel.INFO, result.level)
        assertEquals("I only cover running.", result.serverText)
        assertEquals(NoticeFallback.OFF_TOPIC, result.fallback)
        assertEquals(true, result.repairAvailable)
    }

    @Test
    fun `off-topic block with no server text falls back to off-topic copy, never to see-a-doctor`() {
        val result = notice(message("BLOCKED", safetyLevel = "CLEAR"))
        assertEquals(NoticeLevel.INFO, result.level)
        assertNull(result.serverText)
        assertEquals(NoticeFallback.OFF_TOPIC, result.fallback)
    }

    // ---- BLOCKED by the safety layer: a reported symptom ------------------------------------------
    @Test
    fun `symptom block is urgent and keeps the server's specific wording`() {
        val result = notice(
            message("BLOCKED", safetyLevel = "BLOCKED", summary = "Training advice is paused pending assessment.")
        )
        assertEquals(NoticeLevel.URGENT, result.level)
        assertEquals("Training advice is paused pending assessment.", result.serverText)
        assertEquals(NoticeFallback.URGENT_SAFETY, result.fallback)
        assertEquals(false, result.repairAvailable)
    }

    @Test
    fun `symptom block with no server text falls back to the urgent copy`() {
        val result = notice(message("BLOCKED", safetyLevel = "BLOCKED"))
        assertEquals(NoticeLevel.URGENT, result.level)
        assertEquals(NoticeFallback.URGENT_SAFETY, result.fallback)
    }

    @Test
    fun `a blank server summary is treated as absent, not rendered as an empty notice`() {
        assertNull(notice(message("BLOCKED", safetyLevel = "BLOCKED", summary = "   ")).serverText)
    }

    // ---- Legacy and unclassified rows --------------------------------------------------------------
    @Test
    fun `a block with no safety field is not promoted to urgent`() {
        // Rows written before the field existed, and anything the server could not classify. Making
        // these urgent would put the loudest state on ordinary messages until it stopped meaning
        // anything.
        val result = notice(message("BLOCKED", safetyLevel = null, summary = "…"))
        assertEquals(NoticeLevel.INFO, result.level)
        assertEquals(NoticeFallback.OFF_TOPIC, result.fallback)
    }

    @Test
    fun `an unrecognised safety level is not urgent`() {
        assertEquals(NoticeLevel.INFO, notice(message("BLOCKED", safetyLevel = "SOMETHING_NEW")).level)
    }

    // ---- Everything else is a reply ----------------------------------------------------------------
    @Test
    fun `a completed reply renders the card even when safety is CAUTION`() {
        // CAUTION is a note attached to an answer the runner still gets — it must not swallow the
        // reply the way a block does.
        val result = presentCoachMessage(message("COMPLETED", safetyLevel = "CAUTION", summary = "Keep it easy."))
            as CoachMessagePresentation.Reply
        assertEquals("Keep it easy.", result.summary)
        assertEquals(true, result.repairAvailable)
    }

    @Test
    fun `a completed reply with clear safety renders the card`() {
        val result = presentCoachMessage(message("COMPLETED", safetyLevel = "CLEAR", summary = "Nice work."))
            as CoachMessagePresentation.Reply
        assertEquals("Nice work.", result.summary)
    }

    @Test
    fun `a failure is informational and never shows the server body`() {
        // The body of a failed interaction is an error, not coaching.
        val result = notice(message("FAILED", summary = "upstream timeout"))
        assertEquals(NoticeLevel.INFO, result.level)
        assertNull(result.serverText)
        assertEquals(NoticeFallback.FAILED, result.fallback)
    }

    @Test
    fun `an unknown status is treated as a reply rather than swallowed`() {
        val result = presentCoachMessage(message("SOMETHING_NEW", summary = "…"))
            as CoachMessagePresentation.Reply
        assertEquals("…", result.summary)
    }

    @Test
    fun `reply presentation keeps answer-first fields and caps quick replies`() {
        val result = presentCoachMessage(
            CoachMessageDto(
                id = "m2",
                response = CoachReplyDto(
                    summary = "Answer first.",
                    nextAction = "Keep tomorrow easy.",
                    followUpQuestion = "When does fatigue appear?",
                    quickReplies = listOf("After running", "All day", "After poor sleep", "With pain", "extra"),
                    usedSignalKeys = listOf("GOAL", "RECENT_RUNS"),
                    missingSignalKeys = listOf("NO_SLEEP_LOGGED"),
                ),
            )
        ) as CoachMessagePresentation.Reply
        assertEquals("Keep tomorrow easy.", result.nextAction)
        assertEquals(4, result.quickReplies.size)
        assertEquals(listOf("GOAL", "RECENT_RUNS"), result.usedSignalKeys)
        assertEquals(listOf("NO_SLEEP_LOGGED"), result.missingSignalKeys)
    }
}
