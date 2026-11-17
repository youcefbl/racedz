package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ZoomOutMap
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.AbsoluteAlignment
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.network.RoutePointDto
import dz.racedz.nativeapp.core.network.startsSegmentAt
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.tan

/**
 * [RunMap] as an inline preview that opens a full-screen, zoomable map on tap.
 *
 * The inline map stays static on purpose: it sits in a vertically scrolling page, and a map that
 * captured one-finger drags would make the page impossible to scroll past it. Tapping it (or its
 * expand chip) opens [InteractiveRunMap], where every gesture belongs to the map — the pattern
 * runners already know from other activity apps.
 */
@Composable
fun ExpandableRunMap(
    route: List<RoutePointDto>?,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 3.dp,
) {
    val hasRoute = route != null && route.size >= 2
    var expanded by rememberSaveable { mutableStateOf(false) }
    val expandLabel = stringResource(R.string.runs_map_expand)

    Box(modifier = modifier) {
        RunMap(route = route, modifier = Modifier.fillMaxSize(), strokeWidth = strokeWidth)
        if (hasRoute) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clickable(onClickLabel = expandLabel, role = Role.Button) { expanded = true }
                    .semantics { contentDescription = expandLabel },
            )
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(ZidRunDimens.spaceSm)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ZidRunTheme.colors.surface.copy(alpha = 0.92f))
                    .clearAndSetSemantics { },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Fullscreen,
                    contentDescription = null,
                    tint = ZidRunTheme.colors.textStrong,
                    modifier = Modifier.size(22.dp),
                )
            }
        }
    }

    if (expanded && hasRoute) {
        Dialog(
            onDismissRequest = { expanded = false },
            properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
        ) {
            InteractiveRunMap(
                route = route!!,
                onClose = { expanded = false },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/**
 * A pan-and-zoom map of a recorded route over OpenStreetMap tiles (same source, projection and
 * attribution as [RunMap]).
 *
 * Zoom is continuous: the nearest lower tile level is drawn scaled by up to 2×, so a pinch tracks
 * the fingers smoothly instead of jumping a level at a time, and the point under the fingers stays
 * under the fingers. Double-tap zooms in there; +/− step a level; "fit" re-frames the whole route.
 * Above the tiles' maximum level the z18 tiles are over-zoomed one more level.
 *
 * Map geometry is never mirrored in RTL (Canvas and the tile placement use absolute coordinates);
 * only the controls follow the reading direction.
 */
@Composable
fun InteractiveRunMap(
    route: List<RoutePointDto>,
    onClose: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    // Normalised Web-Mercator (0..1 on both axes), computed once: every frame only rescales it.
    val projected = remember(route) {
        DoubleArray(route.size * 2).also { out ->
            route.forEachIndexed { i, p ->
                out[i * 2] = p.lng.toMercatorX()
                out[i * 2 + 1] = p.lat.toMercatorY()
            }
        }
    }
    val bounds = remember(projected) {
        var minX = 1.0; var maxX = 0.0; var minY = 1.0; var maxY = 0.0
        for (i in projected.indices step 2) {
            minX = min(minX, projected[i]); maxX = max(maxX, projected[i])
            minY = min(minY, projected[i + 1]); maxY = max(maxY, projected[i + 1])
        }
        doubleArrayOf(minX, maxX, minY, maxY)
    }

    BoxWithConstraints(modifier = modifier.background(colors.surfaceMuted).clipToBounds()) {
        val density = LocalDensity.current
        val widthPx = with(density) { maxWidth.toPx() }.toDouble()
        val heightPx = with(density) { maxHeight.toPx() }.toDouble()
        if (widthPx < 1 || heightPx < 1) return@BoxWithConstraints

        val camera = remember(bounds) { MapCamera() }
        fun fit() = camera.fit(bounds, widthPx, heightPx)
        if (!camera.initialised) fit()

        val zoom = camera.zoom
        val tileZoom = floor(zoom).toInt().coerceIn(1, MAX_TILE_ZOOM)
        val factor = 2.0.pow(zoom - tileZoom) // 1..2 (up to 4 when over-zoomed past z18)
        val tileWorld = TILE_SIZE * 2.0.pow(tileZoom)
        // Top-left of the view, in tile-level world pixels.
        val originX = camera.centerX * tileWorld - widthPx / (2 * factor)
        val originY = camera.centerY * tileWorld - heightPx / (2 * factor)
        val firstX = floor(originX / TILE_SIZE).toInt()
        val firstY = floor(originY / TILE_SIZE).toInt()
        val lastX = floor((originX + widthPx / factor) / TILE_SIZE).toInt()
        val lastY = floor((originY + heightPx / factor) / TILE_SIZE).toInt()
        val maxTile = (1 shl tileZoom) - 1

        // Tiles are placed at absolute pixel offsets from the map's top-left. The Box's default
        // TopStart is top-RIGHT in Arabic, which shifted every tile right by the map's width and left
        // the map half blank (found on the M21 in Arabic, 2026-11-17). Pin it to the absolute corner.
        Box(
            contentAlignment = AbsoluteAlignment.TopLeft,
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(widthPx, heightPx) {
                    detectTransformGestures { centroid, pan, zoomChange, _ ->
                        camera.zoomAround(centroid, zoomChange.toDouble(), widthPx, heightPx)
                        camera.pan(pan)
                    }
                }
                .pointerInput(widthPx, heightPx) {
                    detectTapGestures(onDoubleTap = { camera.zoomAround(it, 2.0, widthPx, heightPx) })
                }
                .clearAndSetSemantics { },
        ) {
            for (tileY in firstY..lastY) {
                if (tileY < 0 || tileY > maxTile) continue
                for (tileX in firstX..lastX) {
                    val wrappedX = ((tileX % (maxTile + 1)) + maxTile + 1) % (maxTile + 1)
                    // Edges from the same rounding on both sides, so neighbouring tiles always meet
                    // exactly — independent rounding of position and size leaves hairline seams.
                    val left = floor((tileX * TILE_SIZE - originX) * factor).toInt()
                    val top = floor((tileY * TILE_SIZE - originY) * factor).toInt()
                    val right = floor(((tileX + 1) * TILE_SIZE - originX) * factor).toInt()
                    val bottom = floor(((tileY + 1) * TILE_SIZE - originY) * factor).toInt()
                    AsyncImage(
                        model = "https://tile.openstreetmap.org/$tileZoom/$wrappedX/$tileY.png",
                        contentDescription = null,
                        contentScale = ContentScale.FillBounds,
                        modifier = Modifier.layout { measurable, _ ->
                            val placeable = measurable.measure(Constraints.fixed(right - left, bottom - top))
                            layout(0, 0) { placeable.place(left, top) }
                        },
                    )
                }
            }

            Canvas(modifier = Modifier.fillMaxSize()) {
                val world = TILE_SIZE * 2.0.pow(camera.zoom)
                val viewX = camera.centerX * world - widthPx / 2
                val viewY = camera.centerY * world - heightPx / 2
                fun at(i: Int) = Offset(
                    (projected[i * 2] * world - viewX).toFloat(),
                    (projected[i * 2 + 1] * world - viewY).toFloat(),
                )
                val strokePx = 4.dp.toPx()
                val path = Path()
                for (i in route.indices) {
                    val o = at(i)
                    // A pause starts a new sub-path: no line across it (RouteSegments.kt).
                    if (i == 0 || route.startsSegmentAt(i)) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
                }
                drawPath(
                    path,
                    color = Color.White.copy(alpha = 0.85f),
                    style = Stroke(width = strokePx * 2f, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
                drawPath(
                    path,
                    color = colors.primary,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round),
                )
                drawCircle(Color.White, radius = strokePx * 2.2f, center = at(0))
                drawCircle(colors.primary, radius = strokePx * 1.6f, center = at(0))
                drawCircle(Color.White, radius = strokePx * 2.2f, center = at(route.lastIndex))
                drawCircle(colors.danger, radius = strokePx * 1.6f, center = at(route.lastIndex))
            }
        }

        // Required by the OpenStreetMap tile usage policy.
        Text(
            text = "© OpenStreetMap",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF334155),
            modifier = Modifier
                .align(Alignment.BottomStart)
                .navigationBarsPadding()
                .background(Color.White.copy(alpha = 0.7f))
                .padding(horizontal = 4.dp, vertical = 1.dp),
        )

        if (onClose != null) {
            MapControl(
                icon = Icons.Filled.Close,
                label = stringResource(R.string.runs_map_close),
                onClick = onClose,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .statusBarsPadding()
                    .padding(ZidRunDimens.spaceMd),
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .navigationBarsPadding()
                .padding(ZidRunDimens.spaceMd),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            MapControl(Icons.Filled.Add, stringResource(R.string.runs_map_zoom_in), {
                camera.zoomAround(Offset((widthPx / 2).toFloat(), (heightPx / 2).toFloat()), 2.0, widthPx, heightPx)
            })
            MapControl(Icons.Filled.Remove, stringResource(R.string.runs_map_zoom_out), {
                camera.zoomAround(Offset((widthPx / 2).toFloat(), (heightPx / 2).toFloat()), 0.5, widthPx, heightPx)
            })
            MapControl(Icons.Filled.ZoomOutMap, stringResource(R.string.runs_map_fit_route), { fit() })
        }
    }
}

/** A 48 dp round map control with a spoken label. */
@Composable
internal fun MapControl(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    background: Color = ZidRunTheme.colors.surface,
    tint: Color = ZidRunTheme.colors.textStrong,
) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(background.copy(alpha = 0.94f))
            .semantics { contentDescription = label },
    ) {
        Icon(icon, contentDescription = null, tint = tint)
    }
}

/** Camera for [InteractiveRunMap]: a centre in normalised Mercator and a fractional zoom. */
internal class MapCamera {
    var zoom by mutableDoubleStateOf(MIN_ZOOM)
    var centerX by mutableDoubleStateOf(0.5)
    var centerY by mutableDoubleStateOf(0.5)
    var initialised = false
        private set

    /** Frames the route with a margin, at whatever fractional zoom fits it best. */
    fun fit(bounds: DoubleArray, widthPx: Double, heightPx: Double) {
        val (minX, maxX, minY, maxY) = bounds.toList()
        val spanX = max(maxX - minX, 1e-9)
        val spanY = max(maxY - minY, 1e-9)
        val fitted = min(log2(widthPx * FIT_MARGIN / (spanX * TILE_SIZE)), log2(heightPx * FIT_MARGIN / (spanY * TILE_SIZE)))
        zoom = fitted.coerceIn(MIN_ZOOM, MAX_ZOOM)
        centerX = (minX + maxX) / 2
        centerY = (minY + maxY) / 2
        initialised = true
    }

    /** Scales by [factor] while keeping the map point under [focus] (view pixels) where it is. */
    fun zoomAround(focus: Offset, factor: Double, widthPx: Double, heightPx: Double) {
        if (factor == 1.0) return
        val oldWorld = TILE_SIZE * 2.0.pow(zoom)
        val newZoom = (zoom + log2(factor)).coerceIn(MIN_ZOOM, MAX_ZOOM)
        if (newZoom == zoom) return
        val newWorld = TILE_SIZE * 2.0.pow(newZoom)
        val fx = focus.x - widthPx / 2
        val fy = focus.y - heightPx / 2
        val pointX = centerX + fx / oldWorld
        val pointY = centerY + fy / oldWorld
        zoom = newZoom
        centerX = (pointX - fx / newWorld).coerceIn(0.0, 1.0)
        centerY = (pointY - fy / newWorld).coerceIn(0.0, 1.0)
    }

    /** Moves the map with the finger. */
    fun pan(delta: Offset) {
        if (delta == Offset.Zero) return
        val world = TILE_SIZE * 2.0.pow(zoom)
        centerX = (centerX - delta.x / world).coerceIn(0.0, 1.0)
        centerY = (centerY - delta.y / world).coerceIn(0.0, 1.0)
    }
}

private const val TILE_SIZE = 256.0
/** OSM's practical tile maximum; beyond it the z18 tiles are scaled up. */
private const val MAX_TILE_ZOOM = 18
private const val MIN_ZOOM = 2.0
private const val MAX_ZOOM = 19.0
private const val FIT_MARGIN = 0.75

private fun log2(value: Double): Double = ln(value) / ln(2.0)

internal fun Double.toMercatorX(): Double = (this + 180.0) / 360.0

internal fun Double.toMercatorY(): Double {
    val clamped = max(-85.05112878, min(85.05112878, this))
    val radians = clamped * PI / 180.0
    return (1.0 - asinh(tan(radians)) / PI) / 2.0
}
