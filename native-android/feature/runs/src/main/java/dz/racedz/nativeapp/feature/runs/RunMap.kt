package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.network.RoutePointDto
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.tan

/**
 * The recorded route drawn over real OpenStreetMap tiles — the same tile source and attribution the
 * website's Leaflet map uses (src/components/coach/run-map.tsx), so the two show the same world.
 *
 * Raster tiles are composed directly rather than through a map SDK: the view is static (a finished
 * run does not pan or zoom), and every SDK worth embedding wants an API key and an account, which
 * this evaluation has neither of. Attribution is required by the OSM tile policy and is rendered on
 * the map, not tucked away.
 *
 * Tiles are fetched by Coil, so they are memory- and disk-cached like every other image in the app;
 * revisiting a run does not re-download them.
 */
@Composable
fun RunMap(
    route: List<RoutePointDto>?,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 3.dp,
) {
    val colors = ZidRunTheme.colors

    if (route == null || route.size < 2) {
        // Manual entry or an import with no track: fall back to the plain shape, which says "no
        // route" rather than showing an empty map of nowhere.
        RouteShape(route = route, modifier = modifier, strokeWidth = strokeWidth)
        return
    }

    // clipToBounds because the tiles below are laid out at their true grid size and deliberately
    // overhang the map on every edge; without it the edge tiles would paint over the surrounding UI.
    BoxWithConstraints(modifier = modifier.background(colors.surfaceMuted).clipToBounds()) {
        val density = LocalDensity.current
        val widthPx = with(density) { maxWidth.toPx() }
        val heightPx = with(density) { maxHeight.toPx() }
        if (widthPx < 1f || heightPx < 1f) return@BoxWithConstraints

        val bounds = route.bounds()
        val zoom = chooseZoom(bounds, widthPx, heightPx)
        val scale = TILE_SIZE * 2.0.pow(zoom)

        // World pixel coordinates at this zoom, then the top-left corner that centres the route.
        val centreX = ((bounds.minLng + bounds.maxLng) / 2).lngToWorldX(scale)
        val centreY = ((bounds.minLat + bounds.maxLat) / 2).latToWorldY(scale)
        val originX = centreX - widthPx / 2
        val originY = centreY - heightPx / 2

        val firstTileX = floor(originX / TILE_SIZE).toInt()
        val firstTileY = floor(originY / TILE_SIZE).toInt()
        val lastTileX = floor((originX + widthPx) / TILE_SIZE).toInt()
        val lastTileY = floor((originY + heightPx) / TILE_SIZE).toInt()
        val maxTile = (1 shl zoom) - 1

        for (tileY in firstTileY..lastTileY) {
            if (tileY < 0 || tileY > maxTile) continue
            for (tileX in firstTileX..lastTileX) {
                // Wrap horizontally so a route near the antimeridian still tiles; vertical has no
                // wrap, hence the skip above.
                val wrappedX = ((tileX % (maxTile + 1)) + maxTile + 1) % (maxTile + 1)
                val left = with(density) { (tileX * TILE_SIZE - originX).toFloat().toDp() }
                val top = with(density) { (tileY * TILE_SIZE - originY).toFloat().toDp() }
                val tileDp = with(density) { TILE_SIZE.toFloat().toDp() }
                AsyncImage(
                    model = "https://tile.openstreetmap.org/$zoom/$wrappedX/$tileY.png",
                    contentDescription = null,
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier
                        .absoluteOffset(x = left, y = top)
                        // requiredSize, not size: a tile is a fixed 256px cell of the tile grid, and
                        // the offsets above are computed on that grid. `size` is only a *preferred*
                        // size, so the parent's height constraint squashed every tile to the map's
                        // own height — leaving an unpainted band where the next row should have
                        // started, and scaling the tile artwork out of register with the route drawn
                        // over it.
                        .requiredSize(tileDp)
                        .clearAndSetSemantics { },
                )
            }
        }

        Canvas(modifier = Modifier.fillMaxSize().clearAndSetSemantics { }) {
            val strokePx = strokeWidth.toPx()
            val path = Path()
            route.forEachIndexed { index, point ->
                val x = (point.lng.lngToWorldX(scale) - originX).toFloat()
                val y = (point.lat.latToWorldY(scale) - originY).toFloat()
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            // A light casing under the line keeps it readable over both pale streets and dark parks.
            drawPath(
                path = path,
                color = Color.White.copy(alpha = 0.85f),
                style = Stroke(width = strokePx * 2f, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
            drawPath(
                path = path,
                color = colors.primary,
                style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round),
            )

            fun marker(point: RoutePointDto) = Offset(
                (point.lng.lngToWorldX(scale) - originX).toFloat(),
                (point.lat.latToWorldY(scale) - originY).toFloat(),
            )
            // Start green, finish red, each with a white ring so they read on any tile underneath.
            drawCircle(Color.White, radius = strokePx * 2.2f, center = marker(route.first()))
            drawCircle(colors.primary, radius = strokePx * 1.6f, center = marker(route.first()))
            drawCircle(Color.White, radius = strokePx * 2.2f, center = marker(route.last()))
            drawCircle(Color(0xFFEF4444), radius = strokePx * 1.6f, center = marker(route.last()))
        }

        // Required by the OpenStreetMap tile usage policy.
        Text(
            text = "© OpenStreetMap",
            style = MaterialTheme.typography.labelSmall,
            color = Color(0xFF334155),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .background(Color.White.copy(alpha = 0.7f))
                .padding(horizontal = 4.dp, vertical = 1.dp),
        )
    }
}

private const val TILE_SIZE = 256.0

/** OSM's practical maximum; asking for more returns nothing. */
private const val MAX_ZOOM = 18

private data class Bounds(val minLat: Double, val maxLat: Double, val minLng: Double, val maxLng: Double)

private fun List<RoutePointDto>.bounds() = Bounds(
    minLat = minOf { it.lat },
    maxLat = maxOf { it.lat },
    minLng = minOf { it.lng },
    maxLng = maxOf { it.lng },
)

/**
 * The largest zoom at which the whole route still fits, so a run is framed as tightly as it can be
 * without clipping. A little padding stops the trace touching the edges.
 */
private fun chooseZoom(bounds: Bounds, widthPx: Float, heightPx: Float): Int {
    val padding = 0.85
    for (zoom in MAX_ZOOM downTo 1) {
        val scale = TILE_SIZE * 2.0.pow(zoom)
        val spanX = bounds.maxLng.lngToWorldX(scale) - bounds.minLng.lngToWorldX(scale)
        // Y is inverted in world coordinates, so max latitude gives the smaller value.
        val spanY = bounds.minLat.latToWorldY(scale) - bounds.maxLat.latToWorldY(scale)
        if (spanX <= widthPx * padding && spanY <= heightPx * padding) return zoom
    }
    return 1
}

/** Web-Mercator projection, matching the tile grid. */
private fun Double.lngToWorldX(scale: Double): Double = (this + 180.0) / 360.0 * scale

private fun Double.latToWorldY(scale: Double): Double {
    val clamped = max(-85.05112878, min(85.05112878, this))
    val radians = clamped * PI / 180.0
    return (1.0 - asinh(tan(radians)) / PI) / 2.0 * scale
}
