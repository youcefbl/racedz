package dz.racedz.nativeapp.feature.runs.record

import android.media.AudioManager
import android.media.ToneGenerator
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import kotlinx.coroutines.delay

/**
 * The optional 3-2-1 before a run starts (NATRUN-06.7, owner decision 6).
 *
 * Shown after the hold completed and permissions are granted, and before anything else happens:
 * no recorder, no service, no cue, no clock — [onFinished] fires at zero and the caller starts the
 * run then. Cancel, Back, or the app leaving the foreground call [onCancelled] instead and the
 * start screen is where the runner lands, with nothing recorded. The screen stays awake for the
 * three seconds; a short tone per second follows the audio-cue choice, a haptic tick always; the
 * ring animation is skipped under the system's "remove animations" setting.
 */
@Composable
fun CountdownOverlay(
    seconds: Int = 3,
    audioCues: Boolean,
    onFinished: () -> Unit,
    onCancelled: () -> Unit,
) {
    val colors = zidRunOnDarkColors()
    val context = LocalContext.current
    val locale = currentLocale()
    val haptics = LocalHapticFeedback.current
    var remaining by remember { mutableIntStateOf(seconds) }
    val reducedMotion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }

    // Awake for the countdown; released with the overlay.
    val view = LocalView.current
    DisposableEffect(view) {
        val before = view.keepScreenOn
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = before }
    }

    // Leaving the foreground cancels: a countdown that fires while the runner is on the lock screen
    // would start a run they did not see start.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_PAUSE) onCancelled() }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    BackHandler { onCancelled() }

    // The per-second ring sweep, restarted for each number; skipped under reduced motion.
    val sweep = remember { Animatable(1f) }
    val tone = remember { if (audioCues) runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 70) }.getOrNull() else null }
    DisposableEffect(tone) { onDispose { tone?.release() } }

    LaunchedEffect(Unit) {
        for (n in seconds downTo 1) {
            remaining = n
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
            if (reducedMotion) {
                delay(1_000)
            } else {
                sweep.snapTo(1f)
                sweep.animateTo(0f, tween(1_000, easing = LinearEasing))
            }
        }
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
        onFinished()
    }

    val number = ZidRunFormat.count(remaining, locale)
    val ringA11y = stringResource(R.string.runs_countdown_starting_in) + " " + number
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                stringResource(R.string.runs_countdown_starting_in),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )
            Box(
                modifier = Modifier
                    .size(180.dp)
                    .semantics { contentDescription = ringA11y; liveRegion = LiveRegionMode.Polite },
                contentAlignment = Alignment.Center,
            ) {
                val ring = colors.border
                val fill = colors.primary
                Canvas(Modifier.fillMaxSize()) {
                    val stroke = 6.dp.toPx()
                    val inset = stroke / 2
                    val arcSize = Size(size.width - stroke, size.height - stroke)
                    drawArc(ring, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
                    val fraction = if (reducedMotion) 1f else sweep.value
                    drawArc(fill, -90f, 360f * fraction, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
                }
                Text(number, style = MaterialTheme.typography.displayLarge, color = colors.textStrong)
            }
            Text(
                stringResource(R.string.runs_countdown_nothing_recorded),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
        // Pinned to the always-dark palette like every control on the record screens; the shared
        // outlined button follows the app theme and would be a white slab here in Light mode.
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceXl)
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                .border(1.dp, colors.borderStrong, RoundedCornerShape(ZidRunDimens.cornerPill))
                .clickable(role = Role.Button, onClick = onCancelled),
            contentAlignment = Alignment.Center,
        ) {
            Text(stringResource(R.string.common_cancel), style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
        }
    }
}
