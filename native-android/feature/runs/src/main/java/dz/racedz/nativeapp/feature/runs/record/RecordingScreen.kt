package dz.racedz.nativeapp.feature.runs.record

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
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

/** Built outside composition so the LaunchedEffects above can speak without a Composable context. */
private fun kmCue(context: android.content.Context, km: Int, pace: String): String =
    context.getString(R.string.runs_cue_km, km, pace)

private fun stepCue(context: android.content.Context, step: dz.racedz.nativeapp.core.network.GuidedStepDto): String {
    val role = when (step.role) {
        "WARMUP" -> R.string.runs_step_warmup
        "WORK" -> R.string.runs_step_work
        "RECOVERY" -> R.string.runs_step_recovery
        "COOLDOWN" -> R.string.runs_step_cooldown
        else -> R.string.runs_step_steady
    }
    val seconds = step.seconds
    val meters = step.meters
    val target = when {
        seconds != null -> context.getString(R.string.runs_step_minutes, seconds / 60)
        meters != null -> context.getString(R.string.runs_step_metres, meters)
        else -> ""
    }
    return context.getString(R.string.runs_cue_step, context.getString(role), target)
}

/**
 * The during-run screen (03-during-run.png).
 *
 * Always dark and laid out for a glance at arm's length while moving: distance is the largest thing
 * on the screen, the controls are within thumb reach at the bottom, and every touch target is well
 * over the 44dp minimum because the runner is not still.
 *
 * Back minimises rather than ending: the run keeps recording in the foreground service and the
 * runner returns to the rest of the app, with a banner offering one tap back here. A stray swipe
 * must never end a run, but it should not trap the runner on this screen either.
 */
@Composable
fun RecordingScreen(
    onFinished: () -> Unit,
    onDiscarded: () -> Unit,
    onMinimize: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by RunRecorder.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val locale = currentLocale()

    var confirmFinish by remember { mutableStateOf(false) }
    val guided by GuidedSessionController.state.collectAsStateWithLifecycle()

    // One engine for the life of the screen, shut down on leave so it does not hold audio focus
    // after the run.
    val voice = remember(RunSettings.audioCuesEnabled) {
        if (RunSettings.audioCuesEnabled) RunVoice(context, locale) else null
    }
    DisposableEffect(voice) { onDispose { voice?.release() } }

    // Kilometre splits are announced as they land. Keyed on the count so a recomposition cannot
    // repeat the last one.
    val splitCount = state.splits.size
    LaunchedEffect(splitCount) {
        val split = state.splits.lastOrNull() ?: return@LaunchedEffect
        voice?.say(kmCue(context, split.km, ZidRunFormat.pace(split.paceSecondsPerKm)))
    }

    // Guided steps advance off the same numbers shown on screen, and each change is spoken once.
    LaunchedEffect(state.elapsedSeconds, state.distanceMeters) {
        val entered = GuidedSessionController.advanceIfDue(state.elapsedSeconds, state.distanceMeters)
        if (entered != null) {
            voice?.say(stepCue(context, entered))
        } else if (guided.isComplete && guided.session != null) {
            voice?.say(context.getString(R.string.runs_cue_done))
        }
    }

    // Back leaves the screen, not the run. Recording continues in the service.
    BackHandler(enabled = state.status != RecordingStatus.Finished) { onMinimize() }

    if (confirmFinish) {
        // Finishing is irreversible from here, and the button sits next to Pause where a tired
        // thumb can easily miss. Confirming costs a second; ending a run by accident costs the run.
        AlertDialog(
            onDismissRequest = { confirmFinish = false },
            containerColor = ZidRunDarkColors.surface,
            title = {
                Text(
                    stringResource(R.string.runs_finish_confirm_title),
                    color = ZidRunDarkColors.textStrong,
                )
            },
            text = {
                Text(
                    stringResource(
                        R.string.runs_finish_confirm_body,
                        ZidRunFormat.decimal(state.distanceKm, locale),
                        ZidRunFormat.duration(state.elapsedSeconds),
                    ),
                    color = ZidRunDarkColors.text,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmFinish = false
                    RunRecorder.finish()
                    RunTrackingService.stop(context)
                    onFinished()
                }) {
                    Text(stringResource(R.string.runs_finish), color = ZidRunDarkColors.primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmFinish = false }) {
                    Text(stringResource(R.string.runs_keep_running), color = ZidRunDarkColors.textMuted)
                }
            },
        )
    }

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

        // The guided step in progress, with how much of it is left.
        guided.currentStep?.let { step ->
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stepRoleLabel(step.role) +
                        (step.repTotal?.let { " ${step.repCurrent}/$it" } ?: ""),
                    style = MaterialTheme.typography.titleMedium,
                    color = ZidRunDarkColors.primary,
                )
                Text(
                    text = stepTargetLabel(step),
                    style = MaterialTheme.typography.bodySmall,
                    color = ZidRunDarkColors.textMuted,
                )
            }
        }

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
                label = stringResource(R.string.runs_current_pace),
                value = state.currentPaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                tint = ZidRunDarkColors.primary,
                modifier = Modifier.weight(1f),
            )
            LiveTile(
                label = stringResource(R.string.runs_avg_pace),
                value = state.averagePaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                tint = ZidRunDarkColors.accent,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(ZidRunDimens.spaceSm))

        // The secondary numbers. Smaller than pace because a runner checks these between efforts,
        // not mid-stride.
        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SmallStat(
                label = stringResource(R.string.runs_moving_time),
                value = ZidRunFormat.duration(state.movingSeconds),
                modifier = Modifier.weight(1f),
            )
            StatHairline()
            SmallStat(
                label = stringResource(R.string.runs_elevation),
                value = "+${state.elevationGainM.toInt()} m",
                modifier = Modifier.weight(1f),
            )
            StatHairline()
            SmallStat(
                label = stringResource(R.string.runs_stat_calories),
                value = state.calories?.toString() ?: "—",
                modifier = Modifier.weight(1f),
            )
        }

        // Completed kilometres, newest first — the split just finished is the one being judged.
        val splits = state.splits
        if (splits.isNotEmpty()) {
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            ) {
                splits.reversed().forEach { split ->
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                            .background(ZidRunDarkColors.surfaceMuted)
                            .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm)
                            .semantics(mergeDescendants = true) {
                                contentDescription = "km ${split.km} ${ZidRunFormat.pace(split.paceSecondsPerKm)}"
                            },
                    ) {
                        Text(
                            "${stringResource(R.string.runs_split_km)} ${split.km}",
                            style = MaterialTheme.typography.labelSmall,
                            color = ZidRunDarkColors.textMuted,
                        )
                        Text(
                            ZidRunFormat.pace(split.paceSecondsPerKm),
                            style = MaterialTheme.typography.titleSmall,
                            color = ZidRunDarkColors.textStrong,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .heightIn(min = 144.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                .border(1.dp, ZidRunDarkColors.border, RoundedCornerShape(ZidRunDimens.cornerLg)),
        ) {
            RunMap(route = state.route, modifier = Modifier.fillMaxSize())
            if (state.route.orEmpty().size < 2) {
                Text(
                    text = stringResource(R.string.runs_gps_searching),
                    style = MaterialTheme.typography.labelLarge,
                    color = ZidRunDarkColors.textStrong,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = ZidRunDimens.spaceMd)
                        .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                        .background(ZidRunDarkColors.surface.copy(alpha = 0.88f))
                        .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                )
            }
        }

        if (state.autoPaused) {
            Text(
                text = stringResource(R.string.runs_auto_paused),
                style = MaterialTheme.typography.bodyMedium,
                color = ZidRunDarkColors.accent,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = ZidRunDimens.spaceSm),
            )
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        Controls(
            state = state,
            saving = false,
            onPause = { RunRecorder.pause() },
            onResume = { RunRecorder.resume() },
            onFinish = { confirmFinish = true },
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
        else -> stringResource(R.string.runs_recording)
    }
    val tint = when {
        state.status == RecordingStatus.Paused -> ZidRunDarkColors.textMuted
        !state.hasUsableFix -> ZidRunDarkColors.accent
        else -> ZidRunDarkColors.primary
    }
    val gpsLabel = when (state.gpsStrength) {
        GpsStrength.Strong -> stringResource(R.string.runs_gps_strong)
        GpsStrength.Good -> stringResource(R.string.runs_gps_good)
        GpsStrength.Weak -> stringResource(R.string.runs_gps_weak)
        GpsStrength.None -> stringResource(R.string.runs_gps_none)
        GpsStrength.Unknown -> stringResource(R.string.runs_gps_searching)
    }
    val gpsTint = when (state.gpsStrength) {
        GpsStrength.Strong, GpsStrength.Good -> ZidRunDarkColors.primary
        GpsStrength.Weak -> ZidRunDarkColors.accent
        else -> ZidRunDarkColors.danger
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
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Icon(
            Icons.Filled.SignalCellularAlt,
            contentDescription = null,
            tint = gpsTint,
            modifier = Modifier.size(16.dp),
        )
        Text(gpsLabel, style = MaterialTheme.typography.bodySmall, color = gpsTint)
    }
}

@Composable
private fun SmallStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$label $value" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = ZidRunDarkColors.textStrong)
        Text(label, style = MaterialTheme.typography.labelSmall, color = ZidRunDarkColors.textMuted)
    }
}

@Composable
private fun StatHairline() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(ZidRunDarkColors.border))
}

@Composable
private fun LiveTile(label: String, value: String, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(tint.copy(alpha = 0.10f))
            .border(1.dp, tint.copy(alpha = 0.34f), RoundedCornerShape(ZidRunDimens.cornerLg))
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
