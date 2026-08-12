package dz.racedz.nativeapp.core.network

import org.junit.Assert.assertEquals
import org.junit.Test

class CoachReplyDtoTest {

    @Test
    fun `spoken reply puts localized safety warning before answer and action`() {
        val reply = CoachReplyDto(
            summary = "Keep today's run easy.",
            nextAction = "Stop if the discomfort returns.",
            progressAssessment = "Your consistency is improving.",
            warningSignals = listOf("You reported discomfort."),
            usedSignalKeys = listOf("GOAL"),
        )

        assertEquals(
            "Professional assessment is recommended. Keep today's run easy. " +
                "Stop if the discomfort returns. Your consistency is improving. You reported discomfort.",
            reply.spokenText("Professional assessment is recommended."),
        )
    }

    @Test
    fun `spoken reply omits provenance labels and control text`() {
        val reply = CoachReplyDto(
            summary = "Take a rest day.",
            usedSignals = listOf("goal"),
            usedSignalKeys = listOf("GOAL"),
            missingSignalKeys = listOf("NO_SLEEP_LOGGED"),
        )

        assertEquals("Take a rest day.", reply.spokenText())
    }
}
