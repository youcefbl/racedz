package dz.racedz.nativeapp.feature.runs.record

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Cadence is how the server tells a run from a ride, so what the recorder measures has to be right.
 *
 * The step counter reports cumulatively since boot, and the run wants only the steps taken while it
 * was actually recording — not the ones before it started, and not the ones during a pause. Getting
 * that wrong would either invent cadence a stationary phone never produced or count a bus ride's
 * jostle as strides, which is the exact failure this whole feature exists to catch.
 */
class CadenceTest {

    @Before
    fun setUp() = RunRecorder.reset()

    @After
    fun tearDown() = RunRecorder.reset()

    @Test
    fun `average cadence is steps per minute over moving time`() {
        // 1500 steps over 600 moving seconds (10 min) = 150 spm.
        val state = RecordingState(stepCount = 1_500, movingSeconds = 600)
        assertEquals(150, state.avgCadenceSpm)
    }

    @Test
    fun `too short a run has no cadence yet`() {
        assertNull(RecordingState(stepCount = 40, movingSeconds = 20).avgCadenceSpm)
        assertNull(RecordingState(stepCount = 0, movingSeconds = 600).avgCadenceSpm)
    }

    @Test
    fun `cadence rides into the create request`() {
        val request = with(RunRecorder) {
            RecordingState(stepCount = 1_500, movingSeconds = 600).toCreateRequest()
        }
        assertEquals(150, request.avgCadence)
    }

    @Test
    fun `steps accumulate only the delta while recording`() {
        RunRecorder.start()
        RunRecorder.onSteps(1_000) // first reading is the baseline, counts nothing
        RunRecorder.onSteps(1_050) // +50
        RunRecorder.onSteps(1_090) // +40
        assertEquals(90L, RunRecorder.state.value.stepCount)
    }

    @Test
    fun `steps taken during a pause are not counted`() {
        RunRecorder.start()
        RunRecorder.onSteps(1_000)
        RunRecorder.onSteps(1_050) // +50 while recording
        RunRecorder.pause()
        RunRecorder.onSteps(1_200) // walked around while paused — ignored
        RunRecorder.resume()
        RunRecorder.onSteps(1_260) // re-baseline after resume, counts nothing
        RunRecorder.onSteps(1_280) // +20
        assertEquals(70L, RunRecorder.state.value.stepCount)
    }

    @Test
    fun `a reboot mid-run rebaselines instead of going negative`() {
        RunRecorder.start()
        RunRecorder.onSteps(5_000)
        RunRecorder.onSteps(5_100) // +100
        RunRecorder.onSteps(30)    // counter reset by a reboot: new baseline, no negative delta
        RunRecorder.onSteps(80)    // +50
        assertEquals(150L, RunRecorder.state.value.stepCount)
    }

    @Test
    fun `cadence uses stepping time, not GPS moving time`() {
        // The 2026-11-15 M21 walk: GPS was unusable for much of it, so it counted only 331 moving
        // seconds while the runner kept walking. 1,171 steps over 331 s reported 212 spm.
        val state = RecordingState(stepCount = 1_171, movingSeconds = 331, steppingSeconds = 610)
        assertEquals(115, state.avgCadenceSpm)
    }

    @Test
    fun `steady readings count as stepping time`() {
        RunRecorder.start()
        var t = 1_000_000L
        RunRecorder.onSteps(10_000, t) // baseline
        // 10 minutes of walking at 120 spm, a reading every 5 s (10 steps each).
        repeat(120) { i ->
            t += 5_000
            RunRecorder.onSteps(10_000L + (i + 1) * 10, t)
        }
        assertEquals(600, RunRecorder.state.value.steppingSeconds)
        assertEquals(1_200L, RunRecorder.state.value.stepCount)
        assertEquals(120, RunRecorder.state.value.avgCadenceSpm)
    }

    @Test
    fun `a long stop does not dilute cadence`() {
        RunRecorder.start()
        var t = 1_000_000L
        RunRecorder.onSteps(0, t)
        repeat(60) { i -> t += 5_000; RunRecorder.onSteps((i + 1) * 10L, t) } // 5 min at 120 spm
        t += 7 * 60_000L // stood still for 7 minutes, then 4 steps arrive in one late reading
        RunRecorder.onSteps(604, t)
        repeat(60) { i -> t += 5_000; RunRecorder.onSteps(604L + (i + 1) * 10, t) } // 5 more minutes
        // 1,204 steps over 600 s of walking + 4 s credited for the late reading: still ~120 spm.
        assertEquals(604, RunRecorder.state.value.steppingSeconds)
        assertEquals(119, RunRecorder.state.value.avgCadenceSpm)
    }

    @Test
    fun `stepping credit is the whole gap when short, one second per step when long`() {
        assertEquals(5_000L, RunRecorder.steppingCreditMs(5_000, 10))
        assertEquals(30_000L, RunRecorder.steppingCreditMs(420_000, 30))
        assertEquals(15_000L, RunRecorder.steppingCreditMs(15_000, 100))
    }
}
