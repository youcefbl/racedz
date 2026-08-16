package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunExerciseHoldNotice
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import dz.racedz.nativeapp.core.network.CoachMessageDto
import dz.racedz.nativeapp.core.network.CoachReplyDto

/**
 * The coach conversation (04-coach-conversation-v2.png).
 *
 * Newest at the bottom, composer pinned above the keyboard. Every reply is the server's; this screen
 * generates no text of its own and never fabricates an answer while one is pending.
 */
@Composable
fun ConversationScreen(
    viewModel: ConversationViewModel,
    onBack: () -> Unit,
    /**
     * Opens goal setup in edit mode. A consent refusal is a hard gate the runner CAN clear — but
     * only there — so the failure state has to offer the way out rather than just naming it
     * (review F234-R04).
     */
    onReviewConsent: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    // Focus target for the follow-up "Answer" affordance (B83-R09): answering the coach's
    // question means typing, so the action lands the runner in the composer.
    val composerFocus = remember { FocusRequester() }

    // Voice note + reply playback (COACHPAR-001). Both are held by the screen rather than the view
    // model because both own Android resources — a microphone and a bound TTS service — that must
    // be released when this screen leaves composition, not when the view model is cleared.
    val context = LocalContext.current
    val speaker = remember { ReplySpeaker(context) }
    var speakingId by remember { mutableStateOf<String?>(null) }
    var speechNotice by remember { mutableStateOf<Int?>(null) }
    DisposableEffect(speaker) {
        speaker.observeState { newState ->
            when (newState) {
                is ReplySpeaker.State.Speaking -> { speakingId = newState.messageId; speechNotice = null }
                ReplySpeaker.State.Idle -> speakingId = null
                ReplySpeaker.State.Unsupported -> { speakingId = null; speechNotice = R.string.coach_reply_speech_unsupported }
                ReplySpeaker.State.Unavailable -> { speakingId = null; speechNotice = R.string.coach_reply_speech_unavailable }
            }
        }
        onDispose { speaker.release() }
    }

    var micDenied by remember { mutableStateOf(false) }
    val startRecording = {
        micDenied = false
        viewModel.startRecording(VoiceNoteRecorder(context))
    }
    // Permission is asked for at the moment the runner taps the mic — never at launch, and never
    // for anything but this one action.
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startRecording() else micDenied = true
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.coach_chat_title), onBack = onBack)

        state.safetyAlert?.let {
            ZidRunExerciseHoldNotice(
                clearing = state.safetyClearing,
                onConfirmMedicalClearance = viewModel::confirmMedicalClearance,
                modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceSm),
            )
        }

        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.error != null && state.conversation.messages.isEmpty() -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
            )

            !state.hasCoaching -> ZidRunStatusView(
                icon = Icons.Filled.Chat,
                title = stringResource(R.string.coach_locked_title),
                body = stringResource(R.string.coach_locked_body),
            )

            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(ZidRunDimens.spaceLg),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                    // Newest at the bottom, as a conversation reads.
                    reverseLayout = true,
                ) {
                    // The run this screen was opened for, offered rather than auto-sent.
                    //
                    // FIRST in the list, which under reverseLayout means LAST on screen — directly
                    // above the composer, where the list opens. It used to be declared after the
                    // messages, which put it above the entire transcript: a runner who tapped
                    // "Analyze run" landed on their existing chat with the offer parked off-screen,
                    // and the run was never analysed because the button was never seen.
                    if (state.canAnalyseRun(viewModel.runId)) {
                        item(key = "analyse") {
                            ZidRunCard {
                                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                                    Text(
                                        stringResource(R.string.coach_analyse_run_title),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.primary,
                                    )
                                    Text(
                                        stringResource(R.string.coach_analyse_run_body),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                    )
                                    ZidRunButton(
                                        text = stringResource(R.string.coach_analyse_run_action),
                                        onClick = viewModel::analyseRun,
                                        enabled = !state.generating,
                                    )
                                }
                            }
                        }
                    }

                    // reverseLayout puts the first item at the bottom, so the question being
                    // answered belongs at the head of the list. Keyed on pendingQuestion too:
                    // a question whose reply was generated but not yet refetched (reload failed)
                    // must stay visible with its Retry, not vanish into limbo (19A-R06).
                    if (state.generating || state.pendingQuestion != null || state.sendError != null || state.canRetry) {
                        item(key = "pending") {
                            PendingTurn(
                                question = state.pendingQuestion,
                                generating = state.generating,
                                // Retry is offered only when it can actually change the outcome:
                                // a consent gate is cleared in goal setup, not by asking again
                                // (F234-R04), and the action beneath the error says so.
                                failed = !state.generating && state.canRetry,
                                onRetry = viewModel::retry,
                            )
                        }
                    }

                    items(state.conversation.messages, key = { it.id }) { message ->
                        MessageTurn(
                            message,
                            onAnswerFollowUp = { composerFocus.requestFocus() },
                            onSelectQuickReply = { reply ->
                                viewModel.selectQuickReply(reply)
                                composerFocus.requestFocus()
                            },
                            onRepair = {
                                viewModel.startRepair(context.getString(R.string.coach_chat_repair_lead))
                                composerFocus.requestFocus()
                            },
                            detailsExpanded = message.id in state.expandedReplyIds,
                            onToggleDetails = { viewModel.toggleDetails(message.id) },
                            speaking = speakingId == message.id,
                            onToggleSpeech = {
                                if (speakingId == message.id) {
                                    speaker.stop()
                                } else {
                                    val response = message.response
                                    val safetyAnnouncement = if (response?.requiresProfessionalAdvice == true) {
                                        context.getString(R.string.coach_chat_professional)
                                    } else {
                                        null
                                    }
                                    val text = response?.spokenText(safetyAnnouncement)
                                    if (text.isNullOrBlank()) {
                                        speechNotice = R.string.coach_reply_speech_unavailable
                                    } else {
                                        speaker.speak(
                                            message.id,
                                            text,
                                            ReplySpeaker.localeFor(state.conversation.replyLanguage),
                                        )
                                    }
                                }
                            },
                        )
                    }

                    if (state.conversation.messages.isEmpty() && !state.generating) {
                        item(key = "empty") {
                            ZidRunStatusView(
                                icon = Icons.Filled.Chat,
                                title = stringResource(R.string.coach_chat_empty_title),
                                body = stringResource(R.string.coach_chat_empty_body),
                            )
                        }
                    }
                }

                // Speech/voice feedback sits directly above the composer, where the action was.
                speechNotice?.let { ZidRunInlineError(stringResource(it), modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg)) }
                if (micDenied) {
                    ZidRunInlineError(
                        stringResource(R.string.coach_voice_permission_denied),
                        modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                    )
                }
                state.voiceError?.let { voiceError ->
                    ZidRunInlineError(
                        stringResource(
                            when (voiceError) {
                                VoiceError.MicUnavailable -> R.string.coach_voice_error_mic
                                VoiceError.TooShort -> R.string.coach_voice_error_short
                                VoiceError.Empty -> R.string.coach_voice_error_empty
                                VoiceError.ConsentRequired -> R.string.coach_consent_required
                                VoiceError.SubscriptionRequired -> R.string.coach_voice_error_subscription
                                VoiceError.Failed -> R.string.coach_voice_error_failed
                            }
                        ),
                        modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                    )
                }
                if (state.recording || state.transcribing) {
                    Text(
                        stringResource(
                            if (state.recording) R.string.coach_voice_recording else R.string.coach_voice_transcribing
                        ),
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.primary,
                        modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                    )
                }
                state.sendError?.let {
                    // A consent refusal is actionable, not a fault: show the localized instruction
                    // rather than the server's English sentence, and offer the one action that
                    // resolves it. Retrying the message cannot.
                    val message = if (state.consentRequired) stringResource(R.string.coach_consent_required) else it
                    ZidRunInlineError(message, modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg))
                    if (state.consentRequired) {
                        ZidRunTextButton(
                            text = stringResource(R.string.coach_consent_review_goal),
                            onClick = onReviewConsent,
                            fillWidth = false,
                            modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                        )
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(ZidRunDimens.spaceLg),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Voice note: subscribers only, and never while a reply is generating — the
                    // composer is disabled then, so offering the mic would promise something the
                    // send button would refuse.
                    if (state.canUseVoice && !state.generating) {
                        val micLabel = stringResource(
                            if (state.recording) R.string.coach_voice_stop else R.string.coach_voice_record
                        )
                        IconButton(
                            onClick = {
                                viewModel.dismissVoiceError()
                                speechNotice = null
                                when {
                                    state.recording -> viewModel.stopRecordingAndTranscribe { transcript ->
                                        // The text lands in the composer for the runner to READ and
                                        // edit. It is never sent for them: recognition mishears, and
                                        // an unapproved question still spends a daily message.
                                        val draft = state.draft
                                        viewModel.updateDraft(if (draft.isBlank()) transcript else "${draft.trim()} $transcript")
                                        composerFocus.requestFocus()
                                    }
                                    ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                                        PackageManager.PERMISSION_GRANTED -> startRecording()
                                    else -> micPermission.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            },
                            modifier = Modifier
                                .size(ZidRunDimens.minTouchTarget)
                                .semantics { contentDescription = micLabel },
                        ) {
                            if (state.transcribing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = colors.primary)
                            } else {
                                Icon(
                                    if (state.recording) Icons.Filled.Stop else Icons.Filled.Mic,
                                    contentDescription = null,
                                    tint = if (state.recording) colors.primary else colors.textMuted,
                                )
                            }
                        }
                        Spacer(Modifier.width(ZidRunDimens.spaceXs))
                    }
                    ZidRunTextField(
                        value = state.draft,
                        onValueChange = viewModel::updateDraft,
                        label = stringResource(R.string.coach_chat_hint),
                        // Disabled while a reply is generating: a second question would spend
                        // another credit before the first is answered.
                        enabled = !state.generating,
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(composerFocus),
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    if (state.generating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(28.dp),
                            strokeWidth = 2.dp,
                            color = colors.primary,
                        )
                    } else {
                        val sendLabel = stringResource(R.string.coach_chat_send)
                        IconButton(
                            onClick = {
                                viewModel.send(state.draft)
                            },
                            enabled = state.draft.isNotBlank(),
                            modifier = Modifier
                                .size(ZidRunDimens.minTouchTarget)
                                .semantics { contentDescription = sendLabel },
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = null,
                                tint = if (state.draft.isNotBlank()) colors.primary else colors.textMuted,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** The question the runner just asked, while the coach is still answering it. */
@Composable
private fun PendingTurn(question: String?, generating: Boolean, failed: Boolean, onRetry: () -> Unit) {
    val colors = ZidRunTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        question?.takeIf { it.isNotBlank() }?.let { RunnerBubble(it) }
        if (generating) {
            Row(
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            ) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = colors.primary)
                Text(
                    stringResource(R.string.coach_chat_thinking),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        } else if (failed) {
            Text(
                stringResource(R.string.coach_chat_failed),
                style = MaterialTheme.typography.bodySmall,
                color = colors.danger,
            )
            // Retry re-sends the SAME question with its retained request key (19A-R06): if the
            // server already generated the reply, the retry replays it without a second charge.
            // Without this, retrying after a timeout meant retyping the question by hand.
            ZidRunTextButton(
                text = stringResource(R.string.common_retry),
                onClick = onRetry,
                fillWidth = false,
            )
        }
    }
}

@Composable
private fun RunnerBubble(text: String) {
    val colors = ZidRunTheme.colors
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                .background(colors.primary)
                .padding(ZidRunDimens.spaceMd),
        ) {
            // The runner writes in whatever language they like — darija, arabizi, French — which
            // need not match the app's layout direction.
            Text(ZidRunFormat.isolate(text), style = MaterialTheme.typography.bodyMedium, color = colors.onPrimary)
        }
    }
}

@Composable
private fun MessageTurn(
    message: CoachMessageDto,
    onAnswerFollowUp: () -> Unit,
    onSelectQuickReply: (String) -> Unit,
    onRepair: () -> Unit,
    detailsExpanded: Boolean,
    onToggleDetails: () -> Unit,
    speaking: Boolean = false,
    onToggleSpeech: () -> Unit = {},
) {
    val colors = ZidRunTheme.colors

    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        // The context chip the design flow puts first on a post-run response, so the reply is
        // visibly about one run rather than about training in the abstract.
        if (message.type == "POST_RUN" && message.runId != null) {
            Text(
                stringResource(R.string.coach_analyse_run_chip),
                style = MaterialTheme.typography.labelMedium,
                color = ZidRunTheme.colors.primary,
            )
        }
        message.userMessage?.takeIf { it.isNotBlank() }?.let { RunnerBubble(it) }

        when (val presentation = presentCoachMessage(message)) {
            // The decision itself lives in presentCoachMessage() so it can be unit-tested; this
            // branch only turns it into pixels.
            is CoachMessagePresentation.Notice -> {
                Notice(
                    presentation.serverText ?: stringResource(
                        when (presentation.fallback) {
                            NoticeFallback.URGENT_SAFETY -> R.string.coach_chat_blocked
                            NoticeFallback.OFF_TOPIC -> R.string.coach_chat_off_topic
                            NoticeFallback.FAILED -> R.string.coach_chat_failed
                        }
                    ),
                    level = presentation.level,
                )
                if (presentation.repairAvailable) {
                    ZidRunTextButton(
                        text = stringResource(R.string.coach_chat_not_meant),
                        onClick = onRepair,
                        fillWidth = false,
                    )
                }
            }

            is CoachMessagePresentation.Reply -> message.response?.let { reply ->
                CoachReplyCard(
                    reply = reply,
                    presentation = presentation,
                    detailsExpanded = detailsExpanded,
                    onToggleDetails = onToggleDetails,
                    onAnswerFollowUp = onAnswerFollowUp,
                    onSelectQuickReply = onSelectQuickReply,
                    onRepair = onRepair,
                )
                // Read aloud by the DEVICE's own voice, not the server's cue endpoint — that one is
                // allow-listed to guided-run phrases on purpose, and a reply is arbitrary text.
                val speakLabel = stringResource(
                    if (speaking) R.string.coach_reply_stop_speaking else R.string.coach_reply_speak
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(
                        onClick = onToggleSpeech,
                        modifier = Modifier
                            .size(ZidRunDimens.minTouchTarget)
                            .semantics { contentDescription = speakLabel },
                    ) {
                        Icon(
                            if (speaking) Icons.Filled.Stop else Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = null,
                            tint = ZidRunTheme.colors.primary,
                        )
                    }
                    Text(speakLabel, style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
                }
            }
        }

        // The deterministic safety verdict, rendered as its own notice rather than folded into the
        // reply. Only when it says something: every reply carries a verdict, and the vast majority
        // are CLEAR, so announcing those would train the runner to ignore the one that isn't.
        if (message.status == "COMPLETED" && message.safety?.isNotable == true) {
            Notice(stringResource(R.string.coach_chat_safety), level = NoticeLevel.WARNING)
        }
    }
}

/**
 * One coach reply.
 *
 * The order mirrors the website's: the professional-assessment banner first when the reply raises
 * it, then the summary, the read on progress, what went well, and finally what to be careful about.
 * Warnings and the banner are the reason this is a structured card rather than a paragraph — they
 * used to be dropped entirely on the way to the phone.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CoachReplyCard(
    reply: CoachReplyDto,
    presentation: CoachMessagePresentation.Reply,
    detailsExpanded: Boolean,
    onToggleDetails: () -> Unit,
    onAnswerFollowUp: () -> Unit,
    onSelectQuickReply: (String) -> Unit,
    onRepair: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surface)
            .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerLg))
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        if (reply.requiresProfessionalAdvice) {
            Notice(stringResource(R.string.coach_chat_professional), level = NoticeLevel.WARNING)
        }

        if (presentation.summary.isNotBlank()) {
            Text(ZidRunFormat.isolate(presentation.summary), style = MaterialTheme.typography.bodyMedium, color = colors.textStrong)
        }

        presentation.nextAction?.let {
            ZidRunDivider()
            Text(stringResource(R.string.coach_chat_what_now), style = MaterialTheme.typography.titleSmall, color = colors.primary)
            Text(ZidRunFormat.isolate(it), style = MaterialTheme.typography.bodyMedium, color = colors.text)
        }

        // Safety guidance is never collapsed behind details.
        reply.warningSignals.forEach { SignalRow(it, Icons.Filled.Warning, colors.accent) }

        presentation.followUpQuestion?.let {
            ZidRunDivider()
            Text(ZidRunFormat.isolate(it), style = MaterialTheme.typography.bodyMedium, color = colors.primary)
            if (presentation.quickReplies.isNotEmpty()) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                ) {
                    presentation.quickReplies.forEach { option ->
                        ZidRunTextButton(
                            text = ZidRunFormat.isolate(option),
                            onClick = { onSelectQuickReply(option) },
                            fillWidth = false,
                        )
                    }
                }
            }
            ZidRunTextButton(text = stringResource(R.string.coach_chat_answer), onClick = onAnswerFollowUp, fillWidth = false)
        }

        if (presentation.hasDetails) {
            ZidRunDivider()
            ZidRunTextButton(
                text = stringResource(
                    if (detailsExpanded) R.string.coach_chat_hide_details else R.string.coach_chat_show_details
                ),
                onClick = onToggleDetails,
                fillWidth = false,
            )
        }

        if (detailsExpanded) {
            reply.progressAssessment?.takeIf { it.isNotBlank() }?.let {
                Text(ZidRunFormat.isolate(it), style = MaterialTheme.typography.bodyMedium, color = colors.textMuted)
            }
            reply.positiveSignals.forEach { SignalRow(it, Icons.Filled.CheckCircle, colors.success) }
            if (reply.recoveryAdvice.isNotEmpty()) {
                Text(stringResource(R.string.coach_chat_recovery), style = MaterialTheme.typography.titleSmall, color = colors.primary)
                reply.recoveryAdvice.forEach {
                    Text("• " + ZidRunFormat.isolate(it), style = MaterialTheme.typography.bodySmall, color = colors.text)
                }
            }
        }

        val usedLabels = presentation.usedSignalKeys.mapNotNull { provenanceLabel(it) }
        val missingLabels = presentation.missingSignalKeys.mapNotNull { missingSignalLabel(it) }
        if (usedLabels.isNotEmpty() || missingLabels.isNotEmpty()) {
            ZidRunDivider()
            Text(stringResource(R.string.coach_chat_why_advice), style = MaterialTheme.typography.labelMedium, color = colors.textMuted)
            if (usedLabels.isNotEmpty()) {
                Text(
                    stringResource(R.string.coach_chat_based_sentence, usedLabels.joinToString(", ")),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
            if (missingLabels.isNotEmpty()) {
                Text(
                    stringResource(R.string.coach_chat_missing_sentence, missingLabels.joinToString(", ")),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }

        if (presentation.repairAvailable) {
            ZidRunTextButton(text = stringResource(R.string.coach_chat_not_meant), onClick = onRepair, fillWidth = false)
        }
    }
}

@Composable
private fun provenanceLabel(key: String): String? = when (key) {
    "GOAL" -> stringResource(R.string.coach_signal_goal)
    "ACTIVE_PLAN" -> stringResource(R.string.coach_signal_active_plan)
    "RECENT_RUNS" -> stringResource(R.string.coach_signal_recent_runs)
    "PLAN_ADHERENCE" -> stringResource(R.string.coach_signal_plan_adherence)
    "CONSISTENCY" -> stringResource(R.string.coach_signal_consistency)
    "SLEEP" -> stringResource(R.string.coach_signal_sleep)
    "WEATHER" -> stringResource(R.string.coach_signal_weather)
    "ANALYSED_RUN" -> stringResource(R.string.coach_signal_analysed_run)
    "RUNNER_QUESTION" -> stringResource(R.string.coach_signal_runner_question)
    "HEALTH_CONTEXT" -> stringResource(R.string.coach_signal_health_context)
    "SAFETY_DECISION" -> stringResource(R.string.coach_signal_safety_decision)
    "COACH_MEMORY" -> stringResource(R.string.coach_signal_coach_memory)
    else -> null
}

@Composable
private fun missingSignalLabel(key: String): String? = when (key) {
    "NO_RECENT_RUNS" -> stringResource(R.string.coach_gap_recent_runs)
    "NO_RECENT_PACE" -> stringResource(R.string.coach_gap_recent_pace)
    "NO_SLEEP_LOGGED" -> stringResource(R.string.coach_gap_sleep)
    "NO_TARGET_RACE" -> stringResource(R.string.coach_gap_target_race)
    "NO_WEATHER_DATA" -> stringResource(R.string.coach_gap_weather)
    "NO_HEALTH_DETAILS" -> stringResource(R.string.coach_gap_health)
    "NO_SYMPTOM_DETAILS" -> stringResource(R.string.coach_gap_symptoms)
    "NO_INJURY_DETAILS" -> stringResource(R.string.coach_gap_injury)
    else -> null
}

@Composable
private fun SignalRow(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: androidx.compose.ui.graphics.Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp).padding(top = 2.dp))
        // Isolated: this row carries model-authored text in the runner's coach language, which is
        // not necessarily the app's language.
        Text(ZidRunFormat.isolate(text), style = MaterialTheme.typography.bodySmall, color = ZidRunTheme.colors.text)
    }
}

@Composable
private fun Notice(text: String, level: NoticeLevel = NoticeLevel.INFO) {
    val colors = ZidRunTheme.colors
    // The *Content tokens, not the brand colours: these sit on the soft tint, where the brand
    // colours measured below WCAG AA for this text size in the light and race themes.
    val tint = when (level) {
        NoticeLevel.INFO -> colors.infoContent
        NoticeLevel.WARNING -> colors.accentContent
        NoticeLevel.URGENT -> colors.dangerContent
    }
    val container = when (level) {
        NoticeLevel.INFO -> colors.infoSoft
        NoticeLevel.WARNING -> colors.accentSoft
        NoticeLevel.URGENT -> colors.dangerSoft
    }
    // Never colour alone: the icon changes with the level too, so the ordering survives for a
    // runner who cannot separate orange from red.
    val icon = when (level) {
        NoticeLevel.INFO -> Icons.Filled.Info
        NoticeLevel.WARNING -> Icons.Filled.Warning
        NoticeLevel.URGENT -> Icons.Filled.Error
    }
    // A screen reader otherwise announces only the sentence, with nothing to say that this is the
    // urgent state — the whole point of the visual hierarchy, lost for anyone not looking at it.
    // The label is prepended to the spoken description rather than added as a separate node so it
    // arrives before the text, not after it.
    val announcement = when (level) {
        NoticeLevel.URGENT -> stringResource(R.string.coach_notice_urgent_a11y)
        NoticeLevel.WARNING -> stringResource(R.string.coach_notice_warning_a11y)
        NoticeLevel.INFO -> null
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (announcement != null) {
                    Modifier.semantics(mergeDescendants = true) {
                        contentDescription = "$announcement. $text"
                        // Urgent notices arrive mid-conversation, after the runner has already sent
                        // their message and looked away; assertive so it interrupts rather than
                        // waiting for the queue.
                        liveRegion = if (level == NoticeLevel.URGENT) {
                            LiveRegionMode.Assertive
                        } else {
                            LiveRegionMode.Polite
                        }
                    }
                } else {
                    Modifier
                }
            )
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(container)
            .then(
                // The urgent state gets a border as well, so it still reads as the loudest notice
                // on a screen where several may stack.
                if (level == NoticeLevel.URGENT) {
                    Modifier.border(1.dp, colors.danger, RoundedCornerShape(ZidRunDimens.cornerLg))
                } else {
                    Modifier
                }
            )
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(if (level == NoticeLevel.URGENT) 22.dp else 18.dp),
        )
        Text(
            ZidRunFormat.isolate(text),
            style = if (level == NoticeLevel.URGENT) {
                MaterialTheme.typography.bodyMedium
            } else {
                MaterialTheme.typography.bodySmall
            },
            color = tint,
        )
    }
}
