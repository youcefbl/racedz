package dz.racedz.nativeapp.feature.runs.gpx

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Xml
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.core.network.RoutePointDto
import dz.racedz.nativeapp.feature.runs.record.GpsQuality
import java.io.InputStream
import java.time.Instant
import java.util.UUID
import kotlin.math.abs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.xmlpull.v1.XmlPullParser

/** The one thing wrong with a rejected GPX, mapped to a localized message by the screen. */
enum class GpxImportError {
    NOT_GPX,
    TOO_BIG,
    NO_TRACK,
    TOO_SHORT,
    NO_TIME,
    SHORT_TIME,
    LONG_TIME,
    FUTURE,
    UNREADABLE,
}

/** A GPX parsed into the shape the create endpoint wants, plus the numbers to preview. */
data class ParsedGpx(
    val route: List<RoutePointDto>,
    val distanceKm: Double,
    val durationSeconds: Int,
    val startedAtEpochMs: Long,
    val name: String?,
)

data class GpxImportUiState(
    val parsing: Boolean = false,
    val fileName: String? = null,
    val parsed: ParsedGpx? = null,
    /** A rejected file, or null. Localized in the screen. */
    val error: GpxImportError? = null,
    val saving: Boolean = false,
    /** A server-side save failure, already a message. */
    val saveError: String? = null,
)

/** Bytes over this are refused — a real run's GPX is a few hundred KB (NATRUN-02). Enforced while
 * streaming, not just from provider metadata, so an unknown-size or point-bomb file cannot exhaust
 * memory before the check. */
private const val MAX_GPX_BYTES = 5L * 1024 * 1024

/** Hard cap on points retained during parse — a runaway/point-bomb file is rejected, not OOMed. */
private const val MAX_TRACK_POINTS = 50_000

/** The server's route cap; a longer track is thinned to this for the payload (distance uses all). */
private const val MAX_ROUTE_POINTS = 5_000

/** Wraps a stream and fails past [limit] bytes, so parse memory is bounded regardless of metadata. */
private class LimitedInputStream(private val delegate: InputStream, private val limit: Long) : InputStream() {
    private var read = 0L
    private fun count(n: Int): Int {
        if (n > 0) {
            read += n
            if (read > limit) throw java.io.IOException("gpx exceeds byte limit")
        }
        return n
    }
    override fun read(): Int = delegate.read().also { if (it >= 0) count(1) }
    override fun read(b: ByteArray, off: Int, len: Int): Int = count(delegate.read(b, off, len))
    override fun close() = delegate.close()
}

/**
 * Parses a GPX chosen from the system file picker on-device and, on Save, creates it as an IMPORTED
 * run (NATRUN-02).
 *
 * The guards mirror the website's src/lib/coach/gpx.ts one-for-one — at least two track points, at
 * least two timestamps, distance ≥ 0.1 km, duration 1 min–48 h, a start not in the future — so a
 * file the web would reject is rejected here with the same reason, rather than sent and refused.
 */
class GpxImportViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(GpxImportUiState())
    val state: StateFlow<GpxImportUiState> = _state.asStateFlow()

    /** One import identity, minted per picked file and reused on every Save retry so a lost response
     * replays the same run instead of duplicating it. A new file picked mints a new id. */
    private var clientId: String = UUID.randomUUID().toString()

    /** Reads and parses the picked file off the main thread, then publishes a preview or an error. */
    fun parse(resolver: ContentResolver, uri: Uri) {
        if (_state.value.parsing) return
        clientId = UUID.randomUUID().toString()
        _state.update { it.copy(parsing = true, parsed = null, error = null, saveError = null) }

        viewModelScope.launch(Dispatchers.IO) {
            val fileName = displayName(resolver, uri)
            val size = fileSize(resolver, uri)

            val outcome: Result = when {
                fileName != null && !fileName.endsWith(".gpx", ignoreCase = true) -> Result.Err(GpxImportError.NOT_GPX)
                size != null && size > MAX_GPX_BYTES -> Result.Err(GpxImportError.TOO_BIG)
                else -> runCatching {
                    resolver.openInputStream(uri).use { input ->
                        // Bound the read to MAX_GPX_BYTES even when the provider reports no size.
                        if (input == null) Result.Err(GpxImportError.UNREADABLE)
                        else parseGpx(LimitedInputStream(input, MAX_GPX_BYTES))
                    }
                }.getOrElse {
                    // The byte-limit tripwire and any other read failure surface as size/unreadable.
                    if (it is java.io.IOException && it.message == "gpx exceeds byte limit") Result.Err(GpxImportError.TOO_BIG)
                    else Result.Err(GpxImportError.UNREADABLE)
                }
            }

            _state.update {
                when (outcome) {
                    is Result.Ok -> it.copy(parsing = false, fileName = fileName, parsed = outcome.parsed, error = null)
                    is Result.Err -> it.copy(parsing = false, fileName = fileName, parsed = null, error = outcome.reason)
                }
            }
        }
    }

    /** Sends the parsed run to the server. A finished parse is a precondition, so this is a no-op otherwise. */
    fun save(onSaved: (String) -> Unit, sport: String = "RUN") {
        val parsed = _state.value.parsed ?: return
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, saveError = null) }

        viewModelScope.launch {
            val request = CreateRunRequest(
                clientId = clientId,
                startedAt = Instant.ofEpochMilli(parsed.startedAtEpochMs).toString(),
                sport = sport,
                distanceKm = parsed.distanceKm,
                durationSeconds = parsed.durationSeconds,
                // A run imported from a file carries no effort rating; the middle of the scale is the
                // web's own default for the same case.
                perceivedEffort = 5,
                route = parsed.route.takeIf { it.size >= 2 },
                source = "IMPORTED",
                // Null rather than an English literal, so a French/Arabic history localizes the
                // fallback title itself rather than showing "Imported run".
                title = parsed.name,
            )

            when (val result = repository.create(request)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(saving = false, saveError = null) }
                    onSaved(result.value.id)
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(saving = false, saveError = result.error.message)
                }
            }
        }
    }

    private sealed interface Result {
        data class Ok(val parsed: ParsedGpx) : Result
        data class Err(val reason: GpxImportError) : Result
    }

    private fun parseGpx(input: InputStream): Result {
        val parser = Xml.newPullParser()
        parser.setInput(input, null)

        val points = mutableListOf<RoutePointDto>()
        var name: String? = null
        var sawGpxRoot = false

        var inTrkpt = false
        var lat: Double? = null
        var lng: Double? = null
        var ele: Double? = null
        var t: Long? = null
        var text = ""

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    val tag = parser.name
                    if (!sawGpxRoot) {
                        // The first element must be <gpx>; anything else is not a GPX file.
                        if (!tag.equals("gpx", ignoreCase = true)) return Result.Err(GpxImportError.NOT_GPX)
                        sawGpxRoot = true
                    }
                    if (tag.equals("trkpt", ignoreCase = true)) {
                        inTrkpt = true
                        lat = parser.getAttributeValue(null, "lat")?.toDoubleOrNull()
                        lng = parser.getAttributeValue(null, "lon")?.toDoubleOrNull()
                        ele = null
                        t = null
                    }
                    text = ""
                }

                XmlPullParser.TEXT -> text = parser.text ?: ""

                XmlPullParser.END_TAG -> {
                    val tag = parser.name
                    when {
                        // First <name> anywhere (document/track name), matching the web parser.
                        tag.equals("name", ignoreCase = true) && name == null ->
                            name = text.trim().take(120).ifBlank { null }
                        inTrkpt && tag.equals("ele", ignoreCase = true) ->
                            ele = text.trim().toDoubleOrNull()
                        inTrkpt && tag.equals("time", ignoreCase = true) ->
                            t = runCatching { Instant.parse(text.trim()).toEpochMilli() }.getOrNull()
                        tag.equals("trkpt", ignoreCase = true) -> {
                            val la = lat
                            val ln = lng
                            if (la != null && ln != null && abs(la) <= 90.0 && abs(ln) <= 180.0) {
                                points.add(RoutePointDto(lat = la, lng = ln, ele = ele, t = t))
                                // A runaway file is rejected here rather than parsed into an OOM.
                                if (points.size > MAX_TRACK_POINTS) return Result.Err(GpxImportError.TOO_BIG)
                            }
                            inTrkpt = false
                        }
                    }
                    text = ""
                }
            }
            event = parser.next()
        }

        if (!sawGpxRoot) return Result.Err(GpxImportError.NOT_GPX)
        if (points.size < 2) return Result.Err(GpxImportError.NO_TRACK)

        // Distance: sum of consecutive great-circle hops (metres → km), the same math the recorder
        // uses so the two clients agree on the same track.
        var distanceMeters = 0.0
        for (i in 1 until points.size) {
            distanceMeters += GpsQuality.haversineMeters(
                points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng,
            )
        }
        val distanceKm = Math.round(distanceMeters / 1000.0 * 100.0) / 100.0
        if (distanceKm < 0.1) return Result.Err(GpxImportError.TOO_SHORT)

        val timed = points.mapNotNull { it.t }
        if (timed.size < 2) return Result.Err(GpxImportError.NO_TIME)

        val startTs = timed.first()
        val endTs = timed.last()
        val durationSeconds = Math.round((endTs - startTs) / 1000.0).toInt()
        if (durationSeconds < 60) return Result.Err(GpxImportError.SHORT_TIME)
        if (durationSeconds > 172_800) return Result.Err(GpxImportError.LONG_TIME)

        if (startTs > System.currentTimeMillis() + 5 * 60 * 1000) return Result.Err(GpxImportError.FUTURE)

        return Result.Ok(
            ParsedGpx(
                // Distance/duration used every point above; the stored route is thinned to the
                // server's cap so a long but valid track imports instead of being rejected at Save.
                route = downsample(points, MAX_ROUTE_POINTS),
                distanceKm = distanceKm,
                durationSeconds = durationSeconds,
                startedAtEpochMs = startTs,
                name = name,
            ),
        )
    }

    /** Evenly thins a route to at most [max] points, always keeping the first and last. */
    private fun downsample(route: List<RoutePointDto>, max: Int): List<RoutePointDto> {
        if (route.size <= max) return route
        val kept = ArrayList<RoutePointDto>(max + 1)
        val step = route.size.toDouble() / max
        var i = 0.0
        while (i < route.size) {
            kept.add(route[i.toInt()])
            i += step
        }
        if (kept.last() != route.last()) kept.add(route.last())
        return kept
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? =
        runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0)?.takeIf { it.isNotBlank() } else null
            }
        }.getOrNull()

    private fun fileSize(resolver: ContentResolver, uri: Uri): Long? =
        runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
            }
        }.getOrNull()
}
