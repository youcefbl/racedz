package dz.racedz.nativeapp.feature.runs.record

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * NDP-R05: `start()` must never replace an existing recording. Before the guard, any stray call —
 * a deep link into the start screen, a stale back stack, a double navigation — cleared the route
 * and minted a new clientId, silently destroying the run in progress.
 */
class RunRecorderStartGuardTest {

    @Before
    fun reset() {
        RunRecorder.reset()
    }

    @After
    fun cleanUp() {
        RunRecorder.reset()
    }

    @Test
    fun `start from idle succeeds`() {
        assertTrue(RunRecorder.start())
        assertEquals(RecordingStatus.Acquiring, RunRecorder.state.value.status)
    }

    @Test
    fun `start is refused while a recording is active and preserves it`() {
        assertTrue(RunRecorder.start(workoutId = "workout-1"))
        val active = RunRecorder.state.value

        assertFalse(RunRecorder.start())

        val after = RunRecorder.state.value
        assertEquals(active.clientId, after.clientId)
        assertEquals("workout-1", after.workoutId)
        assertEquals(RecordingStatus.Acquiring, after.status)
    }

    @Test
    fun `start is refused while paused`() {
        assertTrue(RunRecorder.start())
        // Pause only applies from Recording/Acquiring; Acquiring qualifies.
        RunRecorder.pause()
        assertEquals(RecordingStatus.Paused, RunRecorder.state.value.status)

        assertFalse(RunRecorder.start())
        assertEquals(RecordingStatus.Paused, RunRecorder.state.value.status)
    }

    @Test
    fun `start is refused while a finished run awaits save`() {
        assertTrue(RunRecorder.start())
        RunRecorder.finish()
        assertEquals(RecordingStatus.Finished, RunRecorder.state.value.status)
        val pendingClientId = RunRecorder.state.value.clientId

        assertFalse(RunRecorder.start())
        assertEquals(RecordingStatus.Finished, RunRecorder.state.value.status)
        assertEquals(pendingClientId, RunRecorder.state.value.clientId)
    }

    @Test
    fun `start succeeds again after an explicit discard`() {
        assertTrue(RunRecorder.start())
        RunRecorder.finish()
        RunRecorder.reset()

        assertTrue(RunRecorder.start())
        assertEquals(RecordingStatus.Acquiring, RunRecorder.state.value.status)
    }
}
