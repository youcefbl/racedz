package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GpsSignalTest {

    private fun sats(vararg cn0: Float) = GnssSnapshot(cn0.size, 0, cn0.sortedDescending())

    @Test
    fun aFreshFixIsGradedByAccuracy() {
        assertEquals(GpsSignalLevel.Excellent, GpsSignalLevel.of(3f, null))
        assertEquals(GpsSignalLevel.Excellent, GpsSignalLevel.of(5f, null))
        assertEquals(GpsSignalLevel.Good, GpsSignalLevel.of(8f, null))
        assertEquals(GpsSignalLevel.Fair, GpsSignalLevel.of(25f, null))
        assertEquals(GpsSignalLevel.Weak, GpsSignalLevel.of(26f, null))
        assertEquals(GpsSignalLevel.Weak, GpsSignalLevel.of(300f, null))
    }

    @Test
    fun twoBarsIsExactlyTheRecordersUsableLine() {
        // "Fair or better" must mean the recorder will count distance, and nothing less.
        val limit = GpsQuality.MAX_RECORDING_ACCURACY_M.toFloat()
        assertTrue(GpsSignalLevel.of(limit, null).recordable)
        assertTrue(GpsQuality.isUsableFix(limit))
        assertFalse(GpsSignalLevel.of(limit + 0.1f, null).recordable)
        assertFalse(GpsQuality.isUsableFix(limit + 0.1f))
    }

    @Test
    fun theM21WalkReadsAsNoSignal() {
        // 2026-11-16: 1–2 GPS satellites at 12–16 dB-Hz for 7½ minutes, never a fix.
        assertEquals(GpsSignalLevel.None, GpsSignalLevel.of(null, sats(16f, 12f)))
        assertEquals(GpsSignalLevel.None, GpsSignalLevel.of(null, null))
    }

    @Test
    fun strongSatellitesWithoutAFixAreCappedAtOneBar() {
        assertEquals(GpsSignalLevel.Weak, GpsSignalLevel.of(null, sats(40f, 38f, 35f, 30f, 22f)))
        // Three strong ones are not enough to call a fix close.
        assertEquals(GpsSignalLevel.None, GpsSignalLevel.of(null, sats(40f, 38f, 35f, 20f)))
    }

    @Test
    fun aBadAccuracyValueFallsBackToSatellites() {
        assertEquals(GpsSignalLevel.None, GpsSignalLevel.of(Float.NaN, sats(15f)))
        assertEquals(GpsSignalLevel.None, GpsSignalLevel.of(-1f, null))
    }

    @Test
    fun tipsWaitForALongSearchAndNeverShowOnARecordableSignal() {
        assertFalse(shouldShowGpsTips(GpsSignalLevel.None, GPS_TIPS_AFTER_MS - 1))
        assertTrue(shouldShowGpsTips(GpsSignalLevel.None, GPS_TIPS_AFTER_MS))
        assertTrue(shouldShowGpsTips(GpsSignalLevel.Weak, 60_000))
        assertFalse(shouldShowGpsTips(GpsSignalLevel.Fair, 600_000))
        assertFalse(shouldShowGpsTips(GpsSignalLevel.Excellent, 600_000))
    }
}
