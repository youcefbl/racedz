package dz.racedz.nativeapp.feature.runs.record

/**
 * Turns a stream of usable GPS fixes into distance and moving time.
 *
 * Distance is measured from an **anchor** — the last point that was counted — not from the previous
 * fix. The previous version measured fix-to-fix and dropped any step under a metre. At 1 Hz that
 * silently threw away everyone slower than 1 m/s (3.6 km/h): a 1.33 km walk on 2026-11-14 saved as
 * 0.167 km, because each sub-metre step was rejected *and* lost — the next step started from the
 * rejected fix. Measuring from the anchor lets small steps add up until they clear the jitter floor,
 * so slow movement is counted while a stationary phone's jitter (which hovers around the anchor
 * instead of walking away from it) is not.
 *
 * Whether the runner is moving at all is still decided by the GPS's own Doppler speed when it has
 * one (see [GpsQuality.shouldCountSegment] for why displacement alone cannot tell drift from
 * movement), and moving time is summed per fix so a slow walk is not clocked as standing still.
 *
 * Pure Kotlin, no Android types, so it is unit-testable on the JVM.
 */
class DistanceAccumulator {

    data class Fix(
        val lat: Double,
        val lng: Double,
        val timeMs: Long,
        val accuracyM: Float?,
        val speedMps: Float?,
    )

    data class Step(
        /** Metres to add to the run's distance (0 when this fix did not advance the anchor). */
        val countedMeters: Double,
        /** Seconds since the previous anchor; the span [countedMeters] was covered in. */
        val countedSeconds: Double,
        /** Seconds to add to moving time. */
        val movingSeconds: Double,
        /** The fix reads as on-foot movement (resets the stationary auto-pause window). */
        val moving: Boolean,
        /** The fix reads as standing still (feeds the stationary auto-pause window). */
        val stationary: Boolean,
        /** Seconds since the previous usable fix, for the vehicle window. */
        val elapsedSeconds: Double,
        /** Metres from the previous usable fix, for the vehicle window. */
        val fixDistanceM: Double,
        /** True when the fix was a teleport and has been ignored entirely. */
        val rejected: Boolean = false,
    ) {
        val counted: Boolean get() = countedMeters > 0.0
    }

    private var anchor: Fix? = null
    private var last: Fix? = null

    val hasAnchor: Boolean get() = anchor != null

    /** Forget everything — a new run, or a resume after a pause (the break is not a segment). */
    fun reset() {
        anchor = null
        last = null
    }

    /**
     * Moves the anchor onto [fix] without counting anything: used while the start position is
     * still settling, so acquisition drift does not become the first metres of the run.
     */
    fun resettle(fix: Fix) {
        anchor = fix
        last = fix
    }

    fun onFix(fix: Fix, recordingAgeSeconds: Double): Step {
        val previous = last
        val origin = anchor
        if (previous == null || origin == null) {
            anchor = fix
            last = fix
            return Step(0.0, 0.0, 0.0, moving = false, stationary = false, elapsedSeconds = 0.0, fixDistanceM = 0.0)
        }

        val elapsed = (fix.timeMs - previous.timeMs) / 1000.0
        if (!elapsed.isFinite() || elapsed <= 0.0) {
            // Out-of-order or duplicate timestamp: nothing to learn from it.
            return Step(0.0, 0.0, 0.0, moving = false, stationary = false, elapsedSeconds = 0.0, fixDistanceM = 0.0, rejected = true)
        }
        val fixDistance = GpsQuality.haversineMeters(previous.lat, previous.lng, fix.lat, fix.lng)

        if (!fixDistance.isFinite() || fixDistance > MAX_FIX_JUMP_M) {
            if (elapsed <= GpsQuality.MAX_MOVING_GAP_S) {
                // A bad fix, not a sprint: drop it and keep measuring from where we were.
                return Step(0.0, 0.0, 0.0, moving = false, stationary = false, elapsedSeconds = elapsed, fixDistanceM = 0.0, rejected = true)
            }
            // A long signal gap: we cannot know the path, so restart from here without counting it.
            anchor = fix
            last = fix
            return Step(0.0, 0.0, 0.0, moving = false, stationary = false, elapsedSeconds = elapsed, fixDistanceM = fixDistance)
        }

        val speed = fix.speedMps?.takeIf {
            it.isFinite() && it >= 0f && !(GpsQuality.trustDisplacementWhenSpeedIsZero && it == 0f)
        }
        val fromAnchor = GpsQuality.haversineMeters(origin.lat, origin.lng, fix.lat, fix.lng)
        val floor = stepFloorMeters(fix.accuracyM)

        val moving: Boolean
        val stationary: Boolean
        if (speed != null) {
            moving = speed >= GpsQuality.MIN_MOVING_SPEED_MPS
            stationary = !moving
        } else {
            // No Doppler: only real displacement away from the anchor is movement, and not before
            // the start position has had time to settle.
            moving = recordingAgeSeconds >= GpsQuality.SPEEDLESS_STARTUP_SETTLE_SECONDS && fromAnchor >= floor
            stationary = fixDistance < 1.0
        }

        val movingSeconds = if (moving && elapsed < GpsQuality.MAX_MOVING_GAP_S) elapsed else 0.0
        last = fix

        if (moving && fromAnchor >= floor) {
            val spanSeconds = (fix.timeMs - origin.timeMs) / 1000.0
            anchor = fix
            return Step(fromAnchor, spanSeconds, movingSeconds, moving = true, stationary = false, elapsedSeconds = elapsed, fixDistanceM = fixDistance)
        }
        return Step(0.0, 0.0, movingSeconds, moving, stationary, elapsedSeconds = elapsed, fixDistanceM = fixDistance)
    }

    companion object {
        /** A jump this far between two consecutive fixes is a bad fix (or a signal gap), never a stride. */
        const val MAX_FIX_JUMP_M = 60.0

        /**
         * How far from the anchor a fix must be before the stretch is counted: the fix's reported
         * accuracy, bounded to 5–10 m. Position noise stays inside that radius while a walker clears
         * it within seconds. Smaller inflates slow movement — each counted chord adds its noise, and
         * a walker has many short chords (simulated: a 3 m floor reads a 0.7 m/s walk 8–150 % long
         * depending on how correlated the noise is; 8 m reads it within ~4 %). Larger would cut
         * corners off a winding route.
         */
        fun stepFloorMeters(accuracyM: Float?): Double {
            val accuracy = accuracyM?.takeIf { it.isFinite() && it > 0f }?.toDouble() ?: DEFAULT_ACCURACY_M
            return accuracy.coerceIn(MIN_STEP_FLOOR_M, MAX_STEP_FLOOR_M)
        }

        private const val DEFAULT_ACCURACY_M = 8.0
        private const val MIN_STEP_FLOOR_M = 5.0
        private const val MAX_STEP_FLOOR_M = 10.0
    }
}
