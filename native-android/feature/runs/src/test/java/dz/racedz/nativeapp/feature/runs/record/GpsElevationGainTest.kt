package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GpsElevationGainTest {

    private fun gain(altitudes: List<Double>): Double = GpsElevationGain().let { g -> altitudes.forEach(g::add); g.gainM }

    @Test
    fun flatGroundWithGpsJitterIsNotClimb() {
        val random = java.util.Random(7)
        // Fix-to-fix jitter of 1 m (what the M21 mock runs used) and 3 m. The old rule read these
        // ~10-minute flat runs as 129 m and 490 m of climb. (Slowly drifting altitude still reads
        // as some climb — it is indistinguishable from terrain; the server's DEM fixes that.)
        for (sigma in listOf(1.0, 3.0)) {
            val flat = List(300) { 280.0 + random.nextGaussian() * sigma }
            assertTrue("sigma=$sigma gave ${gain(flat)}", gain(flat) < 6.0)
        }
    }

    @Test
    fun aRealClimbIsCounted() {
        val random = kotlin.random.Random(3)
        // 40 m up over 120 fixes, then 40 m down, with ±1 m jitter.
        val up = List(120) { 280.0 + 40.0 * it / 119 + random.nextDouble(-1.0, 1.0) }
        val down = List(120) { 320.0 - 40.0 * it / 119 + random.nextDouble(-1.0, 1.0) }
        assertEquals(40.0, gain(up + down), 6.0)
    }

    @Test
    fun gentleHillsAreCountedNotLost() {
        // Three 20 m hills at a third of a metre per fix. The old rule (rises > 1 m between counted
        // points) read this as 0 m. Counting in 5 m steps loses a little at each top, like the
        // server's rule does.
        val hill = List(60) { 280.0 + 20.0 * it / 59 } + List(60) { 300.0 - 20.0 * it / 59 }
        val total = gain(hill + hill + hill)
        assertTrue("got $total", total in 40.0..62.0)
    }

    @Test
    fun resetStartsOver() {
        val g = GpsElevationGain()
        List(60) { 280.0 + it }.forEach(g::add)
        assertTrue(g.gainM > 40)
        g.reset()
        assertEquals(0.0, g.gainM, 0.0)
        g.add(500.0)
        assertEquals(0.0, g.gainM, 0.0)
    }
}
