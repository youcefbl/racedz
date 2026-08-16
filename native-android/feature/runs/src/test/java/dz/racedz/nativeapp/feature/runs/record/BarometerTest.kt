package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Barometric climb (NATRUN-07.6): flat stays flat, real climb counts, descents do not. */
class BarometerTest {

    @Test
    fun `sensor jitter on a flat road adds no climb`() {
        val b = Barometer()
        var toggle = 0.0
        repeat(200) {
            toggle = if (toggle == 0.0) 0.03 else 0.0 // ±0.03 hPa ≈ ±0.25 m
            b.add(1013.25 + toggle)
        }
        assertTrue(b.ready)
        assertEquals(0.0, b.gainM, 0.01)
    }

    @Test
    fun `a ten metre climb reads as about ten metres, a descent as zero`() {
        val b = Barometer()
        // 1 hPa ≈ 8.3 m near sea level; drop 1.2 hPa over 60 samples = ~10 m up.
        var p = 1013.25
        repeat(10) { b.add(p) }
        repeat(60) { p -= 0.02; b.add(p) }
        repeat(40) { b.add(p) } // let the filter settle at the top
        assertTrue("gain ${b.gainM}", b.gainM in 8.5..11.5)
        val atTop = b.gainM
        repeat(60) { p += 0.02; b.add(p) } // back down
        repeat(40) { b.add(p) }
        assertEquals(atTop, b.gainM, 0.01)
    }

    @Test
    fun `absolute altitude needs an anchor and reset forgets everything`() {
        val b = Barometer()
        repeat(6) { b.add(1000.0) }
        assertNull(b.absoluteAltitudeM)
        b.anchor = 250.0
        assertEquals(250.0, b.absoluteAltitudeM!!, 0.01)
        b.reset()
        assertEquals(0, b.samples)
        assertNull(b.absoluteAltitudeM)
    }

    @Test
    fun `garbage samples are ignored`() {
        val b = Barometer()
        b.add(Double.NaN); b.add(0.0); b.add(5000.0)
        assertEquals(0, b.samples)
    }
}
