package dz.racedz.nativeapp.feature.runs.record

import android.location.Location
import dz.racedz.nativeapp.core.network.RoutePointDto
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class RecordingStatus { Idle, Acquiring, Recording, Paused, Finished }

data class RecordingState(
    val status: RecordingStatus = RecordingStatus.Idle,
    /** Generated once per recording and reused on every save attempt — see [RunRecorder.clientId]. */
    val clientId: String = "",
    val startedAtEpochMs: Long = 0,
    val distanceMeters: Double = 0.0,
    val elapsedSeconds: Int = 0,
    val movingSeconds: Int = 0,
    val elevationGainM: Double = 0.0,
    val currentPaceSecondsPerKm: Int? = null,
    val gpsAccuracyM: Float? = null,
    val route: List<RoutePointDto> = emptyList(),
    /** Set when the recorder auto-paused because the movement stopped looking like running. */
    val autoPaused: Boolean = false,
) {
    val distanceKm: Double get() = distanceMeters / 1000.0

    /** Average pace over moving time, which is what runners compare against. */
    val averagePaceSecondsPerKm: Int?
        get() = if (distanceMeters > 50 && movingSeconds > 0) {
            (movingSeconds / (distanceMeters / 1000.0)).toInt()
        } else {
            null
        }

    val hasUsableFix: Boolean get() = GpsQuality.isUsableFix(gpsAccuracyM)
}

/**
 * Accumulates a run from GPS fixes.
 *
 * A singleton with no Android dependencies beyond [Location], so the foreground service, the UI, and
 * a unit test all observe the same state. It deliberately owns no service or permission logic: the
 * service feeds it fixes and it decides what they mean.
 *
 * Every acceptance rule comes from [GpsQuality], which is a port of the website's, so a run recorded
 * on the native app and one recorded in the Capacitor app measure the same.
 */
object RunRecorder {

    private const val MAX_ROUTE_POINTS = 1500

    private val _state = MutableStateFlow(RecordingState())
    val state: StateFlow<RecordingState> = _state.asStateFlow()

    private var lastFix: Location? = null
    private var lastAcceptedTimeMs: Long = 0
    private var pausedAccumMs: Long = 0
    private var pauseStartedMs: Long = 0
    private var highSpeedSeconds: Double = 0.0
    private val route = mutableListOf<RoutePointDto>()

    /**
     * The id this recording will be saved under. Generated at start and kept for the life of the
     * recording so that a save which times out can be retried without creating a second run — it is
     * the idempotency key the server dedupes on.
     */
    val clientId: String get() = _state.value.clientId

    fun start() {
        route.clear()
        lastFix = null
        lastAcceptedTimeMs = 0
        pausedAccumMs = 0
        pauseStartedMs = 0
        highSpeedSeconds = 0.0
        _state.value = RecordingState(
            status = RecordingStatus.Acquiring,
            clientId = UUID.randomUUID().toString(),
            startedAtEpochMs = System.currentTimeMillis(),
        )
    }

    fun pause() {
        if (_state.value.status != RecordingStatus.Recording && _state.value.status != RecordingStatus.Acquiring) return
        pauseStartedMs = System.currentTimeMillis()
        _state.update { it.copy(status = RecordingStatus.Paused) }
    }

    fun resume() {
        if (_state.value.status != RecordingStatus.Paused) return
        if (pauseStartedMs > 0) pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
        pauseStartedMs = 0
        // A fix from before the pause would otherwise be treated as the previous point and turn the
        // whole break into one enormous segment.
        lastFix = null
        highSpeedSeconds = 0.0
        _state.update { it.copy(status = RecordingStatus.Recording, autoPaused = false) }
    }

    fun finish() {
        if (pauseStartedMs > 0) {
            pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
            pauseStartedMs = 0
        }
        _state.update { it.copy(status = RecordingStatus.Finished, elapsedSeconds = elapsedSeconds()) }
    }

    /** Clears the recording. Called after a successful save, or when the runner discards. */
    fun reset() {
        route.clear()
        lastFix = null
        _state.value = RecordingState()
    }

    /** Ticks elapsed time so the display keeps counting between fixes. */
    fun tick() {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) return
        _state.update { it.copy(elapsedSeconds = elapsedSeconds()) }
    }

    fun onLocation(location: Location) {
        val current = _state.value
        if (current.status == RecordingStatus.Paused || current.status == RecordingStatus.Finished) return

        val accuracy = if (location.hasAccuracy()) location.accuracy else null
        if (!GpsQuality.isUsableFix(accuracy)) {
            // Still worth surfacing: the recording screen shows GPS strength, and a run that is not
            // accumulating should say why.
            _state.update { it.copy(gpsAccuracyM = accuracy) }
            return
        }

        val previous = lastFix
        val speed = if (location.hasSpeed()) location.speed else null

        if (previous == null) {
            route += location.toRoutePoint()
            lastAcceptedTimeMs = location.time
            lastFix = location
            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    gpsAccuracyM = accuracy,
                    route = route.toList(),
                )
            }
            return
        }

        val distanceM = GpsQuality.haversineMeters(
            previous.latitude, previous.longitude, location.latitude, location.longitude,
        )
        val elapsed = (location.time - previous.time) / 1000.0
        val speedDistance = if (speed != null && speed >= 0 && elapsed > 0) speed * elapsed else distanceM
        highSpeedSeconds = GpsQuality.advanceHighSpeedWindow(highSpeedSeconds, speedDistance, elapsed)

        val counts = GpsQuality.shouldCountSegment(
            distanceM = distanceM,
            elapsedSeconds = elapsed,
            reportedSpeedMps = speed,
            recordingAgeSeconds = (location.time - current.startedAtEpochMs) / 1000.0,
        )

        if (counts) {
            var gain = current.elevationGainM
            if (previous.hasAltitude() && location.hasAltitude()) {
                val delta = location.altitude - previous.altitude
                // Only rises above a metre count: GPS altitude noise would otherwise invent climb on
                // a flat road.
                if (delta > 1) gain += delta
            }
            route += location.toRoutePoint()
            if (route.size >= MAX_ROUTE_POINTS * 2) downsampleRoute()
            lastAcceptedTimeMs = location.time

            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    distanceMeters = it.distanceMeters + distanceM,
                    // Summed from GPS timestamps, not a wall clock, so it survives the OS throttling
                    // our timer while the screen is off.
                    movingSeconds = it.movingSeconds + if (elapsed < GpsQuality.MAX_MOVING_GAP_S) elapsed.toInt() else 0,
                    elevationGainM = gain,
                    gpsAccuracyM = accuracy,
                    currentPaceSecondsPerKm = speed?.takeIf { s -> s > 0.4 }?.let { s -> (1000 / s).toInt() },
                    route = route.toList(),
                    elapsedSeconds = elapsedSeconds(),
                )
            }
        } else if (current.distanceMeters == 0.0 && route.size == 1) {
            // Still stationary: keep replacing the acquisition fix rather than saving its drift as
            // the start of the route, so the first real movement is measured from a settled position.
            route[0] = location.toRoutePoint()
            lastAcceptedTimeMs = location.time
            _state.update { it.copy(gpsAccuracyM = accuracy, route = route.toList()) }
        } else {
            _state.update { it.copy(gpsAccuracyM = accuracy) }
        }

        lastFix = location

        if (highSpeedSeconds >= GpsQuality.NON_FOOT_AUTO_PAUSE_SECONDS) {
            // Sustained vehicle speed. Pause rather than discard: the runner may have genuinely run
            // and then got in a car, and deleting their run would be far worse than a stray pause.
            pauseStartedMs = System.currentTimeMillis()
            _state.update { it.copy(status = RecordingStatus.Paused, autoPaused = true) }
        }
    }

    private fun elapsedSeconds(): Int {
        val current = _state.value
        if (current.startedAtEpochMs == 0L) return 0
        val paused = pausedAccumMs + if (pauseStartedMs > 0) System.currentTimeMillis() - pauseStartedMs else 0
        return ((System.currentTimeMillis() - current.startedAtEpochMs - paused) / 1000).toInt().coerceAtLeast(0)
    }

    /**
     * Halves the buffer, keeping the first and last point.
     *
     * Distance, elevation and pace are summed per fix as they arrive, never recomputed from this
     * list, so thinning it changes nothing that was measured — only the drawn line's resolution.
     */
    private fun downsampleRoute() {
        val kept = ArrayList<RoutePointDto>(MAX_ROUTE_POINTS + 1)
        val step = route.size.toDouble() / MAX_ROUTE_POINTS
        var i = 0.0
        while (i < route.size) {
            kept += route[i.toInt()]
            i += step
        }
        if (kept.lastOrNull() != route.last()) kept += route.last()
        route.clear()
        route += kept
    }

    private fun Location.toRoutePoint() = RoutePointDto(
        lat = latitude,
        lng = longitude,
        ele = if (hasAltitude()) altitude else null,
        // Milliseconds, matching the website's route-point contract.
        t = time,
    )

    private fun MutableStateFlow<RecordingState>.update(block: (RecordingState) -> RecordingState) {
        value = block(value)
    }
}
