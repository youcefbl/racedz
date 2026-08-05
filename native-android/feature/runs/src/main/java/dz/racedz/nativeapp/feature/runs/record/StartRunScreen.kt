package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.feature.runs.R as RunsR
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.Offset
import androidx.compose.runtime.withFrameMillis
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.Canvas
import kotlin.math.sin
import kotlin.math.PI

/** How long the runner must hold before recording starts. */
private const val HOLD_TO_BEGIN_MS = 700L

/**
 * "Ready when you are" (02-create-new-run.png): the pre-run screen.
 *
 * Always dark, whatever the app theme: this is the screen before a run and the one the runner
 * glances at outdoors, and the mockup treats it as a single dark surface.
 *
 * Starting is a press-and-hold rather than a tap. A run started by accident in a pocket is worse
 * than one that takes an extra second to start, and the mockup asks for it. TalkBack users get an
 * ordinary activate action instead, since holding is not a gesture a screen reader exposes.
 */
@Composable
fun StartRunScreen(
    viewModel: StartRunViewModel,
    onBack: () -> Unit,
    onStarted: () -> Unit,
    modifier: Modifier = Modifier,
    /**
     * The planned session the runner tapped "Log this run" on, if they came from the coach's plan.
     * It is handed straight to the recorder so the saved run links back to that session.
     */
    workoutId: String? = null,
) {
    val context = LocalContext.current
    val session by viewModel.state.collectAsStateWithLifecycle()
    var permissionDenied by remember { mutableStateOf(false) }
    var mode by rememberSaveable { mutableStateOf(RunMode.Free) }
    var audioCues by rememberSaveable { mutableStateOf(true) }

    // Notifications are requested alongside location: the foreground service needs a visible
    // notification, and without the permission the runner sees no indication that GPS is on.
    val permissions = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        // Coarse-only is not enough to measure a route, so precise is the one that decides.
        val precise = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (precise) {
            permissionDenied = false
            beginRecording(context, mode, audioCues, session.session, workoutId, onStarted)
        } else {
            permissionDenied = true
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ZidRunDarkColors.background)
            .navigationBarsPadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onBack)

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                text = stringResource(R.string.runs_ready_title),
                style = MaterialTheme.typography.displaySmall,
                color = ZidRunDarkColors.textStrong,
                textAlign = TextAlign.Center,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg)) {
                ReadyChip(
                    icon = Icons.Filled.LocationOn,
                    label = stringResource(R.string.runs_ready_gps),
                    tint = ZidRunDarkColors.primary,
                )
                ReadyChip(
                    icon = Icons.Filled.Lock,
                    label = stringResource(R.string.runs_private),
                    tint = ZidRunDarkColors.textMuted,
                )
            }

            // Free or guided. A guided run counts through warm-up, work, and cool-down and speaks
            // each change; a free run just records.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .background(ZidRunDarkColors.surface),
            ) {
                ModeTab(
                    label = stringResource(R.string.runs_mode_free),
                    selected = mode == RunMode.Free,
                    onClick = { mode = RunMode.Free },
                    modifier = Modifier.weight(1f),
                )
                ModeTab(
                    label = stringResource(R.string.runs_mode_guided),
                    selected = mode == RunMode.Guided,
                    onClick = { mode = RunMode.Guided },
                    modifier = Modifier.weight(1f),
                )
            }

            if (mode == RunMode.Guided) {
                GuidedPlanCard(session = session)
            }

            // Cues are the reason to look at the phone less, so they default on.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .background(ZidRunDarkColors.surface)
                    .clickable(role = Role.Switch) { audioCues = !audioCues }
                    .padding(ZidRunDimens.spaceMd)
                    .semantics(mergeDescendants = true) { },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (audioCues) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                    contentDescription = null,
                    tint = if (audioCues) ZidRunDarkColors.primary else ZidRunDarkColors.textMuted,
                )
                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                Text(
                    text = stringResource(R.string.runs_audio_cues),
                    style = MaterialTheme.typography.titleSmall,
                    color = ZidRunDarkColors.textStrong,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = audioCues,
                    onCheckedChange = { audioCues = it },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = ZidRunDarkColors.onPrimary,
                        checkedTrackColor = ZidRunDarkColors.primary,
                    ),
                )
            }

            HoldToBegin(
                onTriggered = { launcher.launch(permissions) },
            )

            if (permissionDenied) {
                Text(
                    text = stringResource(R.string.runs_permission_denied),
                    style = MaterialTheme.typography.bodyMedium,
                    color = ZidRunDarkColors.danger,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                )
                ZidRunButton(
                    text = stringResource(R.string.runs_grant_permission),
                    onClick = { launcher.launch(permissions) },
                )
            }
        }
    }
}

private fun beginRecording(
    context: android.content.Context,
    mode: RunMode,
    audioCues: Boolean,
    session: dz.racedz.nativeapp.core.network.GuidedSessionDto?,
    workoutId: String?,
    onStarted: () -> Unit,
) {
    // An explicit workout from the plan wins over the guided session's own id: the runner said
    // which session they are running, and the guided card is only a suggestion of one.
    if (!RunRecorder.start(workoutId ?: session?.workoutId?.takeIf { mode == RunMode.Guided })) {
        // A recording already exists (this screen was reached by deep link or a stale back stack).
        // Do not touch the live run's settings or restart the service — just land on it.
        onStarted()
        return
    }
    // A guided run with no session (offline when the screen opened) records as a free one rather
    // than refusing to start — the run matters more than the guidance.
    GuidedSessionController.start(if (mode == RunMode.Guided) session else null)
    RunSettings.audioCuesEnabled = audioCues
    RunTrackingService.start(context)
    onStarted()
}

@Composable
private fun ModeTab(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(if (selected) ZidRunDarkColors.primary else Color.Transparent)
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .padding(vertical = ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) ZidRunDarkColors.onPrimary else ZidRunDarkColors.textMuted,
        )
    }
}

/** What the guided session will ask for, so the runner knows before they commit to it. */
@Composable
private fun GuidedPlanCard(session: StartRunUiState) {
    val steps = session.session?.steps.orEmpty()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(ZidRunDarkColors.surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Text(
            text = session.session?.title ?: stringResource(R.string.runs_mode_guided),
            style = MaterialTheme.typography.titleSmall,
            color = ZidRunDarkColors.textStrong,
        )
        when {
            session.loading -> Text(
                stringResource(R.string.common_loading),
                style = MaterialTheme.typography.bodySmall,
                color = ZidRunDarkColors.textMuted,
            )
            steps.isEmpty() -> Text(
                stringResource(R.string.runs_guided_unavailable),
                style = MaterialTheme.typography.bodySmall,
                color = ZidRunDarkColors.textMuted,
            )
            else -> steps.take(4).forEach { step ->
                Text(
                    text = "${stepRoleLabel(step.role)} · ${stepTargetLabel(step)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = ZidRunDarkColors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun ReadyChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: androidx.compose.ui.graphics.Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
        modifier = Modifier.semantics(mergeDescendants = true) { },
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = tint)
    }
}

/**
 * The hold target. Sweeps a ring while held and fires at the end; letting go early winds it back.
 *
 * Two things here are deliberate and easy to "fix" wrongly.
 *
 * **The hold is timed from frames, not from an animation.** Compose animations honour the system's
 * `MotionDurationScale`, so on a device with animations turned off `animateTo` finishes instantly —
 * and a press-and-hold that completes on contact is not a press-and-hold. `withFrameMillis` gives
 * the same per-frame smoothness while keeping the duration real. Reduced motion removes the
 * decoration (the idle breath, the wind-back) and leaves the interaction intact.
 *
 * **The label sits in its own clear space.** The exported artwork is a narrow foot, and text laid
 * across the whole 240dp control ran straight through the stroke — "Hold" over the foot, "to begin"
 * overflowing both edges. It is width-limited to the ring's inner circle and backed by a scrim, so
 * it reads at any font scale without needing the artwork redrawn.
 */
@Composable
private fun HoldToBegin(onTriggered: () -> Unit) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    var holding by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    // Latched the instant the hold reaches 100% (RED-R03). From that moment the start is owed:
    // the completion work runs in its own effect keyed on this flag, so releasing the finger —
    // which is the natural reaction to the confirming haptic — can no longer cancel the
    // coroutine that was about to call onTriggered().
    var completed by remember { mutableStateOf(false) }
    // 0 → 1 once the hold completes: one expanding, fading ring. Reduced motion skips it.
    var aura by remember { mutableFloatStateOf(0f) }

    // Respect Android's animation scale for the decorative parts only.
    val animationsEnabled = remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }

    // A slow breath while idle, so the control reads as waiting for you rather than as a picture.
    // Driven from frames like the hold itself, for the same reason: it must not be at the mercy of
    // the animation-duration scale, and it costs nothing to keep the two on one clock.
    var idleScale by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(holding, animationsEnabled) {
        if (holding || !animationsEnabled) {
            idleScale = 1f
            return@LaunchedEffect
        }
        val start = withFrameMillis { it }
        while (true) {
            withFrameMillis { now ->
                val phase = ((now - start) % BREATH_MS) / BREATH_MS.toFloat()
                idleScale = 1f + BREATH_DEPTH * sin(phase * 2f * PI.toFloat())
            }
        }
    }

    // Pressing sinks the control slightly and it grows back as the hold completes — the shape of
    // the gesture, rather than a second independent effect.
    val holdScale by animateFloatAsState(
        targetValue = if (holding) 0.97f + progress * 0.05f else 1f,
        animationSpec = tween(durationMillis = 120, easing = LinearEasing),
        label = "holdScale",
    )
    val appliedScale = if (!animationsEnabled) 1f else if (holding) holdScale else idleScale

    val holdLabel = stringResource(R.string.runs_hold_to_begin)
    val startLabel = stringResource(R.string.runs_start_run)

    LaunchedEffect(holding) {
        // Once completed, the start is owed regardless of the finger: no wind-back, no restart.
        if (completed) return@LaunchedEffect

        if (!holding) {
            // Wind back rather than snap: an aborted hold should look like it was let go, not like
            // it never happened. Any partial decoration is cleared with it.
            aura = 0f
            if (!animationsEnabled || progress == 0f) {
                progress = 0f
                return@LaunchedEffect
            }
            val from = progress
            val start = withFrameMillis { it }
            while (progress > 0f) {
                withFrameMillis { now ->
                    val t = (now - start).toFloat() / RELEASE_MS
                    progress = (from * (1f - t)).coerceAtLeast(0f)
                }
            }
            return@LaunchedEffect
        }

        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        val start = withFrameMillis { it }
        while (progress < 1f) {
            withFrameMillis { now ->
                progress = ((now - start).toFloat() / HOLD_TO_BEGIN_MS).coerceAtMost(1f)
            }
        }
        completed = true
    }

    // Completion work, uncancellable by the gesture: the confirming haptic, one success pulse
    // (or a short beat under reduced motion) so the completed ring is actually seen, then start.
    LaunchedEffect(completed) {
        if (!completed) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        if (animationsEnabled) {
            val auraStart = withFrameMillis { it }
            while (aura < 1f) {
                withFrameMillis { now ->
                    aura = ((now - auraStart).toFloat() / AURA_MS).coerceAtMost(1f)
                }
            }
        } else {
            delay(110L)
        }
        onTriggered()
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(240.dp)
            .graphicsLayer { scaleX = appliedScale; scaleY = appliedScale }
            .clip(CircleShape)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        holding = true
                        // Returns when the finger lifts or the gesture is cancelled, which is what
                        // makes "let go to abort" work.
                        tryAwaitRelease()
                        holding = false
                    },
                )
            }
            // Holding is not a gesture TalkBack can perform, so it gets a plain activate action.
            .semantics {
                contentDescription = startLabel
                role = Role.Button
                onClick(label = startLabel) { onTriggered(); true }
            },
    ) {
        // These layers are exported from the approved ready/progress/complete mockups. Keeping
        // them as images preserves the intended foot shape and footprint rhythm on small screens.
        Image(
            painter = painterResource(RunsR.drawable.zidrun_run_orange_glow),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(10.dp).alpha(0.28f + progress * 0.72f),
        )
        Image(
            painter = painterResource(RunsR.drawable.zidrun_run_footprints_ring),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(2.dp).alpha(0.72f),
        )
        Image(
            painter = painterResource(RunsR.drawable.zidrun_run_footprints_ring_active),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(2.dp).alpha(progress),
        )

        // A sweep on top of the crossfade. Opacity alone says "something is happening"; a hand
        // going round says how much longer to hold, which is the only question at this moment.
        val sweepColor = ZidRunDarkColors.primary
        // Inset to sit on the footprint circle rather than on the edge of the control's box: the
        // exported artwork carries its own margin, so a flush arc reads as an unrelated second ring.
        Canvas(modifier = Modifier.fillMaxSize().padding(SWEEP_INSET)) {
            if (progress <= 0f) return@Canvas
            val stroke = 5.dp.toPx()
            val inset = stroke / 2
            drawArc(
                color = sweepColor,
                startAngle = -90f,
                sweepAngle = 360f * progress,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = Size(size.width - stroke, size.height - stroke),
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }

        // The success aura: a single ring that expands from the sweep's radius toward the
        // control's edge while fading. Drawn full-size (unpadded) so it has room to grow.
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (aura <= 0f) return@Canvas
            val stroke = 3.dp.toPx()
            val margin = SWEEP_INSET.toPx()
            val expand = aura * (margin - stroke)
            val inset = margin - expand
            drawArc(
                color = sweepColor.copy(alpha = (1f - aura) * 0.85f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = Size(size.width - inset * 2, size.height - inset * 2),
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }

        Image(
            painter = painterResource(RunsR.drawable.zidrun_run_foot),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .height(198.dp)
                .width(99.dp)
                .align(Alignment.Center)
                .alpha(0.94f + progress * 0.06f),
        )

        // The label's own clear space: a scrim wide enough for the longest translation ("Maintenez
        // / pour commencer") and no wider than the ring's inner circle.
        Box(
            modifier = Modifier
                .widthIn(max = 136.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                // Opaque enough to hold up against the glow at full brightness, which is exactly
                // when the label matters most — a 60% scrim washed out at the end of the hold.
                .background(ZidRunDarkColors.background.copy(alpha = 0.88f))
                .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stringResource(R.string.runs_hold),
                    style = MaterialTheme.typography.titleLarge,
                    color = ZidRunDarkColors.primary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = holdLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    color = ZidRunDarkColors.text,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** Where the progress sweep sits, measured against the exported ring inside the 240dp control. */
private val SWEEP_INSET = 26.dp

/** How long an aborted hold takes to wind back to nothing. */
private const val RELEASE_MS = 220f

/** One success pulse on completion — a single flash, never a loop (UI_RULES §7). */
private const val AURA_MS = 300f

/** One full idle breath, and how far it travels. Slow and shallow enough to read as waiting. */
private const val BREATH_MS = 3_400L
private const val BREATH_DEPTH = 0.015f
