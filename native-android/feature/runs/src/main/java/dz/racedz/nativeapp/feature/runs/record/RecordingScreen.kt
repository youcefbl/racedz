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
 * The periodic progress cue (built outside composition so a LaunchedEffect can speak it): distance
 * so far, elapsed, and the pace held over the interval just closed. Whole kilometres are read as a
 * count ("3"), fractional marks with one decimal ("2.5"), so the voice never says "three point
 * zero zero".
 */
private fun progressCue(
    context: android.content.Context,
    distanceMeters: Int,
    elapsedSeconds: Int,
    intervalPaceSecondsPerKm: Int?,
    locale: java.util.Locale,
): String {
    val km = if (distanceMeters % 1000 == 0) {
        ZidRunFormat.count(distanceMeters / 1000, locale)
    } else {
        ZidRunFormat.decimal(distanceMeters / 1000.0, locale, digits = 1)
    }
    val pace = intervalPaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—"
    return context.getString(R.string.runs_cue_progress, km, ZidRunFormat.duration(elapsedSeconds), pace)
}

/**
 * Which progress mark was last spoken for which recording. Process-level rather than remembered
 * in composition, so minimising the screen and coming back neither repeats the last mark nor
 * measures the next interval's pace from the moment of return.
 */
private object ProgressCueTracker {
    var clientId: String = ""
    var lastIndex: Int = 0
    var lastElapsedSeconds: Int = 0

    class Mark(val secondsSincePrevious: Int, val previousIndex: Int)

    /** Records [index] as spoken and returns how far it is from the previous mark, or null if it is not new. */
    fun advance(clientId: String, index: Int, elapsedSeconds: Int): Mark? {
        if (this.clientId != clientId) {
            this.clientId = clientId
            lastIndex = 0
            lastElapsedSeconds = 0
        }
        if (index <= lastIndex) return null
        val mark = Mark(elapsedSeconds - lastElapsedSeconds, lastIndex)
        lastIndex = index
        lastElapsedSeconds = elapsedSeconds
        return mark
    }
}

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
    // Spoken and displayed counts use the same Western-digit rule as the rest of the app; see
    // stepTargetLabel for why a %d placeholder is not enough.
    val locale = dz.racedz.nativeapp.core.design.localeOf(context)
    val target = when {
        // A stride's 20 s work rep must be spoken as seconds, not "0 minutes".
        seconds != null && seconds < 60 -> context.getString(
            R.string.runs_step_seconds,
            ZidRunFormat.count(seconds, locale),
        )
        seconds != null -> context.getString(
            R.string.runs_step_minutes,
            ZidRunFormat.count(seconds / 60, locale),
        )
        meters != null -> context.getString(
            R.string.runs_step_metres,
            ZidRunFormat.count(meters, locale),
        )
        else -> ""
    }
    return context.getString(R.string.runs_cue_step, context.getString(role), target)
}

/** Localized text for one mid-step coaching cue. Built outside composition, like the others. */
private fun cueText(context: android.content.Context, cue: GuidedCueEngine.Cue): String = context.getString(
    when (cue) {
        GuidedCueEngine.Cue.WarmupTip -> R.string.runs_cue_warmup_tip
        GuidedCueEngine.Cue.WarmupLastMinute -> R.string.runs_cue_warmup_last_minute
        GuidedCueEngine.Cue.CooldownTip -> R.string.runs_cue_cooldown_tip
        GuidedCueEngine.Cue.OneMinuteLeft -> R.string.runs_cue_one_minute_left
        GuidedCueEngine.Cue.MidStep -> R.string.runs_cue_mid_step
        GuidedCueEngine.Cue.LastRep -> R.string.runs_cue_last_rep
        GuidedCueEngine.Cue.Halfway -> R.string.runs_cue_halfway
        GuidedCueEngine.Cue.LastKm -> R.string.runs_cue_last_km
        GuidedCueEngine.Cue.Hydrate -> R.string.runs_cue_hydrate
    }
)

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
    /**
     * Server-synthesized audio for a cue, used only when the device has no voice for the runner's
     * language. Null in previews; the endpoint is entitlement-gated, so a refusal simply means the
     * device voice (or silence) as before.
     */
    fetchCueAudio: (suspend (String, String) -> ByteArray?)? = null,
) {
    // This screen is dark in every theme, so the system bars must be too (DEV-R01).
    ZidRunDarkSurfaceSystemBars()

    val state by RunRecorder.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val locale = currentLocale()

    var confirmFinish by remember { mutableStateOf(false) }
    val guided by GuidedSessionController.state.collectAsStateWithLifecycle()

    // One engine for the life of the screen, shut down on leave so it does not hold audio focus
    // after the run.
    val voice = remember(RunSettings.audioCuesEnabled, fetchCueAudio) {
        if (RunSettings.audioCuesEnabled) RunVoice(context, locale, fetchCueAudio) else null
    }
    // On the way out via Finish the last cue ("Run finished…") is still being spoken; let it end.
    // Every other exit (minimise, discard) cuts immediately as before.
    DisposableEffect(voice) {
        onDispose {
            if (RunRecorder.state.value.status == RecordingStatus.Finished) voice?.releaseWhenQuiet() else voice?.release()
        }
    }

    // The screen stays awake for the life of the recording (Strava parity, P0-1). Set on the host
    // view rather than as a window flag so it is scoped exactly to this screen and released with it;
    // the run itself keeps recording in the service either way.
    val view = LocalView.current
    DisposableEffect(view) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }

    val haptics = LocalHapticFeedback.current

    // Progress cues every N metres (RunSettings.cueInterval): distance, time, and the pace held over
    // the interval that just closed, from the clock rather than route timestamps so a 500 m interval
    // does not need its own split logic. Keyed on the interval index so a recomposition cannot
    // repeat one, and the interval pace comes from the previous mark's elapsed time.
    val cueInterval = remember { RunSettings.cueInterval }
    val intervalIndex = if (cueInterval.meters > 0) (state.distanceMeters / cueInterval.meters).toInt() else 0
    LaunchedEffect(intervalIndex) {
        if (intervalIndex <= 0 || cueInterval.meters <= 0) return@LaunchedEffect
        val elapsed = state.elapsedSeconds
        val mark = ProgressCueTracker.advance(state.clientId, intervalIndex, elapsed) ?: return@LaunchedEffect
        // Only when this mark closes exactly one interval — several marks jumping at once (a GPS
        // catch-up) or a re-entry after a process death would otherwise average across a gap.
        val closesOneInterval = mark.previousIndex == intervalIndex - 1 && mark.secondsSincePrevious > 0
        val intervalPace = if (closesOneInterval) (mark.secondsSincePrevious * 1000.0 / cueInterval.meters).toInt() else null
        voice?.sayCue(progressCue(context, intervalIndex * cueInterval.meters, elapsed, intervalPace, locale))
    }

    // A tick the wrist can feel at every completed kilometre, whether or not cues are on.
    val splitCount = state.splits.size
    LaunchedEffect(splitCount) {
        if (splitCount > 0) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    // Started / paused / resumed are spoken on the transition, never on first composition of an
    // already-running screen (minimise and come back must stay silent). Auto-pauses get a double
    // tick so a runner with music on still notices the clock stopped.
    var lastStatus by remember { mutableStateOf<RecordingStatus?>(null) }
    LaunchedEffect(state.status, state.autoPauseReason) {
        val previous = lastStatus
        lastStatus = state.status
        if (previous == null) return@LaunchedEffect
        when {
            previous == RecordingStatus.Acquiring && state.status == RecordingStatus.Recording ->
                voice?.sayCue(context.getString(R.string.runs_cue_started))
            previous != RecordingStatus.Paused && state.status == RecordingStatus.Paused -> {
                voice?.sayCue(context.getString(R.string.runs_cue_paused))
                if (state.autoPaused) {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                }
            }
            previous == RecordingStatus.Paused && state.status == RecordingStatus.Recording ->
                voice?.sayCue(context.getString(R.string.runs_cue_resumed))
        }
    }

    // The first step — the warm-up — is announced once when the guided run begins. advanceIfDue only
    // fires on a *transition* to the next step, so without this the runner never hears the warm-up
    // (or the cool-down, when it is the step being entered) called out at its start.
    var announcedFirstStep by remember { mutableStateOf(false) }
    LaunchedEffect(guided.session, state.status) {
        if (announcedFirstStep) return@LaunchedEffect
        if (guided.session == null || state.status == RecordingStatus.Idle) return@LaunchedEffect
        guided.currentStep?.let {
            announcedFirstStep = true
            voice?.sayCue(stepCue(context, it))
        }
    }

    // The mid-step coaching commentary (NATGAP-15). One engine for the life of the screen; it
    // latches each cue per step so a condition true for a whole minute is still spoken once.
    val cueEngine = remember { GuidedCueEngine() }
    DisposableEffect(Unit) { onDispose { cueEngine.reset() } }

    // Guided steps advance off the same numbers shown on screen, and each change is spoken once.
    LaunchedEffect(state.elapsedSeconds, state.distanceMeters) {
        val entered = GuidedSessionController.advanceIfDue(state.elapsedSeconds, state.distanceMeters)
        if (entered != null) {
            // The rep just finished, before announcing the one starting — that is the order the
            // runner needs it in, and the speech layer queues rather than interrupts.
            cueEngine.onStepChanged(entered, state.elapsedSeconds)?.let { split ->
                voice?.sayCue(
                    context.getString(R.string.runs_cue_rep_split, ZidRunFormat.duration(split.seconds))
                )
            }
            voice?.sayCue(stepCue(context, entered))
        } else if (guided.isComplete && guided.session != null) {
            voice?.sayCue(context.getString(R.string.runs_cue_done))
        } else {
            // Only while inside a step: on a transition tick the announcements above are enough.
            cueEngine.onTick(
                step = guided.currentStep,
                elapsedSecondsInStep = GuidedSessionController.elapsedInStep(state.elapsedSeconds),
                metersInStep = GuidedSessionController.metersInStep(state.distanceMeters),
                totalElapsedSeconds = state.elapsedSeconds,
            ).forEach { cue -> voice?.sayCue(cueText(context, cue)) }
        }
    }

    // Back leaves the screen, not the run. Recording continues in the service.
    BackHandler(enabled = state.status != RecordingStatus.Finished) { onMinimize() }

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
                        ZidRunFormat.decimal(state.distanceKm, locale),
                        ZidRunFormat.duration(state.elapsedSeconds),
                    ),
                    color = zidRunOnDarkColors().text,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmFinish = false
                    RunRecorder.finish()
                    RunTrackingService.stop(context)
                    val finished = RunRecorder.state.value
                    voice?.sayCue(
                        context.getString(
                            R.string.runs_cue_finished,
                            ZidRunFormat.decimal(finished.distanceKm, locale),
                            ZidRunFormat.duration(finished.elapsedSeconds),
                        )
                    )
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

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(zidRunOnDarkColors().background)
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
                text = ZidRunFormat.decimal(state.distanceKm, locale),
                style = MaterialTheme.typography.displayLarge,
                color = zidRunOnDarkColors().textStrong,
            )
            Spacer(Modifier.width(ZidRunDimens.spaceXs))
            Text(
                text = stringResource(R.string.runs_unit_km),
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
            LiveTile(
                label = stringResource(R.string.runs_avg_pace),
                value = state.averagePaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                tint = zidRunOnDarkColors().accent,
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
            // The fastest completed kilometre reads as the highlight chip. Its accessible name
            // says "fastest" too, so the tinted fill is emphasis rather than the only signal.
            val fastestPace = splits.minOf { it.paceSecondsPerKm }
            val fastestLabel = stringResource(R.string.runs_split_fastest)
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            ) {
                splits.reversed().forEach { split ->
                    val isFastest = split.paceSecondsPerKm == fastestPace && splits.size > 1
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                            .background(if (isFastest) zidRunOnDarkColors().primarySoft else zidRunOnDarkColors().surfaceMuted)
                            .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm)
                            .semantics(mergeDescendants = true) {
                                contentDescription = "km ${split.km} ${ZidRunFormat.pace(split.paceSecondsPerKm)}" +
                                    if (isFastest) ", $fastestLabel" else ""
                            },
                    ) {
                        Text(
                            "${stringResource(R.string.runs_split_km)} ${split.km}",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isFastest) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
                        )
                        Text(
                            ZidRunFormat.pace(split.paceSecondsPerKm),
                            style = MaterialTheme.typography.titleSmall,
                            color = zidRunOnDarkColors().textStrong,
                        )
                    }
                }
            }
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
            MidRunCoachSheet(viewModel = coachViewModel, speak = { text -> voice?.say(text) })
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

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        modifier = Modifier
            .padding(top = ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
    ) {
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
    }
}

@Composable
private fun SmallStat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$label $value" },
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
