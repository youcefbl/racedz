package dz.racedz.nativeapp.feature.runs.record

import java.util.ArrayDeque

/**
 * The live pace, as a rolling window over the segments the recorder accepted.
 *
 * A single fix's `Location.speed` is a Doppler estimate that jumps by ±1:00/km between one second
 * and the next, and a runner glancing at it sees a number that never settles. Distance over time
 * across the last [GpsQuality.PACE_WINDOW_MS] of accepted segments smooths that without lagging
 * the way an average-since-start does. No Android types, so it is unit-testable.
 */
class PaceWindow(private val windowMs: Long = GpsQuality.PACE_WINDOW_MS) {

    private class Segment(val endMs: Long, val distanceM: Double, val seconds: Double)

    private val segments = ArrayDeque<Segment>()

    /** Wall time of the last accepted segment; pace is stale beyond [GpsQuality.MAX_MOVING_GAP_S] of it. */
    private var lastEndMs = 0L

    fun clear() {
        segments.clear()
        lastEndMs = 0L
    }

    /** Records an accepted segment that ended at [endMs]. */
    fun add(endMs: Long, distanceM: Double, seconds: Double) {
        if (distanceM <= 0.0 || seconds <= 0.0) return
        segments.addLast(Segment(endMs, distanceM, seconds))
        lastEndMs = endMs
        trim(endMs)
    }

    /**
     * Seconds per kilometre over the window, or null when there is nothing recent enough to say.
     *
     * [nowMs] lets the reading go stale: a runner who has stopped should see "—", not the pace they
     * were holding twenty seconds ago.
     */
    fun paceSecondsPerKm(nowMs: Long): Int? {
        if (segments.isEmpty()) return null
        if (nowMs - lastEndMs > (GpsQuality.MAX_MOVING_GAP_S * 1000).toLong()) return null
        trim(nowMs)
        var distance = 0.0
        var seconds = 0.0
        for (segment in segments) {
            distance += segment.distanceM
            seconds += segment.seconds
        }
        if (distance < 5.0 || seconds <= 0.0) return null
        val mps = distance / seconds
        if (mps < GpsQuality.MIN_MOVING_SPEED_MPS) return null
        return (1000.0 / mps).toInt()
    }

    private fun trim(nowMs: Long) {
        // Always keep the newest segment, so a slow 1 Hz provider still has something to show.
        while (segments.size > 1 && nowMs - segments.first.endMs > windowMs) segments.removeFirst()
    }
}
