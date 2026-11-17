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

    /**
     * The distance the runner typed, in the field's own unit, or null when it is not one plain
     * number.
     *
     * Strict on purpose: the summary pre-fills a number the runner only glances at, so anything
     * ambiguous must read as invalid rather than as some other distance. A lenient "keep the
     * digits" parse turned "0,31M21 no" into 0.3121 and "0 31" into 31 km, both with Save enabled.
     * Accepted: any Unicode decimal digits (Arabic-Indic included), at most one decimal separator
     * (`.` `,` `٫` `،` — whichever the keyboard gives), and whitespace only around the number.
     * Rejected: inner spaces, grouping separators (`٬`), a second separator, letters, signs.
     */
    fun parseInput(text: String): Double? {
        val trimmed = text.trim()
        val normalized = StringBuilder(trimmed.length)
        var separators = 0
        var digits = 0
        for (ch in trimmed) {
            val digit = Character.digit(ch, 10)
            when {
                digit in 0..9 -> { normalized.append(digit); digits++ }
                ch in DECIMAL_SEPARATORS -> { if (++separators > 1) return null; normalized.append('.') }
                else -> return null
            }
        }
        if (digits == 0) return null
        return normalized.toString().toDoubleOrNull()
    }

    private const val DECIMAL_SEPARATORS = ".,٫،"

    /**
     * Moving time for a no-GPS run: the time the step counter saw the runner moving (GPS moving
     * time is zero without fixes), never more than the recording itself; null when unknown.
     */
    fun movingSeconds(steppingSeconds: Int, elapsedSeconds: Int): Int? =
        steppingSeconds.coerceAtMost(elapsedSeconds).takeIf { it > 0 }

    /**
     * Pace exactly as the server will store it (calculateAveragePaceSecondsPerKm in
     * src/lib/coach/metrics.ts): moving time when there is one, else the whole duration, over the
     * distance, rounded. Null without a positive distance and time.
     */
    fun paceSecondsPerKm(km: Double?, movingSeconds: Int?, elapsedSeconds: Int): Int? {
        if (km == null || km <= 0) return null
        val seconds = movingSeconds?.takeIf { it > 0 } ?: elapsedSeconds
        if (seconds <= 0) return null
        return (seconds / km).roundToLong().toInt()
    }
}
