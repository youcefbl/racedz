package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
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
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    // Focus target for the follow-up "Answer" affordance (B83-R09): answering the coach's
    // question means typing, so the action lands the runner in the composer.
    val composerFocus = remember { FocusRequester() }
    var draft by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.coach_chat_title), onBack = onBack)

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
                    // reverseLayout puts the first item at the bottom, so the question being
                    // answered belongs at the head of the list. Keyed on pendingQuestion too:
                    // a question whose reply was generated but not yet refetched (reload failed)
                    // must stay visible with its Retry, not vanish into limbo (19A-R06).
                    if (state.generating || state.pendingQuestion != null || state.sendError != null) {
                        item(key = "pending") {
                            PendingTurn(
                                question = state.pendingQuestion,
                                generating = state.generating,
                                failed = !state.generating,
                                onRetry = viewModel::retry,
                            )
                        }
                    }

                    items(state.conversation.messages, key = { it.id }) { message ->
                        MessageTurn(message, onAnswerFollowUp = { composerFocus.requestFocus() })
                    }

                    // The run this screen was opened for, offered rather than auto-sent.
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

                state.sendError?.let {
                    ZidRunInlineError(it, modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg))
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(ZidRunDimens.spaceLg),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ZidRunTextField(
                        value = draft,
                        onValueChange = {
                            draft = it.take(1200)
                            viewModel.dismissSendError()
                        },
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
                                viewModel.send(draft)
                                draft = ""
                            },
                            enabled = draft.isNotBlank(),
                            modifier = Modifier
                                .size(ZidRunDimens.minTouchTarget)
                                .semantics { contentDescription = sendLabel },
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = null,
                                tint = if (draft.isNotBlank()) colors.primary else colors.textMuted,
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
            Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.onPrimary)
        }
    }
}

@Composable
private fun MessageTurn(message: CoachMessageDto, onAnswerFollowUp: () -> Unit) {
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

        when (message.status) {
            // BLOCKED is a deliberate refusal by the safety layer, not a fault. Saying "something
            // went wrong" would invite the runner to rephrase and try again, which is the opposite
            // of what a block is for.
            "BLOCKED" -> Notice(stringResource(R.string.coach_chat_blocked))

            "FAILED" -> Notice(stringResource(R.string.coach_chat_failed))

            else -> message.response?.let { reply -> CoachReplyCard(reply, onAnswerFollowUp) }
        }

        // The deterministic safety verdict, rendered as its own notice rather than folded into the
        // reply. Only when it says something: every reply carries a verdict, and the vast majority
        // are CLEAR, so announcing those would train the runner to ignore the one that isn't.
        if (message.status == "COMPLETED" && message.safety?.isNotable == true) {
            Notice(stringResource(R.string.coach_chat_safety), warning = true)
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
@Composable
private fun CoachReplyCard(reply: CoachReplyDto, onAnswerFollowUp: () -> Unit) {
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
            Notice(stringResource(R.string.coach_chat_professional), warning = true)
        }

        if (reply.summary.isNotBlank()) {
            Text(reply.summary, style = MaterialTheme.typography.bodyMedium, color = colors.text)
        }
        reply.progressAssessment?.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.textMuted)
        }

        reply.positiveSignals.forEach { SignalRow(it, Icons.Filled.CheckCircle, colors.success) }
        // Never colour alone: the icon and the position after the positives both carry the meaning,
        // so the distinction survives for a runner who cannot separate green from orange.
        reply.warningSignals.forEach { SignalRow(it, Icons.Filled.Warning, colors.accent) }

        if (reply.recoveryAdvice.isNotEmpty()) {
            ZidRunDivider()
            Text(
                stringResource(R.string.coach_chat_recovery),
                style = MaterialTheme.typography.titleSmall,
                color = colors.primary,
            )
            reply.recoveryAdvice.forEach {
                Text("• $it", style = MaterialTheme.typography.bodySmall, color = colors.text)
            }
        }

        // What the coach did NOT have. Shown so a hedged answer reads as missing data rather than
        // as the coach being vague — this is the visible half of the anti-hallucination contract.
        if (reply.dataGaps.isNotEmpty()) {
            ZidRunDivider()
            Text(
                stringResource(R.string.coach_chat_data_gaps),
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
            reply.dataGaps.forEach {
                Text("• $it", style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
            }
        }

        // The signals the advice actually rests on — the "Based on" transparency chips the web
        // shows for the same reply (B83-R09). Never render more or less than the website here.
        if (reply.usedSignals.isNotEmpty()) {
            ZidRunDivider()
            Text(
                stringResource(R.string.coach_chat_based_on),
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
            Text(
                reply.usedSignals.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }

        reply.followUpQuestion?.takeIf { it.isNotBlank() }?.let {
            ZidRunDivider()
            Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.primary)
            // Answering means typing: the affordance focuses the composer, never pre-fills or
            // auto-sends anything on the runner's behalf.
            ZidRunTextButton(
                text = stringResource(R.string.coach_chat_answer),
                onClick = onAnswerFollowUp,
                fillWidth = false,
            )
        }
    }
}

@Composable
private fun SignalRow(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, tint: androidx.compose.ui.graphics.Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp).padding(top = 2.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = ZidRunTheme.colors.text)
    }
}

@Composable
private fun Notice(text: String, warning: Boolean = false) {
    val colors = ZidRunTheme.colors
    val tint = if (warning) colors.accent else colors.info
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(if (warning) colors.accentSoft else colors.infoSoft)
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(
            if (warning) Icons.Filled.Warning else Icons.Filled.Info,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(18.dp),
        )
        Text(text, style = MaterialTheme.typography.bodySmall, color = tint)
    }
}
