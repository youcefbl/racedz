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
}
