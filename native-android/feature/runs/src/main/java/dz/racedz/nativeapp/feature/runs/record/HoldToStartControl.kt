package dz.racedz.nativeapp.feature.runs.record

import android.provider.Settings
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlinx.coroutines.delay

/** How long the runner must hold before recording starts. */
internal const val HOLD_TO_START_MS = 700L

/**
 * The press-and-hold start control: a ring of footprints around a dark core with a warm glow behind
 * it. Holding lights the footprints clockwise from the top over 700 ms and fires at the end; letting
 * go early winds them back. It is the same interaction as before with a different body, and the
 * body is the point.
 *
 * **Everything here is drawn, nothing is decoded.** The previous control stacked five large PNGs
 * (a pre-blurred orange glow, a sole, two 1254 px footprint rings) and revealed the lit ring through
 * a clip path. That looked right on the phone it was tuned on and wrong on others: bitmap
 * downscaling, colour management of a low-alpha blur on a near-black panel and the (non-antialiased)
 * clip edge all vary by GPU and display, and the ~20 MB of decoded pixels made the first frame late
 * on cheaper devices. Strokes, circles and one radial gradient render identically everywhere Compose
 * runs, at every density and size, and cost nothing to load. No `blur`/`RenderEffect` either — those
 * are API 31+ and are exactly the kind of thing that silently degrades across phones.
 *
 * **Animation happens in the draw phase, not in composition.** `progress`, `burst` and the idle
 * phase are read only inside `drawWithCache`/`graphicsLayer` lambdas, so a frame tick invalidates
 * drawing alone. The old control read them in composition and recomposed the whole image stack
 * sixty times a second — the stutter on low-end phones came from that as much as from the bitmaps.
 *
 * **The hold is timed from frames, not from an animation.** Compose animations honour the system's
 * `MotionDurationScale`, so with animations turned off an `animateTo` finishes instantly — and a
 * press-and-hold that completes on contact is not a press-and-hold. `withFrameMillis` keeps the
 * duration real. Reduced motion (the animator scale at 0) removes only the decoration: no breath,
 * no ripple, no burst; the footprints jump to half-lit, then lit.
 *
 * **Completion is latched.** The instant the hold reaches 100% the start is owed: the completion
 * work runs in its own effect keyed on that flag, so lifting the finger — the natural reaction to
 * the confirming haptic — can no longer cancel the coroutine about to call [onTriggered].
 *
 * Holding is not a gesture TalkBack can perform, so the control exposes a plain activate action.
 *
 * Reusable as is: it sizes itself to the width it is given (capped so it never dominates a short
 * screen), so it can sit on the runs overview as well as the pre-run screen.
 */
@Composable
internal fun HoldToStartControl(
    onTriggered: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    val colors = zidRunOnDarkColors()

    var holding by remember { mutableStateOf(false) }
    // 0 → 1 across the hold. Draw-phase only: never read during composition.
    var progress by remember { mutableFloatStateOf(0f) }
    // Latched at 100% (RED-R03): from here the start is owed regardless of the finger.
    var completed by remember { mutableStateOf(false) }
    // 0 → 1 once, on completion: the success ring expanding out of the footprint ring.
    var burst by remember { mutableFloatStateOf(0f) }
    // Idle clock as a 0 → 1 phase of one cycle; 0 while holding or under reduced motion.
    var idle by remember { mutableFloatStateOf(0f) }

    // Respect Android's animation scale for the decorative parts only.
    val animationsEnabled = remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }

    // Idle: a slow breath of the core and one soft ripple per cycle running out to the footprints,
    // so the control reads as waiting for you rather than as a picture. Frame-driven like the hold,
    // on one clock, and switched off the moment a finger lands.
    LaunchedEffect(holding, animationsEnabled, enabled) {
        idle = 0f
        if (holding || !animationsEnabled || !enabled) return@LaunchedEffect
        val start = withFrameMillis { it }
        while (true) {
            withFrameMillis { now -> idle = ((now - start) % IDLE_MS) / IDLE_MS.toFloat() }
        }
    }

    LaunchedEffect(holding) {
        // Once completed, the start is owed regardless of the finger: no wind-back, no restart.
        if (completed) return@LaunchedEffect

        if (!holding) {
            // Wind back rather than snap: an aborted hold should look like it was let go, not like
            // it never happened.
            burst = 0f
            if (!animationsEnabled || progress == 0f) {
                progress = 0f
                return@LaunchedEffect
            }
            val from = progress
            val start = withFrameMillis { it }
            while (progress > 0f) {
                withFrameMillis { now ->
                    progress = (from * (1f - (now - start) / RELEASE_MS)).coerceAtLeast(0f)
                }
            }
            return@LaunchedEffect
        }

        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)

        if (!animationsEnabled) {
            // Reduced motion (R-13): the real 700 ms hold stays as the accidental-start guard, but
            // the footprints do not sweep — a single midway step, then complete.
            progress = 0.5f
            delay(HOLD_TO_START_MS / 2)
            progress = 1f
            delay(HOLD_TO_START_MS / 2)
            completed = true
            return@LaunchedEffect
        }

        // A finger that lands again mid wind-back picks the sweep up where it is instead of
        // snapping to zero. The guard shortens by at most the 220 ms wind-back, which is still a
        // deliberate press.
        val resumeFrom = progress * HOLD_TO_START_MS
        val start = withFrameMillis { it }
        while (progress < 1f) {
            withFrameMillis { now ->
                progress = ((now - start + resumeFrom) / HOLD_TO_START_MS).coerceAtMost(1f)
            }
        }
        completed = true
    }

    // Completion work, uncancellable by the gesture: the confirming haptic, one success burst (or a
    // short beat under reduced motion) so the lit ring is actually seen, then start.
    LaunchedEffect(completed) {
        if (!completed) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        if (animationsEnabled) {
            val start = withFrameMillis { it }
            while (burst < 1f) {
                withFrameMillis { now -> burst = ((now - start) / BURST_MS).coerceAtMost(1f) }
            }
        } else {
            delay(110L)
        }
        onTriggered()
    }

    val startLabel = stringResource(R.string.runs_start_run)

    // Fills the width it is given, square, capped in absolute size and against the screen height so
    // it stays dominant on a tall phone without swallowing a short one. A fixed `size()` is wrong
    // here: on a screen narrower than the cap the width constraint wins and the box comes out
    // taller than wide.
    val screenHeight = LocalConfiguration.current.screenHeightDp.dp
    val maxDiameter = minOf(CONTROL_MAX, screenHeight * 0.42f)

    val primary = colors.primary
    val accent = colors.accent
    val mutedMark = colors.primary.copy(alpha = 0.26f)
    val coreFill = colors.surface

    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .widthIn(max = maxDiameter)
            .fillMaxWidth()
            .aspectRatio(1f)
            // Dimmed and inert while a chosen workout structure is still loading.
            .alpha(if (enabled) 1f else 0.5f)
            // The circle is the touch target too: a clipped layer hit-tests against its shape.
            .clip(CircleShape)
            .drawWithCache {
                // Geometry is a share of the diameter, computed once per size, so the same control
                // draws the same picture at 280dp on a small phone and 320dp on a large one.
                val d = size.minDimension
                val c = Offset(size.width / 2f, size.height / 2f)
                val ringR = d * RING_RADIUS
                val coreR = d * CORE_RADIUS
                val markLen = d * MARK_LENGTH
                val markW = d * MARK_WIDTH
                val heelR = d * HEEL_RADIUS
                val stride = d * MARK_STRIDE
                val glowR = d * GLOW_RADIUS
                val rimW = 2.5.dp.toPx()
                val rimHaloW = 9.dp.toPx()
                val rippleW = 1.5.dp.toPx()
                val burstW = 3.dp.toPx()

                // Footprints: a shoe print each — a rounded sole pad with a separate heel dot behind
                // it — laid along the ring's tangent, toes pointing clockwise (the way the sweep
                // travels), alternating just inside and outside the ring like left and right feet.
                // A walking trail, not a dashed circle. Clockwise from the top.
                val marks = List(MARK_COUNT) { i ->
                    val a = (-90.0 + i * 360.0 / MARK_COUNT) * PI / 180.0
                    val r = ringR + if (i % 2 == 0) stride else -stride
                    val cx = c.x + (r * cos(a)).toFloat()
                    val cy = c.y + (r * sin(a)).toFloat()
                    // Unit tangent, clockwise.
                    val tx = (-sin(a)).toFloat()
                    val ty = cos(a).toFloat()
                    fun along(u: Float) = Offset(cx + tx * markLen * u, cy + ty * markLen * u)
                    Footprint(
                        padStart = along(PAD_START),
                        padEnd = along(PAD_END),
                        heel = along(HEEL_AT),
                    )
                }

                onDrawBehind {
                    val p = progress
                    val b = burst
                    val t = idle
                    val breath = sin(t * 2f * PI.toFloat())
                    val core = coreScale(p, t)

                    // 1. Warm ambient glow behind the core: brightens and swells with the hold, and
                    //    breathes faintly at rest. Low alpha and a quick falloff keep it from
                    //    banding on cheaper panels.
                    //    The core disc is opaque and covers the gradient's centre, so the bright
                    //    part is held flat out to the disc's edge and the falloff happens in the
                    //    band between the core and the footprints — where it can be seen.
                    val glowA = 0.34f + 0.40f * p + 0.04f * breath
                    val glowScale = 0.94f + 0.10f * p + 0.02f * breath
                    val glowRadius = glowR * glowScale
                    drawCircle(
                        brush = Brush.radialGradient(
                            0.00f to accent.copy(alpha = glowA),
                            0.58f to accent.copy(alpha = glowA),
                            0.72f to accent.copy(alpha = glowA * 0.55f),
                            0.86f to accent.copy(alpha = glowA * 0.18f),
                            1.00f to accent.copy(alpha = 0f),
                            center = c,
                            radius = glowRadius,
                        ),
                        radius = glowRadius,
                        center = c,
                    )

                    // 2. Idle ripple: one ring per cycle, from the core rim out to the footprints,
                    //    fading as it goes. Only while nobody is holding.
                    if (t > 0f && p == 0f && t < RIPPLE_SHARE) {
                        val k = t / RIPPLE_SHARE
                        val eased = 1f - (1f - k) * (1f - k)
                        drawCircle(
                            color = primary.copy(alpha = 0.32f * (1f - k)),
                            radius = coreR + (ringR - coreR - markW) * eased,
                            center = c,
                            style = Stroke(rippleW),
                        )
                    }

                    // 3. The footprints: muted at rest, each lighting to solid lime (with a soft
                    //    halo) as the sweep reaches it — footprint by footprint, which reads under
                    //    reduced motion and colour blindness alike because weight changes with hue.
                    marks.forEachIndexed { i, mark ->
                        val lit = (p * MARK_COUNT - i).coerceIn(0f, 1f)
                        if (lit > 0f) {
                            val halo = primary.copy(alpha = 0.26f * lit)
                            drawLine(
                                color = halo,
                                start = mark.padStart,
                                end = mark.padEnd,
                                strokeWidth = markW * 2.2f,
                                cap = StrokeCap.Round,
                            )
                            drawCircle(color = halo, radius = heelR + markW * 0.6f, center = mark.heel)
                        }
                        val color = lerp(mutedMark, primary, lit)
                        val weight = 1f + 0.2f * lit
                        drawLine(
                            color = color,
                            start = mark.padStart,
                            end = mark.padEnd,
                            strokeWidth = markW * weight,
                            cap = StrokeCap.Round,
                        )
                        drawCircle(color = color, radius = heelR * weight, center = mark.heel)
                    }

                    // 4. The core: a dark disc with a lit rim, sinking on touch and growing back as
                    //    the hold completes. The label sits on it (drawn by the composable below).
                    val rimFlash = if (b > 0f) 0.4f * (1f - b) else 0f
                    scale(scale = core, pivot = c) {
                        drawCircle(
                            color = primary.copy(alpha = 0.10f + 0.22f * p + rimFlash),
                            radius = coreR + rimHaloW / 2f,
                            center = c,
                            style = Stroke(rimHaloW),
                        )
                        drawCircle(color = coreFill, radius = coreR, center = c)
                        drawCircle(
                            color = primary.copy(alpha = 0.72f + 0.28f * p),
                            radius = coreR,
                            center = c,
                            style = Stroke(rimW),
                        )
                    }

                    // 5. Completion burst: one ring leaving the footprints outward and fading — a
                    //    single flash, never a loop.
                    if (b > 0f) {
                        drawCircle(
                            color = primary.copy(alpha = 0.85f * (1f - b)),
                            radius = ringR * (1f + 0.09f * b),
                            center = c,
                            style = Stroke(burstW),
                        )
                    }
                }
            }
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
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
            // One node for accessibility: "Start run, button" and an activate action, without the
            // label underneath being read a second time.
            .clearAndSetSemantics {
                contentDescription = startLabel
                role = Role.Button
                if (enabled) onClick(label = startLabel) { onTriggered(); true } else disabled()
            },
    ) {
        // The label rides the core: same scale as the drawn disc, read from the same state in the
        // layer lambda so it never recomposes. Width-limited to the disc so the longest translation
        // ("Maintenez / pour démarrer") stays on it at any font scale.
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .widthIn(max = maxWidth * LABEL_WIDTH)
                .graphicsLayer {
                    val s = coreScale(progress, idle)
                    scaleX = s
                    scaleY = s
                },
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.DirectionsRun,
                contentDescription = null,
                tint = colors.primary,
                modifier = Modifier.size(30.dp),
            )
            Text(
                text = stringResource(R.string.runs_hold),
                style = MaterialTheme.typography.titleLarge,
                color = colors.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = ZidRunDimens.spaceXs),
            )
            Text(
                text = stringResource(R.string.runs_hold_to_begin),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.text,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * The core's scale for a given hold progress and idle phase: a shallow breath at rest, a quick
 * sink as the finger lands (over the first ~120 ms of the hold, so it is continuous with the
 * breath rather than a jump), growing back past rest by completion.
 */
private fun coreScale(progress: Float, idle: Float): Float {
    val breath = sin(idle * 2f * PI.toFloat()) * BREATH_DEPTH
    val press = (progress * 6f).coerceAtMost(1f)
    return 1f + breath - 0.03f * press + 0.05f * progress
}

/** The control's largest diameter — dominant on a phone screen, as in the reference. */
private val CONTROL_MAX = 320.dp

/** One shoe print on the ring: the sole pad as a rounded stroke, the heel as a dot behind it. */
private class Footprint(val padStart: Offset, val padEnd: Offset, val heel: Offset)

/** Shares of the diameter, so every size draws the same picture. */
private const val RING_RADIUS = 0.445f
private const val CORE_RADIUS = 0.285f
private const val GLOW_RADIUS = 0.44f
private const val MARK_COUNT = 24
/** A print's overall length, and where its parts sit along it (−0.5 heel end … +0.5 toe end). */
private const val MARK_LENGTH = 0.06f
private const val MARK_WIDTH = 0.022f
private const val HEEL_RADIUS = 0.0095f
private const val PAD_START = -0.07f
private const val PAD_END = 0.5f
private const val HEEL_AT = -0.5f
private const val MARK_STRIDE = 0.014f
private const val LABEL_WIDTH = 0.48f

/** How long an aborted hold takes to wind back to nothing. */
private const val RELEASE_MS = 220f

/** One success burst on completion — a single flash, never a loop (UI_RULES §7). */
private const val BURST_MS = 300f

/** One idle cycle: a breath of the core, with a ripple in its first part. Slow enough to read as waiting. */
private const val IDLE_MS = 3_400L
private const val RIPPLE_SHARE = 0.42f
private const val BREATH_DEPTH = 0.012f
