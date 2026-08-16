package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors

/**
 * The touch guard overlay (NATRUN-07.7, placement approved 2026-08-16): sits over the live screen,
 * eats every pointer event, dims nothing that matters, and offers one way out — a hold on the
 * pill in the thumb zone. TalkBack gets a plain activate action, so switch and voice access can
 * unlock without a timed press. System Back is not intercepted here (it still minimises), and
 * the notification's Pause/Resume keep working — reaching the shade is a deliberate act.
 */
@Composable
fun TouchGuardOverlay(onUnlock: () -> Unit) {
    val colors = zidRunOnDarkColors()
    val haptics = LocalHapticFeedback.current
    var holding by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var completed by remember { mutableStateOf(false) }

    LaunchedEffect(holding) {
        if (completed) return@LaunchedEffect
        if (!holding) { progress = 0f; return@LaunchedEffect }
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        val start = withFrameMillis { it }
        while (holding && !completed) {
            withFrameMillis { now ->
                progress = ((now - start) / HOLD_TO_UNLOCK_MS.toFloat()).coerceIn(0f, 1f)
                if (progress >= 1f) completed = true
            }
        }
    }
    LaunchedEffect(completed) {
        if (!completed) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        onUnlock()
    }

    val locked = stringResource(R.string.runs_screen_locked)
    val unlock = stringResource(R.string.runs_unlock_screen)
    Box(
        modifier = Modifier
            .fillMaxSize()
            // Everything under the overlay is inert: consume every event before it reaches a control.
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) awaitPointerEvent().changes.forEach { it.consume() }
                }
            }
            .background(colors.background.copy(alpha = 0.35f))
            .semantics { contentDescription = locked; liveRegion = LiveRegionMode.Polite },
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceLg),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                    .background(colors.surfaceMuted)
                    .pointerInput(Unit) {
                        // Consumption-agnostic on purpose: the overlay around this pill consumes
                        // every event so nothing underneath reacts, and a tap-gesture detector
                        // would read that consumption as a cancel. Down → hold; any release → stop.
                        awaitEachGesture {
                            awaitFirstDown(requireUnconsumed = false)
                            holding = true
                            var pressed = true
                            while (pressed) {
                                val event = awaitPointerEvent()
                                pressed = event.changes.any { it.pressed }
                            }
                            holding = false
                        }
                    }
                    .semantics {
                        role = Role.Button
                        contentDescription = unlock
                        onClick { onUnlock(); true }
                    },
                contentAlignment = Alignment.CenterStart,
            ) {
                // The fill grows with the hold; released early it winds straight back.
                Box(
                    Modifier
                        .fillMaxWidth(progress)
                        .heightIn(min = 64.dp)
                        .background(colors.primary.copy(alpha = 0.35f)),
                )
                Box(Modifier.fillMaxWidth().heightIn(min = 64.dp), contentAlignment = Alignment.Center) {
                    androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.LockOpen, contentDescription = null, tint = colors.textStrong)
                        androidx.compose.foundation.layout.Spacer(Modifier.padding(horizontal = ZidRunDimens.spaceXs))
                        Text(
                            stringResource(R.string.runs_hold_to_unlock),
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.textStrong,
                        )
                    }
                }
            }
        }
    }
}

private const val HOLD_TO_UNLOCK_MS = 700L
