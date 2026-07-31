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
import androidx.compose.material.icons.filled.Info
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.network.CoachMessageDto

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
                    items(state.conversation.messages, key = { it.id }) { message ->
                        MessageTurn(message)
                    }

                    if (state.conversation.messages.isEmpty()) {
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
                        onValueChange = { draft = it.take(1200) },
                        label = stringResource(R.string.coach_chat_hint),
                        // Disabled while a reply is generating: a second question would spend
                        // another credit before the first is answered.
                        enabled = !state.sending && !state.awaitingReply,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    if (state.sending || state.awaitingReply) {
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

@Composable
private fun MessageTurn(message: CoachMessageDto) {
    val colors = ZidRunTheme.colors

    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        message.userMessage?.takeIf { it.isNotBlank() }?.let { text ->
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

        when {
            message.status == "PENDING" -> Row(
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

            // BLOCKED is a deliberate refusal by the safety layer, not a fault. Saying "something
            // went wrong" would invite the runner to rephrase and try again, which is the opposite
            // of what a block is for.
            message.status == "BLOCKED" -> SafetyNotice(stringResource(R.string.coach_chat_blocked))

            message.status == "FAILED" -> SafetyNotice(stringResource(R.string.coach_chat_failed))

            else -> message.response?.takeIf { it.isNotBlank() }?.let { text ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                        .background(colors.surface)
                        .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerLg))
                        .padding(ZidRunDimens.spaceMd),
                ) {
                    Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.text)
                }
            }
        }

        // Rendered as its own notice rather than folded into the reply, so a safety message cannot
        // be mistaken for ordinary advice.
        if (message.safety != null && message.status == "COMPLETED") {
            SafetyNotice(stringResource(R.string.coach_chat_safety))
        }
    }
}

@Composable
private fun SafetyNotice(text: String) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.infoSoft)
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(Icons.Filled.Info, contentDescription = null, tint = colors.info, modifier = Modifier.size(18.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = colors.info)
    }
}
