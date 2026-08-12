package dz.racedz.nativeapp.feature.coach

import dz.racedz.nativeapp.core.network.CoachMessageDto

/**
 * How loudly a notice speaks.
 *
 * Three levels rather than a boolean because two were not enough to order the states correctly.
 * Field test 20260812-01 found the prominence inverted: CAUTION ("read this alongside the advice")
 * rendered as a full-width orange banner, while a reply blocked because the runner reported chest
 * pain and near-fainting rendered as a muted informational chip. The more serious state was the
 * quieter one.
 */
enum class NoticeLevel { INFO, WARNING, URGENT }

/** Which canned string to use when the server sent no body of its own. */
enum class NoticeFallback { URGENT_SAFETY, OFF_TOPIC, FAILED }

/**
 * What the conversation screen should draw for one message.
 *
 * Extracted from the `when` block inside `ConversationScreen` on purpose (implementation brief §12).
 * The decision it encodes is a safety decision — whether a runner who reported chest pain sees the
 * urgent treatment or the same chip as someone who asked about couscous — and while it lived inside
 * a Composable the only way to check it was to photograph a phone. Two regressions in this exact
 * logic reached a physical device before anyone noticed.
 *
 * Pure and Compose-free so it can be unit-tested: see `CoachMessagePresentationTest`.
 */
sealed interface CoachMessagePresentation {

    /** Render the full structured reply card. */
    data class Reply(
        val summary: String,
        val nextAction: String?,
        val followUpQuestion: String?,
        val quickReplies: List<String>,
        val usedSignalKeys: List<String>,
        val missingSignalKeys: List<String>,
        val hasDetails: Boolean,
        val repairAvailable: Boolean,
    ) : CoachMessagePresentation

    /**
     * Render a single notice instead of a reply.
     *
     * [serverText] wins when present: it is written in the runner's coach language and is more
     * specific than anything canned in the app — for a symptom block it names what needs
     * professional assessment, where the fallback can only say something generic.
     */
    data class Notice(
        val level: NoticeLevel,
        val serverText: String?,
        val fallback: NoticeFallback,
        val repairAvailable: Boolean,
    ) : CoachMessagePresentation
}

/**
 * Maps one settled message to what the screen draws.
 *
 * BLOCKED is a deliberate refusal, not a fault, and it has TWO causes that must not read the same.
 * The safety layer sets `safety.level = BLOCKED` for a reported symptom; the topicality pre-filter
 * blocks an off-topic question with `safety.level` still CLEAR. Keying off `status` alone collapsed
 * both into one string, which meant a question that merely missed the topic filter told the runner
 * to see a doctor, and "I felt chest pain and almost fainted" lost the server's specific wording to
 * that same generic line.
 *
 * A null `safety` is treated as NOT urgent. That is the conservative reading for the field it
 * actually is: `safety` is absent on rows written before the field existed and on any response the
 * server could not classify, and promoting those to the urgent treatment would put the loudest
 * state on the app's most ordinary messages until it meant nothing.
 */
fun presentCoachMessage(message: CoachMessageDto): CoachMessagePresentation = when (message.status) {
    "BLOCKED" -> {
        val urgent = message.safety?.level == "BLOCKED"
        CoachMessagePresentation.Notice(
            level = if (urgent) NoticeLevel.URGENT else NoticeLevel.INFO,
            serverText = message.response?.summary?.takeIf { it.isNotBlank() },
            fallback = if (urgent) NoticeFallback.URGENT_SAFETY else NoticeFallback.OFF_TOPIC,
            repairAvailable = !urgent,
        )
    }

    // A failure is not a refusal: the runner may retry, and the server body — when there is one —
    // is an error, not coaching, so it is never shown.
    "FAILED" -> CoachMessagePresentation.Notice(
        level = NoticeLevel.INFO,
        serverText = null,
        fallback = NoticeFallback.FAILED,
        repairAvailable = false,
    )

    else -> {
        val reply = message.response
        CoachMessagePresentation.Reply(
            summary = reply?.summary.orEmpty(),
            nextAction = reply?.nextAction?.takeIf { it.isNotBlank() },
            followUpQuestion = reply?.followUpQuestion?.takeIf { it.isNotBlank() },
            quickReplies = reply?.quickReplies.orEmpty().filter { it.isNotBlank() }.take(4),
            usedSignalKeys = reply?.usedSignalKeys.orEmpty(),
            missingSignalKeys = reply?.missingSignalKeys.orEmpty(),
            hasDetails = reply != null && (
                !reply.progressAssessment.isNullOrBlank() || reply.positiveSignals.isNotEmpty() ||
                    reply.warningSignals.isNotEmpty() || reply.recoveryAdvice.isNotEmpty()
                ),
            repairAvailable = reply != null,
        )
    }
}
