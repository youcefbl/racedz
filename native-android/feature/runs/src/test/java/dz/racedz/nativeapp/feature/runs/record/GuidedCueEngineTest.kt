package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.GuidedStepDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The cue engine's timing rules.
 *
 * Worth unit-testing rather than checking on a device: every rule here is "fires exactly once, at
 * this moment", and the failure mode is a cue repeating every tick for a whole minute — which a
 * short manual run either never reaches or is drowned by. These conditions are also the part most
 * likely to be broken by a later edit.
 */
class GuidedCueEngineTest {

    private fun work(seconds: Int? = null, meters: Int? = null, rep: Int? = null, total: Int? = null) =
        GuidedStepDto(index = 1, total = 3, role = "WORK", intensity = "HARD", seconds = seconds, meters = meters, repCurrent = rep, repTotal = total)

    private fun steady(seconds: Int? = null, meters: Int? = null) =
        GuidedStepDto(index = 1, total = 3, role = "STEADY", intensity = "EASY", seconds = seconds, meters = meters)

    @Test
    fun `one minute left fires once, not on every tick`() {
        val engine = GuidedCueEngine()
        val step = work(seconds = 300)
        // Before the last minute: nothing.
        assertTrue(engine.onTick(step, 200, 0.0, 200).none { it == GuidedCueEngine.Cue.OneMinuteLeft })
        // Entering the last minute: once.
        assertTrue(engine.onTick(step, 250, 0.0, 250).contains(GuidedCueEngine.Cue.OneMinuteLeft))
        // Every later tick inside the same minute: silent.
        repeat(20) { tick ->
            assertTrue(engine.onTick(step, 251 + tick, 0.0, 251 + tick).none { it == GuidedCueEngine.Cue.OneMinuteLeft })
        }
    }

    @Test
    fun `a step too short for a minute warning never gets one`() {
        val engine = GuidedCueEngine()
        // A 60s rep: "one minute left" at the start would be the whole rep.
        val step = work(seconds = 60)
        repeat(60) { second ->
            assertTrue(engine.onTick(step, second, 0.0, second).none { it == GuidedCueEngine.Cue.OneMinuteLeft })
        }
    }

    @Test
    fun `last rep is announced only on the final rep of a set`() {
        val engine = GuidedCueEngine()
        assertTrue(engine.onTick(work(seconds = 120, rep = 3, total = 6), 5, 0.0, 5).none { it == GuidedCueEngine.Cue.LastRep })

        val fresh = GuidedCueEngine()
        assertTrue(fresh.onTick(work(seconds = 120, rep = 6, total = 6), 5, 0.0, 5).contains(GuidedCueEngine.Cue.LastRep))
    }

    @Test
    fun `last kilometre needs a block longer than three kilometres`() {
        val short = GuidedCueEngine()
        // A 2 km block is entirely inside its own "last kilometre"; the cue would be meaningless.
        assertTrue(short.onTick(steady(meters = 2000), 60, 1500.0, 60).none { it == GuidedCueEngine.Cue.LastKm })

        val long = GuidedCueEngine()
        assertTrue(long.onTick(steady(meters = 5000), 60, 4200.0, 60).contains(GuidedCueEngine.Cue.LastKm))
    }

    @Test
    fun `cues reset when the step changes`() {
        val engine = GuidedCueEngine()
        val first = work(seconds = 300, rep = 6, total = 6)
        assertTrue(engine.onTick(first, 5, 0.0, 5).contains(GuidedCueEngine.Cue.LastRep))

        // A different step index is a different step, so its own cues are eligible again.
        val second = first.copy(index = 2)
        assertTrue(engine.onTick(second, 5, 0.0, 305).contains(GuidedCueEngine.Cue.LastRep))
    }

    @Test
    fun `rep split is emitted for a finished work step and skipped when too short`() {
        val engine = GuidedCueEngine()
        val rep = work(seconds = 120)
        engine.onTick(rep, 0, 0.0, 100) // enters the step at t=100
        val split = engine.onStepChanged(steady(seconds = 60).copy(index = 2), 160)
        assertEquals(60, split?.seconds)

        // A rep shorter than the floor is noise, not information.
        val quick = GuidedCueEngine()
        quick.onTick(rep, 0, 0.0, 100)
        assertNull(quick.onStepChanged(steady(seconds = 60).copy(index = 2), 108))
    }

    @Test
    fun `a free run with no session says nothing`() {
        val engine = GuidedCueEngine()
        assertTrue(engine.onTick(null, 999, 9999.0, 999).isEmpty())
    }
}
