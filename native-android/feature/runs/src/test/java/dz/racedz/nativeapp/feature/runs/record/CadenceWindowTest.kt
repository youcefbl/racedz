package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Live cadence must be honest: null until it knows, null again the moment the feet stop. */
class CadenceWindowTest {

    @Test
    fun `nothing until enough time and steps`() {
        val w = CadenceWindow()
        w.add(0, 0)
        w.add(5_000, 14)
        assertNull(w.cadenceSpm(5_000)) // 5 s span < 10 s minimum
        w.add(11_000, 30)
        assertEquals(163, w.cadenceSpm(11_000)) // 30 steps over 11 s
    }

    @Test
    fun `steady 170 spm reads as about 170`() {
        val w = CadenceWindow()
        // 170/min = 17 steps every 6 s; readings every 6 s over a minute.
        var steps = 0L
        for (t in 0..60_000 step 6_000) {
            w.add(t.toLong(), steps)
            steps += 17
        }
        val spm = w.cadenceSpm(60_000)!!
        assert(spm in 168..172) { "got $spm" }
    }

    @Test
    fun `goes blank once the counter falls silent`() {
        val w = CadenceWindow()
        var steps = 0L
        for (t in 0..20_000 step 1_000) { w.add(t.toLong(), steps); steps += 3 }
        assertEquals(180, w.cadenceSpm(20_000))
        assertNull(w.cadenceSpm(20_000 + CadenceWindow.STALE_MS + 1))
    }

    @Test
    fun `window forgets old rhythm`() {
        val w = CadenceWindow()
        var steps = 0L
        for (t in 0..30_000 step 1_000) { w.add(t.toLong(), steps); steps += 2 } // 120 spm
        for (t in 31_000..60_000 step 1_000) { w.add(t.toLong(), steps); steps += 3 } // 180 spm
        assertEquals(180, w.cadenceSpm(60_000))
    }

    @Test
    fun `a counter that went backwards is ignored`() {
        val w = CadenceWindow()
        w.add(0, 100)
        w.add(12_000, 140)
        w.add(13_000, 20) // reboot mid-run
        assertEquals(200, w.cadenceSpm(13_000))
    }
}
