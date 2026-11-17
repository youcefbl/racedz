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

    @Test
    fun parseInputAcceptsOnlyOnePlainNumber() {
        val cases = listOf(
            // Accepted
            "0.31" to 0.31,
            "0,31" to 0.31,
            " 0,31 " to 0.31,           // whitespace around the number only
            "\u00A00.31\t" to 0.31,     // incl. no-break space / tab from a paste
            "٠٫٣١" to 0.31,             // Arabic-Indic digits + Arabic decimal separator
            "٠،٣١" to 0.31,             // Arabic comma, as some keyboards give it
            "۰.۳۱" to 0.31,             // Extended Arabic-Indic (Persian/Urdu) digits
            "12" to 12.0,
            "١٢" to 12.0,
            ".5" to 0.5,
            "5." to 5.0,
            // Rejected — each of these used to be silently reinterpreted
            "0 31" to null,             // was 031 → 31 km
            "0, 31" to null,
            "1 000" to null,
            "1٬000" to null,            // Arabic thousands separator
            "0.3.1" to null,
            "0,3,1" to null,
            "0.3,1" to null,
            "0,31a" to null,
            "0,31M21 no" to null,       // was 0.3121
            "-0.5" to null,
            "+1" to null,
            "1e3" to null,
            "" to null,
            "   " to null,
            "." to null,
            "," to null,
        )
        for ((input, expected) in cases) {
            val actual = NoGpsDistance.parseInput(input)
            if (expected == null) assertNull("\"$input\"", actual)
            else assertEquals("\"$input\"", expected, actual!!, 1e-9)
        }
    }

    @Test
    fun movingTimeIsSteppingTimeCappedAtTheRecording() {
        assertEquals(447, NoGpsDistance.movingSeconds(447, 447))
        assertEquals(400, NoGpsDistance.movingSeconds(500, 400))
        assertNull(NoGpsDistance.movingSeconds(0, 400))
    }

    @Test
    fun paceMatchesWhatTheServerWillStore() {
        // The calibration walk as saved: 447 s over 0.31 km → 24:02 /km on the run detail.
        assertEquals(1442, NoGpsDistance.paceSecondsPerKm(0.31, 447, 447))
        // No moving time → the whole duration, like the server.
        assertEquals(1500, NoGpsDistance.paceSecondsPerKm(0.4, null, 600))
        assertNull(NoGpsDistance.paceSecondsPerKm(null, 447, 447))
        assertNull(NoGpsDistance.paceSecondsPerKm(0.0, 447, 447))
    }
}
