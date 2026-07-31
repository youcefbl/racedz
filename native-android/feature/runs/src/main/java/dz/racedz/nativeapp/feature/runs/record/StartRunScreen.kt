package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
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
import kotlinx.coroutines.delay

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
    onBack: () -> Unit,
    onStarted: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var permissionDenied by remember { mutableStateOf(false) }
    var pendingStart by remember { mutableStateOf(false) }

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
            beginRecording(context, onStarted)
        } else {
            permissionDenied = true
        }
        pendingStart = false
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

            Spacer(Modifier.height(ZidRunDimens.spaceLg))

            HoldToBegin(
                onTriggered = {
                    pendingStart = true
                    launcher.launch(permissions)
                },
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

private fun beginRecording(context: android.content.Context, onStarted: () -> Unit) {
    RunRecorder.start()
    RunTrackingService.start(context)
    onStarted()
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
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = 8.dp.toPx()
            val inset = strokePx / 2
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
