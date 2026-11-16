package dz.racedz.nativeapp.feature.runs.record

import kotlin.math.roundToLong

/**
 * A distance for a recording whose GPS never produced one.
 *
 * It happens for real: on 2026-11-16 a Galaxy M21 walked 7½ minutes beside an OPPO that logged
 * 0.31 km, and its receiver never saw more than two satellites — zero fixes, zero metres. The step
 * counter kept counting the whole time, so the walk is not "nothing"; it is a walk without a route.
 * Refusing to save it threw away a real activity, so the summary offers this estimate instead,
 * pre-filled and editable, and the run is stored as a non-GPS (MANUAL) entry so it never feeds
 * best efforts or the GPS distance correction.
 *
 * Step length comes from cadence alone, deliberately simple: the runner sees the number and
 * corrects it. The walking step is calibrated against GPS, not textbook averages — see [WALK_STEP_M].
 */
internal object NoGpsDistance {
    /** At or above this cadence the steps are running strides rather than walking steps. */
    const val RUNNING_CADENCE_SPM = 140

    /**
     * Walking step length, in metres, measured rather than assumed. On the 2026-11-16 walk the M21
     * counted ~723 steps at 97 spm while the OPPO beside it measured 0.31 km by GPS: 310 m / 723 ≈
     * 0.43 m. The textbook 0.65 m read that same walk as 0.47 km, half as far again as it was. One
     * calibration walk so far — re-check it against the next walk recorded with GPS and steps.
     */
    const val WALK_STEP_M = 0.43

    /** Typical easy-running step length, in metres (~10 km/h at 165 spm); not yet GPS-checked. */
    const val RUN_STEP_M = 1.0

    /** The server's lower bound for a run's distance; a smaller estimate would be refused. */
    const val MIN_KM = 0.1

    /** The server's upper bound for a run's distance. */
    const val MAX_KM = 500.0

    /**
     * Kilometres covered according to the step counter, rounded to 10 m; null with no steps (no
     * sensor, or the counter never fired), in which case the runner types the distance themselves.
     */
    fun estimateKm(stepCount: Long, avgCadenceSpm: Int?): Double? {
        if (stepCount <= 0) return null
        val stepM = if ((avgCadenceSpm ?: 0) >= RUNNING_CADENCE_SPM) RUN_STEP_M else WALK_STEP_M
        val km = stepCount * stepM / 1000.0
        return ((km * 100).roundToLong() / 100.0).coerceAtMost(MAX_KM)
    }

    /** Whether [km] is a distance the server will accept. */
    fun isValid(km: Double?): Boolean = km != null && km in MIN_KM..MAX_KM
}
