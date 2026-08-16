package dz.racedz.nativeapp.feature.runs.record

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.TwoWayConverter
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import dz.racedz.nativeapp.core.network.RoutePointDto
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.atan
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.tan

/**
 * The live map for the recording screen (NATRUN-06.4): follows the runner, shows where they are and
 * which way they are going, and lets them look around without losing the follow.
 *
 * Same tile source, projection and attribution as [dz.racedz.nativeapp.feature.runs.RunMap], but a
 * camera instead of a fixed frame:
 *
 *  - **Follow** keeps the newest fix centred at street zoom; the camera glides there over ~1 s so a
 *    1 Hz fix does not make the map hop (instant when the device asks for reduced motion).
 *  - **A pan** hands the camera to the runner; the marker keeps moving live and a 44 dp recenter
 *    control appears. Tapping it resumes following. Pinch steps the zoom one level at a time.
 *  - **The marker** is a ring at the newest fix, with a heading arrow only while
 *    [headingDegrees] is non-null — the recorder blanks it below walking speed, so a stopped
 *    runner never sees an arrow pointing nowhere.
 *
 * Cost per fix: the tile grid is keyed on integer tile indexes and re-laid only when the camera
 * crosses a tile boundary; the sub-tile motion is a `graphicsLayer` translation and the route/marker
 * are Canvas draws, so an ordinary fix is a redraw, not a recomposition of the tile grid.
 *
 * Geometry is never mirrored in RTL: `absoluteOffset` and Canvas coordinates ignore layout
 * direction, only the recenter control and attribution follow the reading direction.
 */
@Composable
fun LiveRunMap(
    route: List<RoutePointDto>,
    headingDegrees: Float?,
    modifier: Modifier = Modifier,
    camera: LiveMapCameraState = rememberLiveMapCamera(),
) {
    val colors = zidRunOnDarkColors()
    if (route.isEmpty()) return
    val current = route.last()
    val context = LocalContext.current
    // Reduced motion: honour the system animator scale the way the hold control does — an animation
    // that never plays under "remove animations" is the honest one there, and here.
    val reducedMotion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }

    // Two animated points: where the marker is drawn, and where the camera looks. Doubles, because
    // a Float latitude is only good to ~0.4 m and world pixels at zoom 16 overflow Float precision.
    val markerLat = remember { Animatable(current.lat, DoubleConverter) }
    val markerLng = remember { Animatable(current.lng, DoubleConverter) }
    LaunchedEffect(current.lat, current.lng, reducedMotion) {
        if (reducedMotion) {
            markerLat.snapTo(current.lat)
            markerLng.snapTo(current.lng)
        } else {
            // Both launched in this scope run concurrently: the marker moves in a straight line.
            coroutineScope {
                launch { markerLat.animateTo(current.lat, tween(GLIDE_MS, easing = LinearEasing)) }
                launch { markerLng.animateTo(current.lng, tween(GLIDE_MS, easing = LinearEasing)) }
            }
        }
    }
    // The camera: while following it *is* the marker's animated position; when free, it is what the
    // runner dragged to (snapped, no glide — a drag must feel attached to the finger). Read through
    // functions, not captured values, so the per-frame reads below happen in the layer/draw phases.
    fun cameraLat(): Double = if (camera.following) markerLat.value else camera.freeLat
    fun cameraLng(): Double = if (camera.following) markerLng.value else camera.freeLng

    BoxWithConstraints(modifier = modifier.background(colors.surfaceMuted).clipToBounds()) {
        val density = LocalDensity.current
        val widthPx = with(density) { maxWidth.toPx() }
        val heightPx = with(density) { maxHeight.toPx() }
        if (widthPx < 1f || heightPx < 1f) return@BoxWithConstraints

        val zoom = camera.zoom
        val scale = TILE_SIZE * 2.0.pow(zoom)
        fun originX(): Double = cameraLng().lngToWorldX(scale) - widthPx / 2
        fun originY(): Double = cameraLat().latToWorldY(scale) - heightPx / 2

        // Composition only sees the integer tile range: it changes when the camera crosses a tile
        // edge, not on every animation frame. Everything sub-tile is read in layer/draw lambdas.
        val tileRange by remember(zoom, widthPx, heightPx) {
            derivedStateOf {
                val ox = originX()
                val oy = originY()
                TileRange(
                    firstX = floor(ox / TILE_SIZE).toInt(),
                    firstY = floor(oy / TILE_SIZE).toInt(),
                    lastX = floor((ox + widthPx) / TILE_SIZE).toInt(),
                    lastY = floor((oy + heightPx) / TILE_SIZE).toInt(),
                )
            }
        }
        val firstTileX = tileRange.firstX
        val firstTileY = tileRange.firstY
        val lastTileX = tileRange.lastX
        val lastTileY = tileRange.lastY
        val maxTile = (1 shl zoom) - 1
        val tileDp = with(density) { TILE_SIZE.toFloat().toDp() }

        // Gestures: a drag frees the camera; a pinch steps the zoom. Both in world pixels of the
        // current zoom so a finger's travel maps to the same distance on the ground.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(zoom) {
                    var pinch = 1f
                    detectTransformGestures { _, pan, zoomChange, _ ->
                        if (pan != Offset.Zero) {
                            val startLat = if (camera.following) markerLat.value else camera.freeLat
                            val startLng = if (camera.following) markerLng.value else camera.freeLng
                            val s = TILE_SIZE * 2.0.pow(camera.zoom)
                            camera.freeLng = (startLng.lngToWorldX(s) - pan.x).worldXToLng(s)
                            camera.freeLat = (startLat.latToWorldY(s) - pan.y).worldYToLat(s)
                            camera.following = false
                        }
                        pinch *= zoomChange
                        if (pinch > 1.4f) {
                            camera.zoom = min(MAX_ZOOM, camera.zoom + 1)
                            pinch = 1f
                        } else if (pinch < 0.71f) {
                            camera.zoom = max(MIN_ZOOM, camera.zoom - 1)
                            pinch = 1f
                        }
                    }
                }
                .clearAndSetSemantics { },
        ) {
            // Tile grid, laid out on integer tile coordinates relative to the first visible tile.
            // Only the translation below changes between fixes; the AsyncImages keep their inputs
            // and are skipped by recomposition until the camera crosses into a new tile.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        // Whole pixels: a fractional translation of a layer of separately drawn
                        // bitmaps leaves hairline seams between tiles (seen on the emulator).
                        translationX = kotlin.math.round(firstTileX * TILE_SIZE - originX()).toFloat()
                        translationY = kotlin.math.round(firstTileY * TILE_SIZE - originY()).toFloat()
                    },
            ) {
                for (tileY in firstTileY..lastTileY) {
                    if (tileY < 0 || tileY > maxTile) continue
                    for (tileX in firstTileX..lastTileX) {
                        val wrappedX = ((tileX % (maxTile + 1)) + maxTile + 1) % (maxTile + 1)
                        AsyncImage(
                            model = "https://tile.openstreetmap.org/$zoom/$wrappedX/$tileY.png",
                            contentDescription = null,
                            contentScale = ContentScale.FillBounds,
                            modifier = Modifier
                                .absoluteOffset(x = tileDp * (tileX - firstTileX), y = tileDp * (tileY - firstTileY))
                                .requiredSize(tileDp),
                        )
                    }
                }
            }

            // The route, as a Path in world pixels relative to the first point, rebuilt only when
            // the route or zoom changes and translated into place at draw time.
            val anchorX = route.first().lng.lngToWorldX(scale)
            val anchorY = route.first().lat.latToWorldY(scale)
            val routePath = remember(route, zoom) {
                Path().apply {
                    route.forEachIndexed { index, point ->
                        val x = (point.lng.lngToWorldX(scale) - anchorX).toFloat()
                        val y = (point.lat.latToWorldY(scale) - anchorY).toFloat()
                        if (index == 0) moveTo(x, y) else lineTo(x, y)
                    }
                }
            }
            val primary = colors.primary
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokePx = 3.dp.toPx()
                val originX = originX()
                val originY = originY()
                translate((anchorX - originX).toFloat(), (anchorY - originY).toFloat()) {
                    drawPath(
                        path = routePath,
                        color = Color.White.copy(alpha = 0.85f),
                        style = Stroke(width = strokePx * 2f, cap = StrokeCap.Round, join = StrokeJoin.Round),
                    )
                    drawPath(
                        path = routePath,
                        color = primary,
                        style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round),
                    )
                }
                // Start dot.
                val start = Offset((anchorX - originX).toFloat(), (anchorY - originY).toFloat())
                drawCircle(Color.White, radius = strokePx * 2.2f, center = start)
                drawCircle(primary, radius = strokePx * 1.6f, center = start)

                // The runner: halo, white ring, primary dot — and the heading arrow only when the
                // recorder trusts the bearing.
                val marker = Offset(
                    (markerLng.value.lngToWorldX(scale) - originX).toFloat(),
                    (markerLat.value.latToWorldY(scale) - originY).toFloat(),
                )
                drawCircle(primary.copy(alpha = 0.22f), radius = strokePx * 5.5f, center = marker)
                drawCircle(Color.White, radius = strokePx * 3f, center = marker)
                drawCircle(primary, radius = strokePx * 2f, center = marker)
                if (headingDegrees != null) {
                    rotate(headingDegrees, pivot = marker) {
                        val tip = marker - Offset(0f, strokePx * 8f)
                        val base = strokePx * 2.6f
                        val arrow = Path().apply {
                            moveTo(tip.x, tip.y)
                            lineTo(marker.x - base, marker.y - strokePx * 4.2f)
                            lineTo(marker.x + base, marker.y - strokePx * 4.2f)
                            close()
                        }
                        drawPath(arrow, Color.White)
                        drawPath(arrow, primary, style = Stroke(width = 1.dp.toPx()))
                    }
                }
            }
        }

        // Required by the OpenStreetMap tile usage policy. Start-aligned here so the recenter
        // control at the end never covers it.
        Text(
            text = "© OpenStreetMap",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF334155),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .background(Color.White.copy(alpha = 0.7f))
                .padding(horizontal = 4.dp, vertical = 1.dp),
        )

        if (!camera.following) {
            val label = stringResource(R.string.runs_map_recenter)
            IconButton(
                onClick = { camera.following = true },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(ZidRunDimens.spaceSm)
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(colors.surfaceMuted.copy(alpha = 0.92f))
                    .semantics { contentDescription = label },
            ) {
                Icon(Icons.Filled.MyLocation, contentDescription = null, tint = colors.textStrong)
            }
        }
    }
}

private data class TileRange(val firstX: Int, val firstY: Int, val lastX: Int, val lastY: Int)

/** The live map's camera: following the runner, or parked where they dragged it, at a zoom. */
class LiveMapCameraState(zoom: Int = DEFAULT_ZOOM) {
    var following by mutableStateOf(true)
    var zoom by mutableStateOf(zoom)
    var freeLat by mutableStateOf(0.0)
    var freeLng by mutableStateOf(0.0)
}

@Composable
fun rememberLiveMapCamera(): LiveMapCameraState = remember { LiveMapCameraState() }

private const val TILE_SIZE = 256.0
private const val MAX_ZOOM = 18
private const val MIN_ZOOM = 12
/** Street level: a block or two around the runner, the route visible behind them. */
private const val DEFAULT_ZOOM = 16
/** A shade under the 1 Hz fix interval, so the marker is always moving toward the newest fix. */
private const val GLIDE_MS = 900

private val DoubleConverter = TwoWayConverter<Double, AnimationVector1D>(
    { AnimationVector1D(it.toFloat()) },
    { it.value.toDouble() },
)

internal fun Double.lngToWorldX(scale: Double): Double = (this + 180.0) / 360.0 * scale
internal fun Double.latToWorldY(scale: Double): Double {
    val clamped = max(-85.05112878, min(85.05112878, this))
    val radians = clamped * PI / 180.0
    return (1.0 - asinh(tan(radians)) / PI) / 2.0 * scale
}
internal fun Double.worldXToLng(scale: Double): Double = this / scale * 360.0 - 180.0
internal fun Double.worldYToLat(scale: Double): Double {
    val n = PI - 2.0 * PI * this / scale
    return 180.0 / PI * atan(0.5 * (exp(n) - exp(-n)))
}
