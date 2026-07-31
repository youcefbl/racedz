package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.network.RoutePointDto
import kotlin.math.cos
import kotlin.math.max

/**
 * Draws a recorded route as a plain shape — the trace on a neutral background, no basemap.
 *
 * The mockups show a map behind the route, but shipping one would mean a tile provider, an API key,
 * and every run's coordinates leaving the device to render a thumbnail. The route's own shape is
 * what a runner recognises in a list ("that's my river loop"), so this draws the shape and nothing
 * else. Swapping in real tiles later only changes what sits behind this Canvas.
 *
 * Longitude is scaled by cos(latitude) so the shape is not stretched east-west — without it a loop
 * in Algiers renders noticeably wider than it was run.
 */
@Composable
fun RouteShape(
    route: List<RoutePointDto>?,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 2.5.dp,
    showEndpoints: Boolean = true,
) {
    val colors = ZidRunTheme.colors

    if (route == null || route.size < 2) {
        // A manual entry or an import with no track. An empty box would read as a failed image, so
        // say what it is instead.
        Box(
            modifier = modifier.background(colors.surfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.DirectionsRun,
                contentDescription = null,
                tint = colors.textMuted,
            )
        }
        return
    }

    val stroke = strokeWidth
    Canvas(
        modifier = modifier
            .background(colors.surfaceMuted)
            // Purely a picture of the run; the surrounding row already names it.
            .clearAndSetSemantics { },
    ) {
        val strokePx = stroke.toPx()
        // Inset by the stroke so the trace never gets clipped at the edges, plus a little breathing
        // room for the endpoint dots.
        val pad = strokePx * 2.5f
        val usable = Size(max(1f, size.width - pad * 2), max(1f, size.height - pad * 2))

        val latRad = Math.toRadians(route[0].lat)
        val lonScale = cos(latRad).takeIf { it > 0.01 } ?: 1.0

        var minX = Double.MAX_VALUE
        var maxX = -Double.MAX_VALUE
        var minY = Double.MAX_VALUE
        var maxY = -Double.MAX_VALUE
        route.forEach { point ->
            val x = point.lng * lonScale
            val y = -point.lat // screen y grows downward; latitude grows north
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
        }

        val spanX = (maxX - minX).takeIf { it > 1e-9 } ?: 1e-9
        val spanY = (maxY - minY).takeIf { it > 1e-9 } ?: 1e-9
        // One scale for both axes keeps the route's real proportions; the smaller fit wins so the
        // whole trace stays inside the box.
        val scale = minOf(usable.width / spanX, usable.height / spanY)
        // Centre whatever slack the aspect difference leaves over.
        val offsetX = pad + (usable.width - spanX * scale) / 2
        val offsetY = pad + (usable.height - spanY * scale) / 2

        fun project(point: RoutePointDto): Offset = Offset(
            (offsetX + (point.lng * lonScale - minX) * scale).toFloat(),
            (offsetY + (-point.lat - minY) * scale).toFloat(),
        )

        val path = Path()
        route.forEachIndexed { index, point ->
            val position = project(point)
            if (index == 0) path.moveTo(position.x, position.y) else path.lineTo(position.x, position.y)
        }

        drawPath(
            path = path,
            color = colors.primary,
            style = Stroke(width = strokePx, cap = StrokeCap.Round, join = StrokeJoin.Round),
        )

        if (showEndpoints) {
            // Start green, finish red — the convention the mockups use, so a runner can tell which
            // way round a loop went.
            drawCircle(color = colors.primary, radius = strokePx * 1.6f, center = project(route.first()))
            drawCircle(color = Color(0xFFEF4444), radius = strokePx * 1.6f, center = project(route.last()))
        }
    }
}
