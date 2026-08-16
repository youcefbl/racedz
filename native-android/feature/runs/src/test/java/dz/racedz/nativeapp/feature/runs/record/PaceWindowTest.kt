package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The live pace is a rolling window, not the last fix's speed. What matters: it settles, it does
 * not lag a whole run behind, and it goes blank when the runner has stopped rather than freezing on
 * the last stride.
 */
class PaceWindowTest {

    @Test
    fun `empty window has no pace`() {
        assertNull(PaceWindow().paceSecondsPerKm(nowMs = 10_000))
    }

    @Test
    fun `steady 5 min per km reads as 300`() {
        val window = PaceWindow()
        // 3.333 m/s = 5:00/km, one fix a second.
        var t = 1_000L
        repeat(10) {
            window.add(t, 3.333, 1.0)
            t += 1_000
        }
        assertEquals(300, window.paceSecondsPerKm(t))
    }

    @Test
    fun `one jittery fix does not swing the reading`() {
        val window = PaceWindow()
        var t = 1_000L
        repeat(10) {
            window.add(t, 3.333, 1.0)
            t += 1_000
        }
        // A single fix at 6 m/s (2:47/km) — a Doppler blip.
        window.add(t, 6.0, 1.0)
        val pace = window.paceSecondsPerKm(t)!!
        // Smoothed over ~12 s: well within 5:00 ± 30 s, nowhere near 2:47.
        assertTrue("pace $pace", pace in 260..300)
    }

    @Test
    fun `only the last twelve seconds count`() {
        val window = PaceWindow()
        var t = 1_000L
        // A slow 20 s at 8:20/km ...
        repeat(20) {
            window.add(t, 2.0, 1.0)
            t += 1_000
        }
        // ... then 15 s at 5:00/km. The slow stretch has left the window.
        repeat(15) {
            window.add(t, 3.333, 1.0)
            t += 1_000
        }
        assertEquals(300, window.paceSecondsPerKm(t))
    }

    @Test
    fun `reading goes stale after the moving gap`() {
        val window = PaceWindow()
        window.add(1_000, 3.333, 1.0)
        window.add(2_000, 3.333, 1.0)
        assertEquals(300, window.paceSecondsPerKm(2_500))
        // 15 s later with nothing accepted: the runner stopped.
        assertNull(window.paceSecondsPerKm(2_000 + 16_000))
    }

    @Test
    fun `clear forgets everything`() {
        val window = PaceWindow()
        window.add(1_000, 3.333, 1.0)
        window.clear()
        assertNull(window.paceSecondsPerKm(1_500))
    }
}
