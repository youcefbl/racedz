package dz.racedz.nativeapp.feature.runs.record

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Timer
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDarkSurfaceSystemBars
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale

/**
 * The during-run screen (03-during-run.png).
 *
 * Dark in every theme (the current theme's dark palette — see zidRunOnDarkColors) and laid out for
 * a glance at arm's length while moving: distance is the largest thing on the screen, the controls
 * are within thumb reach at the bottom, and every touch target is well over the 44dp minimum
 * because the runner is not still.
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
    /** The mid-run coach, for subscribers. Null in previews and where coaching is not wired. */
    coachViewModel: MidRunCoachViewModel? = null,
) {
    // This screen is dark in every theme, so the system bars must be too (DEV-R01).
    ZidRunDarkSurfaceSystemBars()

    val state by RunRecorder.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val locale = currentLocale()

    var confirmFinish by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }
    val guided by GuidedSessionController.state.collectAsStateWithLifecycle()
    var lapNotice by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(lapNotice) {
        if (lapNotice != null) {
            kotlinx.coroutines.delay(3_000)
            lapNotice = null
        }
    }

    // The run voice is owned by RunCueDirector (started with the run service), so cues keep playing
    // with the screen off. The screen only tells it which language the runner is reading.
    LaunchedEffect(locale) { RunCueDirector.setLocale(locale) }

    // The screen stays awake for the life of the recording (Strava parity, P0-1). Set on the host
    // view rather than as a window flag so it is scoped exactly to this screen and released with it;
    // the run itself keeps recording in the service either way.
    val view = LocalView.current
    DisposableEffect(view) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    val haptics = LocalHapticFeedback.current

    // A tick the wrist can feel at every completed kilometre, whether or not cues are on. Spoken
    // cues (progress, status, guided steps) are decided by RunCueDirector, screen on or off.
    val splitCount = state.splits.size
    LaunchedEffect(splitCount) {
        if (splitCount > 0) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    // Auto-pauses get a double tick so a runner with music on still notices the clock stopped.
    var lastStatus by remember { mutableStateOf<RecordingStatus?>(null) }
    LaunchedEffect(state.status, state.autoPauseReason) {
        val previous = lastStatus
        lastStatus = state.status
        if (previous == null) return@LaunchedEffect
        if (previous != RecordingStatus.Paused && state.status == RecordingStatus.Paused && state.autoPaused) {
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }

    // Back leaves the screen, not the run. Recording continues in the service.
    BackHandler(enabled = state.status != RecordingStatus.Finished) { onMinimize() }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            containerColor = zidRunOnDarkColors().surface,
            title = {
                Text(
                    stringResource(R.string.runs_discard_confirm_title),
                    color = zidRunOnDarkColors().textStrong,
                )
            },
            text = {
                Text(
                    stringResource(
                        R.string.runs_discard_confirm_body,
                        ZidRunFormat.distanceWithUnit(state.distanceKm, locale, dz.racedz.nativeapp.core.design.ZidRunUnits.label(context), digits = 2),
                        ZidRunFormat.duration(state.elapsedSeconds),
                    ),
                    color = zidRunOnDarkColors().text,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    RunTrackingService.stop(context)
                    RunRecorder.discard()
                    onDiscarded()
                }) {
                    Text(stringResource(R.string.runs_discard), color = zidRunOnDarkColors().danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDiscard = false }) {
                    Text(stringResource(R.string.runs_keep_running), color = zidRunOnDarkColors().primary)
                }
            },
        )
    }

    if (confirmFinish) {
        // Finishing is irreversible from here, and the button sits next to Pause where a tired
        // thumb can easily miss. Confirming costs a second; ending a run by accident costs the run.
        AlertDialog(
            onDismissRequest = { confirmFinish = false },
            containerColor = zidRunOnDarkColors().surface,
            title = {
                Text(
                    stringResource(R.string.runs_finish_confirm_title),
                    color = zidRunOnDarkColors().textStrong,
                )
            },
            text = {
                Text(
                    stringResource(
                        R.string.runs_finish_confirm_body,
                        ZidRunFormat.distanceWithUnit(state.distanceKm, locale, dz.racedz.nativeapp.core.design.ZidRunUnits.label(context), digits = 2),
                        ZidRunFormat.duration(state.elapsedSeconds),
                    ),
                    color = zidRunOnDarkColors().text,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmFinish = false
                    // RunCueDirector hears the Finished state and says "Run finished…" itself.
                    RunRecorder.finish()
                    RunTrackingService.stop(context)
                    onFinished()
                }) {
                    Text(stringResource(R.string.runs_finish), color = zidRunOnDarkColors().primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmFinish = false }) {
                    Text(stringResource(R.string.runs_keep_running), color = zidRunOnDarkColors().textMuted)
                }
            },
        )
    }

    Box(modifier = modifier.fillMaxSize().background(zidRunOnDarkColors().background)) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = ZidRunDimens.spaceLg)
            // While locked the whole surface is hidden from accessibility too, so a TalkBack
            // double-tap cannot reach Finish around the pointer guard.
            .then(if (state.touchLocked) Modifier.clearAndSetSemantics { } else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        StatusHeader(state = state, onLock = { RunRecorder.setTouchLocked(true) })

        // The guided step in progress, with how much of it is left.
        guided.currentStep?.let { step ->
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stepRoleLabel(step.role) +
                        (step.repTotal?.let { " ${step.repCurrent}/$it" } ?: ""),
                    style = MaterialTheme.typography.titleMedium,
                    color = zidRunOnDarkColors().primary,
                )
                Text(
                    text = stepTargetLabel(step),
                    style = MaterialTheme.typography.bodySmall,
                    color = zidRunOnDarkColors().textMuted,
                )
            }
        }

        Spacer(Modifier.height(ZidRunDimens.spaceLg))

        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = ZidRunFormat.distanceValue(state.distanceKm, locale),
                style = MaterialTheme.typography.displayLarge,
                color = zidRunOnDarkColors().textStrong,
            )
            Spacer(Modifier.width(ZidRunDimens.spaceXs))
            Text(
                text = dz.racedz.nativeapp.core.design.distanceUnitLabel(),
                style = MaterialTheme.typography.headlineSmall,
                color = zidRunOnDarkColors().textMuted,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        Text(
            text = ZidRunFormat.duration(state.elapsedSeconds),
            style = MaterialTheme.typography.displayMedium,
            color = zidRunOnDarkColors().textStrong,
        )

        Spacer(Modifier.height(ZidRunDimens.spaceLg))

        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            LiveTile(
                label = stringResource(R.string.runs_current_pace),
                value = state.currentPaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                tint = zidRunOnDarkColors().primary,
                modifier = Modifier.weight(1f),
            )
            // With a heart-rate sensor connected the second tile is Heart rate (03-during-run.png,
            // owner decision 2026-08-16) and Avg pace moves to the secondary row; without one nothing
            // changes. Never a number that did not come from the sensor.
            val hrConnected = state.heartRateBpm != null
            if (hrConnected) {
                LiveTile(
                    label = stringResource(R.string.runs_heart_rate),
                    value = "${ZidRunFormat.count(state.heartRateBpm!!, locale)} ${stringResource(R.string.runs_hr_unit)}",
                    tint = zidRunOnDarkColors().accent,
                    modifier = Modifier.weight(1f),
                )
            } else {
                LiveTile(
                    label = stringResource(R.string.runs_avg_pace),
                    value = state.averagePaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                    tint = zidRunOnDarkColors().accent,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(Modifier.height(ZidRunDimens.spaceSm))

        // The secondary numbers. Smaller than pace because a runner checks these between efforts,
        // not mid-stride.
        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Live cadence over the last ~20 s (NATRUN-06.6, owner decision: never the delayed
            // whole-run average). "—" until enough steps, while stopped, or with no step counter;
            // TalkBack learns that on focus, not from a repeated announcement.
            val cadence = state.liveCadenceSpm
            SmallStat(
                label = stringResource(R.string.runs_cadence),
                value = cadence?.let { ZidRunFormat.count(it, locale) } ?: "—",
                a11y = if (cadence != null) null else stringResource(R.string.runs_cadence_unavailable),
                modifier = Modifier.weight(1f),
            )
            StatHairline()
            SmallStat(
                label = stringResource(R.string.runs_elevation),
                value = ZidRunFormat.elevationGain(state.elevationGainM.toInt()),
                modifier = Modifier.weight(1f),
            )
            StatHairline()
            if (state.heartRateBpm != null) {
                SmallStat(
                    label = stringResource(R.string.runs_avg_pace),
                    value = state.averagePaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                    modifier = Modifier.weight(1f),
                )
            } else {
                SmallStat(
                    label = stringResource(R.string.runs_stat_calories),
                    value = state.calories?.toString() ?: "—",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Completed splits, newest first, in the same row language as Run Details (index · bar ·
        // pace · Δ vs the run's average) so the runner reads the km they just finished the way they
        // will read it afterwards. Bounded to a few rows and scrollable, so the map keeps its space.
        val splits = state.splits
        if (splits.isNotEmpty()) {
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
            LiveSplitsList(
                splits = splits,
                averagePace = state.averagePaceSecondsPerKm,
                modifier = Modifier.fillMaxWidth().heightIn(max = 148.dp),
            )
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        // The map appears only once a trusted route exists. While acquiring, a full-height empty
        // panel with a small "Searching" pill read as a broken screen outdoors; a compact status
        // strip says the same thing honestly and leaves the controls where the thumb expects them
        // (DEV-R08).
        if (state.route.orEmpty().size > 1) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .heightIn(min = 144.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .border(1.dp, zidRunOnDarkColors().border, RoundedCornerShape(ZidRunDimens.cornerLg)),
            ) {
                LiveRunMap(
                    route = state.route,
                    headingDegrees = state.headingDegrees,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        } else {
            // Two distinct states, because they are two distinct situations (device review):
            // with no usable fix yet the app is still ACQUIRING, but once a fix lands the recorder
            // is already Recording with good GPS and a single point — saying "Searching" beside a
            // "Recording · Strong GPS" pill contradicted itself, and promising that distance was
            // already counting was untrue until an accepted segment exists.
            val acquiring = !state.hasUsableFix || state.route.orEmpty().isEmpty()
            val title = stringResource(
                if (acquiring) R.string.runs_gps_searching else R.string.runs_gps_ready_title
            )
            val help = stringResource(
                if (acquiring) R.string.runs_gps_searching_help else R.string.runs_gps_ready_help
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .background(zidRunOnDarkColors().surface)
                    .padding(ZidRunDimens.spaceLg)
                    // Announced politely as the state changes, without stealing focus mid-run.
                    .semantics(mergeDescendants = true) {
                        liveRegion = LiveRegionMode.Polite
                        contentDescription = "$title. $help"
                    },
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    color = zidRunOnDarkColors().textStrong,
                )
                Text(
                    text = help,
                    style = MaterialTheme.typography.bodySmall,
                    color = zidRunOnDarkColors().textMuted,
                )
            }
            Spacer(Modifier.weight(1f))
        }

        if (state.autoPaused) {
            Text(
                text = stringResource(
                    if (state.autoPauseReason == AutoPauseReason.Stationary) R.string.runs_auto_paused_still
                    else R.string.runs_auto_paused
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = zidRunOnDarkColors().accent,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(vertical = ZidRunDimens.spaceSm),
            )
        }

        // Told while it is still happening. The server applies the same test at save time and
        // quietly leaves the activity out of records, streaks and the coach's picture — learning
        // that only afterwards, from a run already in the list, is too late to do anything about
        // it. Here the runner can still stop, or finish and discard.
        if (state.nonFootReason != null) {
            Text(
                text = stringResource(R.string.runs_nonfoot_live),
                style = MaterialTheme.typography.bodyMedium,
                color = zidRunOnDarkColors().accent,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(vertical = ZidRunDimens.spaceSm)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }

        // Ask-the-coach mid-run, for entitled runners (trial or subscribed), and not once finished.
        val coachState = coachViewModel?.state?.collectAsStateWithLifecycle()?.value
        if (coachViewModel != null && coachState?.canCoach == true && state.status != RecordingStatus.Finished) {
            Spacer(Modifier.height(ZidRunDimens.spaceMd))
            MidRunCoachButton(onOpen = coachViewModel::open)
            MidRunCoachSheet(viewModel = coachViewModel, speak = RunCueDirector::sayText)
        }

        Spacer(Modifier.height(ZidRunDimens.spaceMd))

        // Lap confirmation (NATRUN-06.5): the press is felt at once and the mark is shown for a
        // few seconds where the thumb already is; TalkBack hears it once through the live region.
        lapNotice?.let { notice ->
            Text(
                text = notice,
                style = MaterialTheme.typography.bodyMedium,
                color = zidRunOnDarkColors().primary,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(bottom = ZidRunDimens.spaceSm)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }

        Controls(
            state = state,
            saving = false,
            onPause = { RunRecorder.pause() },
            onResume = { RunRecorder.resume() },
            onFinish = { confirmFinish = true },
            onLap = {
                when (RunRecorder.markLap()) {
                    RunRecorder.LapResult.Marked -> {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        val mark = RunRecorder.state.value.laps.last()
                        val index = RunRecorder.state.value.laps.size
                        val previous = RunRecorder.state.value.laps.getOrNull(index - 2)
                        val lapSeconds = mark.atSeconds - (previous?.atSeconds ?: 0)
                        lapNotice = context.getString(
                            R.string.runs_lap_marked,
                            ZidRunFormat.count(index, locale),
                            ZidRunFormat.duration(lapSeconds),
                        )
                    }
                    RunRecorder.LapResult.TooSoon -> lapNotice = context.getString(R.string.runs_lap_too_soon)
                    RunRecorder.LapResult.NotRecording -> Unit
                }
            },
            // Never one tap. Discard shares the left slot with Lap and appears the moment the run
            // pauses — including an *auto*-pause the runner did not see coming — so a tap meant
            // for Lap could land on it and destroy the run (2026-11-14, a walk lost this way).
            onDiscard = { confirmDiscard = true },
        )

        Spacer(Modifier.height(ZidRunDimens.spaceLg))
    }

    if (state.touchLocked && state.status != RecordingStatus.Finished) {
        TouchGuardOverlay(onUnlock = { RunRecorder.setTouchLocked(false) })
    }
    }
}

@Composable
private fun StatusHeader(state: RecordingState, onLock: () -> Unit) {
    val recording = state.status == RecordingStatus.Recording || state.status == RecordingStatus.Acquiring
    val label = when {
        state.status == RecordingStatus.Paused -> stringResource(R.string.runs_paused)
        else -> stringResource(R.string.runs_recording)
    }
    val tint = when {
        state.status == RecordingStatus.Paused -> zidRunOnDarkColors().textMuted
        !state.hasUsableFix -> zidRunOnDarkColors().accent
        else -> zidRunOnDarkColors().primary
    }
    val gpsLabel = when (state.gpsStrength) {
        GpsStrength.Strong -> stringResource(R.string.runs_gps_strong)
        GpsStrength.Good -> stringResource(R.string.runs_gps_good)
        GpsStrength.Weak -> stringResource(R.string.runs_gps_weak)
        GpsStrength.None -> stringResource(R.string.runs_gps_none)
        GpsStrength.Unknown -> stringResource(R.string.runs_gps_searching)
    }
    val gpsTint = when (state.gpsStrength) {
        GpsStrength.Strong, GpsStrength.Good -> zidRunOnDarkColors().primary
        GpsStrength.Weak -> zidRunOnDarkColors().accent
        else -> zidRunOnDarkColors().danger
    }

    val lockLabel = stringResource(R.string.runs_lock_screen)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(top = ZidRunDimens.spaceXs),
    ) {
        Spacer(Modifier.width(44.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { },
        ) {
            Spacer(Modifier.weight(1f))
            Box(Modifier.size(10.dp).clip(CircleShape).background(if (recording) tint else zidRunOnDarkColors().textMuted))
            Text(label, style = MaterialTheme.typography.titleMedium, color = tint)
            Spacer(Modifier.width(ZidRunDimens.spaceSm))
            Icon(
                Icons.Filled.SignalCellularAlt,
                contentDescription = null,
                tint = gpsTint,
                modifier = Modifier.size(16.dp),
            )
            Text(gpsLabel, style = MaterialTheme.typography.bodySmall, color = gpsTint)
            Spacer(Modifier.weight(1f))
        }
        // Touch guard (NATRUN-07.7): a labelled 44 dp lock at the trailing end, always visible.
        androidx.compose.material3.IconButton(
            onClick = onLock,
            modifier = Modifier.size(44.dp).semantics { contentDescription = lockLabel },
        ) {
            Icon(Icons.Filled.Lock, contentDescription = null, tint = zidRunOnDarkColors().textMuted)
        }
    }
}

@Composable
private fun SmallStat(label: String, value: String, modifier: Modifier = Modifier, a11y: String? = null) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = a11y ?: "$label $value" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = zidRunOnDarkColors().textStrong)
        Text(label, style = MaterialTheme.typography.labelSmall, color = zidRunOnDarkColors().textMuted)
    }
}

@Composable
private fun StatHairline() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(zidRunOnDarkColors().border))
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
        Text(value, style = MaterialTheme.typography.headlineMedium, color = zidRunOnDarkColors().textStrong)
    }
}

@Composable
private fun Controls(
    state: RecordingState,
    saving: Boolean,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinish: () -> Unit,
    onLap: () -> Unit,
    onDiscard: () -> Unit,
) {
    val paused = state.status == RecordingStatus.Paused
    val finished = state.status == RecordingStatus.Finished
    val recording = state.status == RecordingStatus.Recording

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The left thumb slot: Lap while recording (owner decision 2026-08-16, stopwatch icon, same
        // 48 dp circle language as Finish); Discard only while paused, so it takes a deliberate stop
        // and can never be a mis-tap mid-stride.
        if (recording) {
            CircleAction(
                label = stringResource(R.string.runs_lap),
                tint = zidRunOnDarkColors().primary,
                onClick = onLap,
                icon = Icons.Filled.Timer,
            )
        } else if (paused && !finished) {
            CircleAction(
                label = stringResource(R.string.runs_discard),
                tint = zidRunOnDarkColors().danger,
                onClick = onDiscard,
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 64.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                .background(if (paused) zidRunOnDarkColors().primary else zidRunOnDarkColors().surfaceMuted)
                .clickable(enabled = !saving, role = Role.Button, onClick = if (paused) onResume else onPause),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (paused) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                    contentDescription = null,
                    tint = if (paused) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textStrong,
                )
                Spacer(Modifier.width(ZidRunDimens.spaceSm))
                Text(
                    text = stringResource(if (paused) R.string.runs_resume else R.string.runs_pause),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (paused) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textStrong,
                )
            }
        }

        if (saving) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                strokeWidth = 3.dp,
                color = zidRunOnDarkColors().primary,
            )
        } else {
            CircleAction(
                label = stringResource(R.string.runs_finish),
                tint = zidRunOnDarkColors().accent,
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


/**
 * The live splits table: newest first, one row per completed km/mile with a bar against the fastest
 * split, its pace, and the difference to the run's average (faster in primary, slower in accent),
 * mirroring Run Details' SplitRow. Newest first because the split just finished is the one being
 * judged; older ones scroll.
 */
@Composable
private fun LiveSplitsList(splits: List<LiveSplit>, averagePace: Int?, modifier: Modifier = Modifier) {
    val colors = zidRunOnDarkColors()
    val fastest = splits.minOf { it.paceSecondsPerKm }.coerceAtLeast(1)
    val unitHeader = stringResource(
        if (dz.racedz.nativeapp.core.design.ZidRunUnits.current == dz.racedz.nativeapp.core.design.DistanceUnit.MI) R.string.runs_split_mi
        else R.string.runs_split_km
    )
    val locale = currentLocale()
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surface)
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(unitHeader, style = MaterialTheme.typography.labelSmall, color = colors.textMuted, modifier = Modifier.width(36.dp))
            Spacer(Modifier.weight(1f))
            Text(stringResource(R.string.runs_split_pace), style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
            Text("\u0394", style = MaterialTheme.typography.labelSmall, color = colors.textMuted, textAlign = TextAlign.End, modifier = Modifier.width(52.dp))
        }
        Column(
            modifier = Modifier.fillMaxWidth().weight(1f, fill = false).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            splits.asReversed().forEach { split ->
                val fraction = (fastest.toFloat() / split.paceSecondsPerKm.toFloat()).coerceIn(0.25f, 1f)
                val isFastest = split.paceSecondsPerKm == fastest && splits.size > 1
                val delta = averagePace?.let { split.paceSecondsPerKm - it }
                val deltaText = when {
                    delta == null -> ""
                    delta == 0 -> "0:00"
                    else -> (if (delta < 0) "-" else "+") + ZidRunFormat.duration(kotlin.math.abs(delta))
                }
                val deltaColor = when {
                    delta == null || delta == 0 -> colors.textMuted
                    delta < 0 -> colors.primary
                    else -> colors.accent
                }
                val paceText = ZidRunFormat.pace(split.paceSecondsPerKm)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 28.dp)
                        .semantics(mergeDescendants = true) {
                            contentDescription = "$unitHeader ${split.km} $paceText $deltaText"
                        },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(ZidRunFormat.count(split.km, locale), style = MaterialTheme.typography.bodyMedium, color = colors.text, modifier = Modifier.width(36.dp))
                    Box(Modifier.weight(1f).padding(end = ZidRunDimens.spaceSm)) {
                        Box(
                            Modifier
                                .fillMaxWidth(fraction)
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (isFastest) colors.accent else colors.primary),
                        )
                    }
                    Text(paceText, style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
                    Text(deltaText, style = MaterialTheme.typography.bodySmall, color = deltaColor, textAlign = TextAlign.End, modifier = Modifier.width(52.dp))
                }
            }
        }
    }
}
