package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

/** Footprints in the ring around the hold target. */
private const val FOOTPRINT_COUNT = 24

/** How long the runner must hold before recording starts. */
private const val HOLD_TO_BEGIN_MS = 1_200L

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
            beginRecording(context, mode, audioCues, session.session, onStarted)
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
                .fillMaxSize()
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
    onStarted: () -> Unit,
) {
    RunRecorder.start()
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
 * The hold target. Fills a ring while held and fires at the end; letting go early cancels.
 */
@Composable
private fun HoldToBegin(onTriggered: () -> Unit) {
    var holding by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }
    val animated by animateFloatAsState(targetValue = progress, label = "hold")
    val holdLabel = stringResource(R.string.runs_hold_to_begin)
    val startLabel = stringResource(R.string.runs_start_run)

    LaunchedEffect(holding) {
        if (!holding) {
            progress = 0f
            return@LaunchedEffect
        }
        val step = 50L
        var elapsed = 0L
        while (elapsed < HOLD_TO_BEGIN_MS && holding) {
            delay(step)
            elapsed += step
            progress = (elapsed.toFloat() / HOLD_TO_BEGIN_MS).coerceAtMost(1f)
        }
        if (holding) {
            holding = false
            onTriggered()
        }
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(240.dp)
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
        // Footprints stepping round the ring, one lighting up at a time — the mockup's motif, and a
        // cue that the screen is alive while the runner waits for GPS.
        val transition = rememberInfiniteTransition(label = "footsteps")
        val phase by transition.animateFloat(
            initialValue = 0f,
            targetValue = FOOTPRINT_COUNT.toFloat(),
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 2600, easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "phase",
        )

        Canvas(modifier = Modifier.fillMaxSize()) {
            val centre = Offset(size.width / 2, size.height / 2)
            // Outside the progress arc, as in the mockup — drawn at the same radius the arc got
            // buried under it.
            val footRadius = size.minDimension / 2 - 5.dp.toPx()
            repeat(FOOTPRINT_COUNT) { i ->
                val angle = (i.toFloat() / FOOTPRINT_COUNT) * 2 * Math.PI - Math.PI / 2
                val x = centre.x + (footRadius * kotlin.math.cos(angle)).toFloat()
                val y = centre.y + (footRadius * kotlin.math.sin(angle)).toFloat()
                // Distance from the travelling head, wrapped, so the trail fades behind it.
                val delta = ((i - phase + FOOTPRINT_COUNT) % FOOTPRINT_COUNT)
                val alpha = (1f - delta / 5f).coerceIn(0.12f, 1f)
                // Left/right stagger, so it reads as steps rather than dots on a circle.
                val offset = if (i % 2 == 0) 3.dp.toPx() else -3.dp.toPx()
                drawCircle(
                    color = ZidRunDarkColors.primary.copy(alpha = alpha),
                    radius = 3.5.dp.toPx(),
                    center = Offset(
                        x + (offset * kotlin.math.cos(angle + Math.PI / 2)).toFloat(),
                        y + (offset * kotlin.math.sin(angle + Math.PI / 2)).toFloat(),
                    ),
                )
            }

            val strokePx = 8.dp.toPx()
            // Inset past the footprint ring so the two do not overlap.
            val inset = strokePx / 2 + 18.dp.toPx()
            val arcSize = androidx.compose.ui.geometry.Size(size.width - strokePx, size.height - strokePx)
            drawArc(
                color = ZidRunDarkColors.border,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
            )
            if (animated > 0f) {
                drawArc(
                    color = ZidRunDarkColors.primary,
                    startAngle = -90f,
                    sweepAngle = 360f * animated,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = arcSize,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = stringResource(R.string.runs_hold),
                style = MaterialTheme.typography.displaySmall,
                color = ZidRunDarkColors.primary,
            )
            Text(
                text = holdLabel,
                style = MaterialTheme.typography.bodyLarge,
                color = ZidRunDarkColors.textMuted,
            )
        }
    }
}
