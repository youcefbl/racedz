package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens

/** The pill that opens the coach sheet. The caller renders it only for subscribers, mid-run. */
@Composable
fun MidRunCoachButton(onOpen: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
            .background(ZidRunDarkColors.primary.copy(alpha = 0.14f))
            .clickable(role = Role.Button, onClick = onOpen)
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(
            Icons.Outlined.Forum,
            contentDescription = null,
            tint = ZidRunDarkColors.primary,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = stringResource(R.string.runs_coach_ask),
            style = MaterialTheme.typography.labelLarge,
            color = ZidRunDarkColors.primary,
        )
    }
}

/**
 * The mid-run coach sheet: a reply area, a text composer, and a mic that records → transcribes →
 * asks. [speak] reads the reply aloud when run audio is on; the reply is always shown as text too.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun MidRunCoachSheet(
    viewModel: MidRunCoachViewModel,
    speak: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (!state.open) return

    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    // Also sweeps any orphaned voice notes a prior killed process may have left behind.
    val recorder = remember { RunCoachVoiceRecorder(context).also { it.cleanupStale() } }
    // A sheet dismissed mid-recording must not leave the mic open.
    DisposableEffect(Unit) { onDispose { recorder.cancel() } }

    fun stopAndTranscribe() {
        viewModel.setRecording(false)
        val file = recorder.stop()
        // Fills the composer for the runner to read and Send — never auto-sent (mishearing spends
        // quota and could store an unintended statement).
        if (file != null) viewModel.transcribeToDraft(file, RunCoachVoiceRecorder.MIME_TYPE)
    }

    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            runCatching { recorder.start() }
                .onSuccess { viewModel.setRecording(true) }
        }
    }

    fun toggleMic() {
        if (state.recording) {
            stopAndTranscribe()
            return
        }
        val hasMic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (hasMic) {
            runCatching { recorder.start() }.onSuccess { viewModel.setRecording(true) }
        } else {
            micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    ModalBottomSheet(
        onDismissRequest = { recorder.cancel(); viewModel.setRecording(false); viewModel.close() },
        sheetState = sheetState,
        containerColor = ZidRunDarkColors.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .imePadding()
                .padding(horizontal = ZidRunDimens.spaceLg)
                .padding(bottom = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Text(
                text = stringResource(R.string.runs_coach_ask),
                style = MaterialTheme.typography.titleMedium,
                color = ZidRunDarkColors.textStrong,
            )

            // The status line: reply, an in-flight note, or the prompt hint.
            val status = when {
                state.transcribing -> stringResource(R.string.runs_coach_transcribing)
                state.asking -> stringResource(R.string.runs_coach_thinking)
                state.recording -> stringResource(R.string.runs_coach_listening)
                else -> null
            }
            state.reply?.let { reply ->
                Text(
                    text = reply,
                    style = MaterialTheme.typography.bodyMedium,
                    color = ZidRunDarkColors.text,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                        .background(ZidRunDarkColors.surfaceMuted)
                        .padding(ZidRunDimens.spaceMd),
                )
            }
            status?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = ZidRunDarkColors.textMuted)
            }
            state.error?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = ZidRunDarkColors.danger)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            ) {
                OutlinedTextField(
                    value = state.draft,
                    onValueChange = viewModel::setDraft,
                    modifier = Modifier.weight(1f),
                    enabled = !state.busy,
                    placeholder = { Text(stringResource(R.string.runs_coach_hint)) },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = ZidRunDarkColors.surfaceMuted,
                        unfocusedContainerColor = ZidRunDarkColors.surfaceMuted,
                        focusedTextColor = ZidRunDarkColors.textStrong,
                        unfocusedTextColor = ZidRunDarkColors.textStrong,
                    ),
                    maxLines = 3,
                )

                // Mic: start/stop a voice note. Turns into a stop button while recording.
                CoachCircle(
                    tint = if (state.recording) ZidRunDarkColors.danger else ZidRunDarkColors.primary,
                    enabled = !state.busy,
                    icon = { m ->
                        Icon(
                            if (state.recording) Icons.Filled.Stop else Icons.Filled.Mic,
                            contentDescription = stringResource(R.string.runs_coach_mic),
                            tint = if (state.recording) ZidRunDarkColors.danger else ZidRunDarkColors.primary,
                            modifier = m,
                        )
                    },
                    onClick = { toggleMic() },
                )

                // Send the typed text.
                if (state.busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(28.dp),
                        strokeWidth = 3.dp,
                        color = ZidRunDarkColors.primary,
                    )
                } else {
                    CoachCircle(
                        tint = ZidRunDarkColors.primary,
                        enabled = state.draft.isNotBlank(),
                        icon = { m ->
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = stringResource(R.string.runs_coach_send),
                                tint = if (state.draft.isNotBlank()) ZidRunDarkColors.primary else ZidRunDarkColors.textMuted,
                                modifier = m,
                            )
                        },
                        onClick = { viewModel.ask(state.draft, speak) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CoachCircle(
    tint: Color,
    enabled: Boolean,
    icon: @Composable (Modifier) -> Unit,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(tint.copy(alpha = if (enabled) 0.18f else 0.06f))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        icon(Modifier.size(22.dp))
    }
}
