package dz.racedz.nativeapp.feature.runs.record

/**
 * Recording-quality rules, ported 1:1 from the website's src/lib/native/gps-quality.ts.
 *
 * These decide what counts as distance, and getting them wrong is not cosmetic: too permissive and
 * a runner standing still accumulates kilometres from GPS drift; too strict and a genuine slow jog
 * records as nothing. The web values are already tuned against real devices, so they are copied
 * rather than re-derived, and kept free of Android types so they stay unit-testable.
 */
object GpsQuality {

    /** Fixes worse than this are noise, not position. */
    const val MAX_RECORDING_ACCURACY_M = 25.0

    /** Below this, the phone is not moving on foot — it is drifting. */
    const val MIN_MOVING_SPEED_MPS = 0.4

    /**
     * Some providers omit speed while acquiring. Until the recording is this old, a speedless fix is
     * not trusted to add distance, so the initial position convergence does not become a "run".
     */
    const val SPEEDLESS_STARTUP_SETTLE_SECONDS = 15.0

    /** Two consecutive minutes above plausible foot speed auto-pauses; this is a vehicle, not a run. */
    const val NON_FOOT_AUTO_PAUSE_SECONDS = 120.0

    /** Above this speed the segment counts toward the non-foot window. ~25 km/h. */
    const val NON_FOOT_SPEED_MPS = 7.0

    /** A gap longer than this is a signal loss, not running time. */
    const val MAX_MOVING_GAP_S = 15.0

    fun isUsableFix(accuracyM: Float?): Boolean =
        accuracyM == null || (accuracyM.isFinite() && accuracyM >= 0 && accuracyM <= MAX_RECORDING_ACCURACY_M)

    /**
     * Whether a segment between two fixes counts toward distance.
     *
     * The upper distance bound rejects teleports (a fix that jumps 200 m is a bad fix, not a sprint);
     * the lower bound rejects the metre-scale jitter of a stationary phone.
     */
    /**
     * Treat a reported speed of exactly zero as "no speed reported".
     *
     * OFF in production. The Android emulator's `geo fix` and NMEA injection both report
     * `hasSpeed() == true` with `speed == 0.0` on every fix, so the speed branch below rejects every
     * segment and no simulated run accumulates a metre — which makes the emulator useless for
     * testing the recording pipeline end to end.
     *
     * This is NOT enabled for real builds, and the production rule is deliberately left alone. The
     * rule exists because a stationary phone's position jitters 1-3 m between fixes at 1 Hz, which
     * *implies* 1-3 m/s and would sail past any displacement-based floor; only the GPS's own Doppler
     * velocity distinguishes drift from running. Relaxing that on a real device would let a runner
     * waiting at a crossing accumulate distance. Setting this from a debug build buys emulator
     * testability without touching what ships.
     */
    var trustDisplacementWhenSpeedIsZero: Boolean = false

    fun shouldCountSegment(
        distanceM: Double,
        elapsedSeconds: Double,
        reportedSpeedMps: Float?,
        recordingAgeSeconds: Double,
    ): Boolean {
        if (!distanceM.isFinite() || distanceM < 1.0 || distanceM > 60.0) return false
        if (!elapsedSeconds.isFinite() || elapsedSeconds <= 0.0) return false

        val speedIsUsable = reportedSpeedMps != null &&
            reportedSpeedMps.isFinite() &&
            !(trustDisplacementWhenSpeedIsZero && reportedSpeedMps == 0f)

        if (speedIsUsable) {
            return reportedSpeedMps!! >= MIN_MOVING_SPEED_MPS
        }

        return recordingAgeSeconds >= SPEEDLESS_STARTUP_SETTLE_SECONDS
    }

    /**
     * Rolling window of time spent above foot speed.
     *
     * Deliberately a window and not a lifetime average, so driving home after a legitimate long run
     * is caught promptly instead of being diluted by the hour of running before it.
     */
    fun advanceHighSpeedWindow(currentSeconds: Double, distanceM: Double, elapsedSeconds: Double): Double {
        if (elapsedSeconds <= 0.0) return currentSeconds
        val speed = distanceM / elapsedSeconds
        return if (speed >= NON_FOOT_SPEED_MPS) {
            currentSeconds + elapsedSeconds
        } else {
            // Decays rather than resetting, so alternating fast/slow fixes cannot game it.
            (currentSeconds - elapsedSeconds).coerceAtLeast(0.0)
        }
    }

    /**
     * Calories, ported from estimateCalories() in src/lib/coach/run-stats.ts.
     *
     * A MET approximation by speed. It is an estimate either way, so what matters is that the phone
     * and the website produce the SAME estimate for the same run — a runner comparing the two should
     * not see two different numbers.
     */
    fun estimateCalories(distanceKm: Double, movingSeconds: Int, weightKg: Double? = null): Int? {
        if (distanceKm <= 0 || movingSeconds <= 0) return null
        val weight = weightKg?.takeIf { it > 0 } ?: 70.0
        val speedKmh = distanceKm / (movingSeconds / 3600.0)
        val met = (speedKmh * 1.0 + 3.5).coerceIn(6.0, 20.0)
        return Math.round(met * weight * (movingSeconds / 3600.0)).toInt()
    }

    /** Great-circle distance in metres. */
    fun haversineMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val earthRadiusM = 6_371_000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
        return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
}
