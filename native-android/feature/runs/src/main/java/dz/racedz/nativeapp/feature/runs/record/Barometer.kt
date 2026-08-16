package dz.racedz.nativeapp.feature.runs.record

import kotlin.math.pow

/**
 * Barometric relative altitude and climb (NATRUN-07.6). Pure; the service feeds pressure samples.
 *
 * Pressure → altitude with the hypsometric formula against the first sample; a low-pass filter
 * takes the sensor's per-sample jitter out; climb accumulates only when the filtered altitude has
 * moved more than [HYSTERESIS_M] from the last counted level, so a flat road stays flat. Absolute
 * altitude is anchored once to a GPS altitude by the caller ([anchor]); this class only knows
 * relative metres.
 */
class Barometer(private val alpha: Double = 0.15) {
    private var basePressureHpa: Double? = null
    private var filteredRelativeM: Double? = null
    private var lastCountedM: Double? = null
    var samples: Int = 0
        private set
    var gainM: Double = 0.0
        private set

    /** GPS altitude at the first usable fix, so [absoluteAltitudeM] can be metres above sea level. */
    var anchor: Double? = null

    /** Feeds one pressure sample in hPa. */
    fun add(pressureHpa: Double) {
        if (!pressureHpa.isFinite() || pressureHpa < 300 || pressureHpa > 1100) return
        val base = basePressureHpa ?: pressureHpa.also { basePressureHpa = it }
        // Hypsometric: h = 44330 · (1 − (p/p0)^(1/5.255)); relative to the first sample.
        val relative = 44330.0 * (1.0 - (pressureHpa / base).pow(1.0 / 5.255))
        val filtered = filteredRelativeM?.let { it + alpha * (relative - it) } ?: relative
        filteredRelativeM = filtered
        samples += 1
        val counted = lastCountedM
        if (counted == null) {
            if (samples >= WARMUP_SAMPLES) lastCountedM = filtered
            return
        }
        val delta = filtered - counted
        if (delta >= HYSTERESIS_M) {
            gainM += delta
            lastCountedM = filtered
        } else if (delta <= -HYSTERESIS_M) {
            lastCountedM = filtered
        }
    }

    /** True once the filter has settled enough to be trusted over GPS altitude. */
    val ready: Boolean get() = samples >= WARMUP_SAMPLES

    val relativeAltitudeM: Double? get() = filteredRelativeM

    /** Metres above sea level when an anchor exists, else null. */
    val absoluteAltitudeM: Double? get() {
        val a = anchor ?: return null
        val r = filteredRelativeM ?: return null
        return a + r
    }

    fun reset() {
        basePressureHpa = null
        filteredRelativeM = null
        lastCountedM = null
        samples = 0
        gainM = 0.0
        anchor = null
    }

    companion object {
        const val HYSTERESIS_M = 1.0
        /** A handful of samples for the filter to settle before climb is counted. */
        const val WARMUP_SAMPLES = 5
    }
}
