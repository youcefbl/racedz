package dz.racedz.nativeapp.feature.runs.share

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import androidx.core.content.ContextCompat
import androidx.core.content.res.ResourcesCompat
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunColors
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunLightColors
import dz.racedz.nativeapp.core.design.ZidRunRaceColors
import dz.racedz.nativeapp.core.design.ZidRunThemeMode
import dz.racedz.nativeapp.core.network.RoutePointDto
import androidx.compose.ui.graphics.toArgb
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.asinh
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

/**
 * The share card (NATRUN-06.9): a 1080×1350 bitmap of the run's shape and its three numbers, on the
 * theme's surface with the theme's ZidRun wordmark — and nothing else.
 *
 * Deliberately route-only: no tiles (so no attribution obligation and no readable street context),
 * no title or notes, no coordinates, no name, no health data. The route is projected onto the card
 * with Web-Mercator and normalised, so its *shape* is honest but its location is not recoverable
 * from the picture. It is optional too — off by default for a private run.
 *
 * Rendering is plain android.graphics on [Dispatchers.Default]; the bitmap is bounded to the card
 * size and written as PNG into cacheDir/export, the one subtree the FileProvider exposes. Older
 * share cards are swept on every render so nothing accumulates.
 */
object RunShareImage {
    const val WIDTH = 1080
    const val HEIGHT = 1350
    private const val MARGIN = 72f
    private const val PREFIX = "zidrun-share-"
    /** A card older than this has been handed to its share target long ago. */
    private const val SWEEP_AFTER_MS = 30 * 60 * 1000L

    class Stats(val distance: String, val distanceLabel: String, val duration: String, val durationLabel: String, val pace: String, val paceLabel: String, val date: String)

    /** Renders and writes the card, returning the file (in cacheDir/export). Never on the main thread. */
    suspend fun render(
        context: Context,
        mode: ZidRunThemeMode,
        route: List<RoutePointDto>?,
        includeRoute: Boolean,
        stats: Stats,
        fileTag: String,
    ): File = withContext(Dispatchers.Default) {
        val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
        try {
            draw(context, Canvas(bitmap), mode, if (includeRoute) route else null, stats)
            val directory = File(context.cacheDir, "export").apply { mkdirs() }
            sweep(directory)
            val file = File(directory, "$PREFIX$fileTag.png")
            FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, out) }
            file
        } finally {
            bitmap.recycle()
        }
    }

    /** Same picture at preview size, for the sheet; scaled down from the real geometry. */
    suspend fun preview(
        context: Context,
        mode: ZidRunThemeMode,
        route: List<RoutePointDto>?,
        includeRoute: Boolean,
        stats: Stats,
        widthPx: Int,
    ): Bitmap = withContext(Dispatchers.Default) {
        val w = widthPx.coerceIn(200, WIDTH)
        val h = (w.toLong() * HEIGHT / WIDTH).toInt()
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val scale = w.toFloat() / WIDTH
        canvas.scale(scale, scale)
        draw(context, canvas, mode, if (includeRoute) route else null, stats)
        bitmap
    }

    fun deleteShareFiles(context: Context) {
        val directory = File(context.cacheDir, "export")
        directory.listFiles()?.filter { it.name.startsWith(PREFIX) }?.forEach { runCatching { it.delete() } }
    }

    private fun sweep(directory: File) {
        val cutoff = System.currentTimeMillis() - SWEEP_AFTER_MS
        directory.listFiles()?.filter { it.name.startsWith(PREFIX) && it.lastModified() < cutoff }
            ?.forEach { runCatching { it.delete() } }
    }

    private fun palette(mode: ZidRunThemeMode): ZidRunColors = when (mode) {
        ZidRunThemeMode.Light -> ZidRunLightColors
        ZidRunThemeMode.Dark -> ZidRunDarkColors
        ZidRunThemeMode.Race -> ZidRunRaceColors
    }

    private fun wordmarkRes(mode: ZidRunThemeMode): Int = when (mode) {
        ZidRunThemeMode.Light -> R.drawable.ic_zidrun_wordmark_light
        ZidRunThemeMode.Dark -> R.drawable.ic_zidrun_wordmark_dark
        ZidRunThemeMode.Race -> R.drawable.ic_zidrun_wordmark_race
    }

    private fun draw(context: Context, canvas: Canvas, mode: ZidRunThemeMode, route: List<RoutePointDto>?, stats: Stats) {
        val colors = palette(mode)
        val typeface = ResourcesCompat.getFont(context, R.font.manrope_variable) ?: Typeface.DEFAULT
        // Weight axes need API 28; the two supported older levels get the face's bold/regular.
        val semiBold = if (android.os.Build.VERSION.SDK_INT >= 28) Typeface.create(typeface, 600, false) else Typeface.create(typeface, Typeface.BOLD)
        val medium = if (android.os.Build.VERSION.SDK_INT >= 28) Typeface.create(typeface, 500, false) else typeface

        canvas.drawColor(colors.surface.toArgb())

        // Route: the shape only, fitted into the middle band with generous padding.
        if (route != null && route.size > 1) {
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = colors.primary.toArgb()
                style = Paint.Style.STROKE
                strokeWidth = 14f
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
            }
            val path = routePath(route, left = MARGIN + 40f, top = 260f, right = WIDTH - MARGIN - 40f, bottom = HEIGHT - 420f)
            canvas.drawPath(path, paint)
            val dot = Paint(Paint.ANTI_ALIAS_FLAG)
            val (sx, sy) = projected(route.first(), route, MARGIN + 40f, 260f, WIDTH - MARGIN - 40f, HEIGHT - 420f)
            val (ex, ey) = projected(route.last(), route, MARGIN + 40f, 260f, WIDTH - MARGIN - 40f, HEIGHT - 420f)
            dot.color = colors.primary.toArgb(); canvas.drawCircle(sx, sy, 16f, dot)
            dot.color = colors.accent.toArgb(); canvas.drawCircle(ex, ey, 16f, dot)
        }

        // Wordmark, top-start, the theme's own asset.
        ContextCompat.getDrawable(context, wordmarkRes(mode))?.let { drawable ->
            val h = 84
            val w = (h * drawable.intrinsicWidth.toFloat() / drawable.intrinsicHeight).toInt()
            drawable.setBounds(MARGIN.toInt(), MARGIN.toInt(), MARGIN.toInt() + w, MARGIN.toInt() + h)
            drawable.draw(canvas)
        }

        // Date, top-end, muted.
        val muted = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.textMuted.toArgb(); textSize = 34f; this.typeface = medium }
        canvas.drawText(stats.date, WIDTH - MARGIN - muted.measureText(stats.date), MARGIN + 60f, muted)

        // The three numbers, bottom band: value large, label small beneath. Tabular by design of
        // the face; three equal columns.
        val value = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.textStrong.toArgb(); textSize = 88f; this.typeface = semiBold }
        val label = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.textMuted.toArgb(); textSize = 32f; this.typeface = medium }
        val columnW = (WIDTH - 2 * MARGIN) / 3f
        val baseline = HEIGHT - MARGIN - 110f
        listOf(
            stats.distance to stats.distanceLabel,
            stats.duration to stats.durationLabel,
            stats.pace to stats.paceLabel,
        ).forEachIndexed { i, (v, l) ->
            val x = MARGIN + i * columnW
            canvas.drawText(v, x, baseline, value)
            canvas.drawText(l, x, baseline + 52f, label)
        }
    }

    // ---- projection ------------------------------------------------------------------------------

    private fun worldX(lng: Double) = (lng + 180.0) / 360.0
    private fun worldY(lat: Double): Double {
        val clamped = max(-85.05112878, min(85.05112878, lat))
        return (1.0 - asinh(tan(clamped * PI / 180.0)) / PI) / 2.0
    }

    private class Frame(val minX: Double, val minY: Double, val scale: Double, val offX: Double, val offY: Double)

    private fun frame(route: List<RoutePointDto>, left: Float, top: Float, right: Float, bottom: Float): Frame {
        val xs = route.map { worldX(it.lng) }
        val ys = route.map { worldY(it.lat) }
        val minX = xs.min(); val maxX = xs.max(); val minY = ys.min(); val maxY = ys.max()
        val spanX = (maxX - minX).coerceAtLeast(1e-9)
        val spanY = (maxY - minY).coerceAtLeast(1e-9)
        val scale = min((right - left) / spanX, (bottom - top) / spanY)
        // Centre the fitted shape inside the band.
        val offX = left + ((right - left) - spanX * scale) / 2
        val offY = top + ((bottom - top) - spanY * scale) / 2
        return Frame(minX, minY, scale, offX, offY)
    }

    private fun projected(p: RoutePointDto, route: List<RoutePointDto>, left: Float, top: Float, right: Float, bottom: Float): Pair<Float, Float> {
        val f = frame(route, left, top, right, bottom)
        return Pair(((worldX(p.lng) - f.minX) * f.scale + f.offX).toFloat(), ((worldY(p.lat) - f.minY) * f.scale + f.offY).toFloat())
    }

    private fun routePath(route: List<RoutePointDto>, left: Float, top: Float, right: Float, bottom: Float): Path {
        val f = frame(route, left, top, right, bottom)
        val path = Path()
        route.forEachIndexed { i, p ->
            val x = ((worldX(p.lng) - f.minX) * f.scale + f.offX).toFloat()
            val y = ((worldY(p.lat) - f.minY) * f.scale + f.offY).toFloat()
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        return path
    }

}
