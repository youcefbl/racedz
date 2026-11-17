package dz.racedz.nativeapp.feature.coach

import dz.racedz.nativeapp.core.network.CoachConversationDto
import dz.racedz.nativeapp.core.network.CoachEntitlementDto
import dz.racedz.nativeapp.core.network.CoachMessageDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AnalyseAndVoiceTest {

    private fun state(vararg messages: CoachMessageDto) = ConversationUiState(
        conversation = CoachConversationDto(entitlement = CoachEntitlementDto(tier = "SUBSCRIBED"), messages = messages.toList()),
    )

    @Test
    fun `a question asked mid-run does not hide the analysis offer`() {
        assertTrue(state(CoachMessageDto(id = "q", type = "CHAT", runId = "run-1")).canAnalyseRun("run-1"))
    }

    @Test
    fun `an existing post-run review does`() {
        assertFalse(state(CoachMessageDto(id = "r", type = "POST_RUN", runId = "run-1")).canAnalyseRun("run-1"))
    }

    @Test
    fun `the voice follows the reply, not the goal`() {
        assertEquals("ar", ReplySpeaker.languageOf("إيه، الريتم مليح", goalLanguage = "en", appLanguage = "en"))
        assertEquals("en", ReplySpeaker.languageOf("Your pace is fine.", goalLanguage = "ar", appLanguage = "en"))
        assertEquals("fr", ReplySpeaker.languageOf("Ton allure est bonne.", goalLanguage = "ar", appLanguage = "fr"))
    }
}
