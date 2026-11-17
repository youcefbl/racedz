package dz.racedz.nativeapp.feature.runs.record

/**
 * Climb from GPS altitude, for phones without a barometer.
 *
 * Phone-GPS altitude jitters by metres from one fix to the next. The old rule — count every rise
 * above 1 m between counted points — summed that jitter as climb: on the 2026-11-16 mock-GPS runs
 * on a Galaxy M21 (flat route, altitude noise of only ±1 m, far calmer than real GPS) it showed
 * +44 m for a 750 m flat run, while the server, which recomputes climb from the route, saved 5 m —
 * so the summary and the saved run disagreed by an order of magnitude.
 *
 * This applies the server's own rule (smoothedElevationGainM in src/lib/coach/run-stats.ts): a
 * 9-point moving average, then only rises of at least [THRESHOLD_M] above the running low count.
 * The window trails rather than centres (the live number cannot see the future), so it lags the
 * terrain by a few fixes but adds up to the same total.
 */
internal class GpsElevationGain {
    private val window = ArrayDeque<Double>()
    private var reference: Double? = null

    var gainM: Double = 0.0
        private set

    fun reset() {
        window.clear()
        reference = null
        gainM = 0.0
    }

    /** Adds one altitude sample (metres) and returns the total climb so far. */
    fun add(altitudeM: Double): Double {
        if (!altitudeM.isFinite()) return gainM
        window.addLast(altitudeM)
        if (window.size > WINDOW) window.removeFirst()
        val smoothed = window.average()
        val ref = reference
        when {
            ref == null -> reference = smoothed
            smoothed - ref >= THRESHOLD_M -> { gainM += smoothed - ref; reference = smoothed }
            smoothed < ref -> reference = smoothed
        }
        return gainM
    }

    companion object {
        const val WINDOW = 9
        const val THRESHOLD_M = 5.0
    }
}
