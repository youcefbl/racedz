package dz.racedz.nativeapp.feature.runs.record

/**
 * What the satellites look like right now, from the system's GNSS status callback.
 *
 * [strongestCn0DbHz] holds the carrier-to-noise density of the strongest few satellites in view,
 * strongest first — the standard way to read GNSS signal strength. Around 15–20 dB-Hz a receiver
 * can barely track a satellite; 30+ is a clean signal; open sky gives 35–45.
 */
internal data class GnssSnapshot(
    val satellitesInView: Int,
    val usedInFix: Int,
    val strongestCn0DbHz: List<Float>,
)

/**
 * GPS signal as a phone-network-style indicator: 0–4 bars and a word.
 *
 * Bars, not a percentage, on purpose (owner decision 2026-11-16): GPS has no real percentage, and
 * a number like "82%" would claim a precision nothing here measures. Two honest inputs:
 *
 * - **With a fresh fix**, bars come from its accuracy, on the recorder's own scale: 2 bars is the
 *   [GpsQuality.MAX_RECORDING_ACCURACY_M] line, so "2 bars or more" means distance will count.
 * - **Without one**, bars come from satellite signal strength, capped at 1: strong satellites mean
 *   a fix is close, but no fix is never shown as good. A Galaxy M21 on 2026-11-16 saw 1–2
 *   satellites at 12–16 dB-Hz for 7½ minutes and never got a fix — that is 0 bars, not "Searching"
 *   with no hint of how bad it is.
 */
internal enum class GpsSignalLevel(val bars: Int) {
    None(0),
    Weak(1),
    Fair(2),
    Good(3),
    Excellent(4),
    ;

    /** At least the recorder's usable-fix threshold: distance will be counted. */
    val recordable: Boolean get() = bars >= Fair.bars

    companion object {
        const val MAX_BARS = 4

        /** Accuracy (m) at or under which each level starts; Fair is the recorder's own limit. */
        const val EXCELLENT_M = 5f
        const val GOOD_M = 10f
        val FAIR_M = GpsQuality.MAX_RECORDING_ACCURACY_M.toFloat()

        /** Without a fix: this many satellites at [TRACKING_CN0] or better reads as "Weak, close". */
        const val CLOSE_TO_FIX_SATELLITES = 4
        const val TRACKING_CN0 = 25f

        fun of(accuracyM: Float?, gnss: GnssSnapshot?): GpsSignalLevel {
            if (accuracyM != null && accuracyM.isFinite() && accuracyM >= 0) {
                return when {
                    accuracyM <= EXCELLENT_M -> Excellent
                    accuracyM <= GOOD_M -> Good
                    accuracyM <= FAIR_M -> Fair
                    else -> Weak
                }
            }
            val strong = gnss?.strongestCn0DbHz?.count { it >= TRACKING_CN0 } ?: 0
            return if (strong >= CLOSE_TO_FIX_SATELLITES) Weak else None
        }
    }
}

/**
 * Whether the Start screen should offer tips: the warm-up has been searching for a while and still
 * has nothing recordable. Not straight away — a warm phone outdoors fixes within seconds, and tips
 * flashing up on every open would teach runners to ignore them.
 */
internal fun shouldShowGpsTips(level: GpsSignalLevel, searchingForMs: Long): Boolean =
    !level.recordable && searchingForMs >= GPS_TIPS_AFTER_MS

internal const val GPS_TIPS_AFTER_MS = 20_000L

/** A fix older than this no longer describes the signal (the receiver lost it, e.g. indoors). */
internal const val GPS_FIX_STALE_MS = 10_000L
