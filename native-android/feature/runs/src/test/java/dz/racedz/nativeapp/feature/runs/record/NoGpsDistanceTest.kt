package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NoGpsDistanceTest {

    @Test
    fun noStepsMeansNoEstimate() {
        assertNull(NoGpsDistance.estimateKm(0, null))
        assertNull(NoGpsDistance.estimateKm(0, 98))
    }

    @Test
    fun theCalibrationWalkMatchesTheGpsPhone() {
        // 2026-11-16: the M21 (no GPS fix) counted ~723 steps at 97 spm; the OPPO walking beside it
        // measured the same walk as 0.31 km by GPS. The estimate must land on the GPS distance
        // across the whole range the M21's count can be in (it showed 0.47 km at the old 0.65 m).
        for (steps in 715L..731L) {
            assertEquals("steps=$steps", 0.31, NoGpsDistance.estimateKm(steps, 97)!!, 1e-9)
        }
    }

    @Test
    fun walkingCadenceUsesWalkingStep() {
        assertEquals(0.43, NoGpsDistance.estimateKm(1000, 110)!!, 1e-9)
        // No cadence (too short to compute one) is treated as walking — the shorter, safer guess.
        assertEquals(0.43, NoGpsDistance.estimateKm(1000, null)!!, 1e-9)
    }

    @Test
    fun runningCadenceUsesRunningStride() {
        assertEquals(5.0, NoGpsDistance.estimateKm(5000, 170)!!, 1e-9)
        assertEquals(1.0, NoGpsDistance.estimateKm(1000, NoGpsDistance.RUNNING_CADENCE_SPM)!!, 1e-9)
    }

    @Test
    fun estimateIsCappedAtTheServerMaximum() {
        assertEquals(NoGpsDistance.MAX_KM, NoGpsDistance.estimateKm(10_000_000, 180)!!, 1e-9)
    }

    @Test
    fun validityMirrorsTheServerBounds() {
        assertFalse(NoGpsDistance.isValid(null))
        assertFalse(NoGpsDistance.isValid(0.0))
        assertFalse(NoGpsDistance.isValid(0.09))
        assertTrue(NoGpsDistance.isValid(0.1))
        assertTrue(NoGpsDistance.isValid(500.0))
        assertFalse(NoGpsDistance.isValid(500.01))
    }
}
