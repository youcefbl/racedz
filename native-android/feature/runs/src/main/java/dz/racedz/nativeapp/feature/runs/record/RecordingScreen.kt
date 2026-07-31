package dz.racedz.nativeapp.feature.runs.record

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.feature.runs.RunMap

/**
 * The during-run screen (03-during-run.png).
 *
 * Always dark and laid out for a glance at arm's length while moving: distance is the largest thing
 * on the screen, the controls are within thumb reach at the bottom, and every touch target is well
 * over the 44dp minimum because the runner is not still.
 *
 * Back is intercepted — a stray swipe must not end a run in progress. The run ends only through
 * Finish, and the recording keeps going in the foreground service if the app is backgrounded.
 */
@Composable
fun RecordingScreen(
    viewModel: RecordRunViewModel,
    onSaved: (String) -> Unit,
    onDiscarded: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by RunRecorder.state.collectAsStateWithLifecycle()
    val saveState by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val locale = currentLocale()

    // Swiping back mid-run would silently abandon it; the runner has to choose Finish.
    BackHandler(enabled = state.status != RecordingStatus.Finished) { }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ZidRunDarkColors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = ZidRunDimens.spaceLg),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        StatusHeader(state = state)

        Spacer(Modifier.height(ZidRunDimens.spaceLg))

        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = ZidRunFormat.decimal(state.distanceKm, locale),
                style = MaterialTheme.typography.displayLarge,
                color = ZidRunDarkColors.textStrong,
            )
            Spacer(Modifier.width(ZidRunDimens.spaceXs))
            Text(
                text = stringResource(R.string.runs_unit_km),
                style = MaterialTheme.typography.headlineSmall,
                color = ZidRunDarkColors.textMuted,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        Text(
            text = ZidRunFormat.duration(state.elapsedSeconds),
            style = MaterialTheme.typography.displayMedium,
            color = ZidRunDarkColors.textStrong,
        )

        Spacer(Modifier.height(ZidRunDimens.spaceLg))

        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            LiveTile(
                label = stringResource(R.string.runs_stat_pace),
                value = state.currentPaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                tint = ZidRunDarkColors.primary,
                modifier = Modifier.weight(1f),
            )
            LiveTile(
                label = stringResource(R.string.runs_elevation),
                value = "+${state.elevationGainM.toInt()} m",
                tint = ZidRunDarkColors.accent,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        RunMap(
            route = state.route,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(ZidRunDimens.cornerLg)),
        )

        if (state.autoPaused) {
            Text(
                text = stringResource(R.string.runs_auto_paused),
                style = MaterialTheme.typography.bodyMedium,
                color = ZidRunDarkColors.accent,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = ZidRunDimens.spaceSm),
            )
        }

        saveState.error?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = ZidRunDarkColors.danger,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = ZidRunDimens.spaceSm),
            )
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        Controls(
            state = state,
            saving = saveState.saving,
            onPause = { RunRecorder.pause() },
            onResume = { RunRecorder.resume() },
            onFinish = {
                RunRecorder.finish()
                RunTrackingService.stop(context)
                viewModel.save(onSaved)
            },
            onDiscard = {
                RunTrackingService.stop(context)
                RunRecorder.reset()
                onDiscarded()
            },
        )

        Spacer(Modifier.height(ZidRunDimens.spaceLg))
    }
}

@Composable
private fun StatusHeader(state: RecordingState) {
    val recording = state.status == RecordingStatus.Recording || state.status == RecordingStatus.Acquiring
    val label = when {
        state.status == RecordingStatus.Paused -> stringResource(R.string.runs_paused)
        !state.hasUsableFix -> stringResource(R.string.runs_gps_weak)
        else -> stringResource(R.string.runs_recording)
    }
    val tint = when {
        state.status == RecordingStatus.Paused -> ZidRunDarkColors.textMuted
        !state.hasUsableFix -> ZidRunDarkColors.accent
        else -> ZidRunDarkColors.primary
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        modifier = Modifier
            .padding(top = ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(if (recording) tint else ZidRunDarkColors.textMuted))
        Text(label, style = MaterialTheme.typography.titleMedium, color = tint)
    }
}

@Composable
private fun LiveTile(label: String, value: String, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(tint.copy(alpha = 0.10f))
            .padding(ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { contentDescription = "$label $value" },
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Text(label.uppercase(), style = MaterialTheme.typography.labelMedium, color = tint)
        Text(value, style = MaterialTheme.typography.headlineMedium, color = ZidRunDarkColors.textStrong)
    }
}

@Composable
private fun Controls(
    state: RecordingState,
    saving: Boolean,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinish: () -> Unit,
    onDiscard: () -> Unit,
) {
    val paused = state.status == RecordingStatus.Paused
    val finished = state.status == RecordingStatus.Finished

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Discard is only offered while paused: it must take a deliberate stop, never a mis-tap
        // mid-stride.
        if (paused && !finished) {
            CircleAction(
                label = stringResource(R.string.runs_discard),
                tint = ZidRunDarkColors.danger,
                onClick = onDiscard,
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 64.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                .background(if (paused) ZidRunDarkColors.primary else ZidRunDarkColors.surfaceMuted)
                .clickable(enabled = !saving, role = Role.Button, onClick = if (paused) onResume else onPause),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                    contentDescription = null,
                    tint = if (paused) ZidRunDarkColors.onPrimary else ZidRunDarkColors.textStrong,
                )
                Spacer(Modifier.width(ZidRunDimens.spaceSm))
                Text(
                    text = stringResource(if (paused) R.string.runs_resume else R.string.runs_pause),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (paused) ZidRunDarkColors.onPrimary else ZidRunDarkColors.textStrong,
                )
            }
        }

        if (saving) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                strokeWidth = 3.dp,
                color = ZidRunDarkColors.primary,
            )
        } else {
            CircleAction(
                label = stringResource(R.string.runs_finish),
                tint = ZidRunDarkColors.accent,
                onClick = onFinish,
                icon = Icons.Filled.Flag,
            )
        }
    }
}

@Composable
private fun CircleAction(
    label: String,
    tint: Color,
    onClick: () -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(ZidRunDimens.spaceSm)
            .semantics(mergeDescendants = true) { },
    ) {
        Box(
            modifier = Modifier.size(48.dp).clip(CircleShape).background(tint.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon ?: Icons.Filled.Pause,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(22.dp),
            )
        }
        Text(label, style = MaterialTheme.typography.labelMedium, color = tint)
    }
}
