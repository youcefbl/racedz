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

/** Bytes over this are refused before parsing — a real run's GPX is a few hundred KB (NATRUN-02). */
private const val MAX_GPX_BYTES = 5L * 1024 * 1024

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

    /** Reads and parses the picked file off the main thread, then publishes a preview or an error. */
    fun parse(resolver: ContentResolver, uri: Uri) {
        if (_state.value.parsing) return
        _state.update { it.copy(parsing = true, parsed = null, error = null, saveError = null) }

        viewModelScope.launch(Dispatchers.IO) {
            val fileName = displayName(resolver, uri)
            val size = fileSize(resolver, uri)

            val outcome: Result = when {
                fileName != null && !fileName.endsWith(".gpx", ignoreCase = true) -> Result.Err(GpxImportError.NOT_GPX)
                size != null && size > MAX_GPX_BYTES -> Result.Err(GpxImportError.TOO_BIG)
                else -> runCatching {
                    resolver.openInputStream(uri).use { input ->
                        if (input == null) Result.Err(GpxImportError.UNREADABLE) else parseGpx(input)
                    }
                }.getOrElse { Result.Err(GpxImportError.UNREADABLE) }
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
    fun save(onSaved: (String) -> Unit) {
        val parsed = _state.value.parsed ?: return
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, saveError = null) }

        viewModelScope.launch {
            val request = CreateRunRequest(
                clientId = UUID.randomUUID().toString(),
                startedAt = Instant.ofEpochMilli(parsed.startedAtEpochMs).toString(),
                distanceKm = parsed.distanceKm,
                durationSeconds = parsed.durationSeconds,
                // A run imported from a file carries no effort rating; the middle of the scale is the
                // web's own default for the same case.
                perceivedEffort = 5,
                route = parsed.route.takeIf { it.size >= 2 },
                source = "IMPORTED",
                title = parsed.name ?: "Imported run",
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
                route = points,
                distanceKm = distanceKm,
                durationSeconds = durationSeconds,
                startedAtEpochMs = startTs,
                name = name,
            ),
        )
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
