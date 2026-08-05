package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
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
    fun `start is refused while an unresolved run sits on disk`() {
        // RED-R01: after process death the singleton restarts Idle, but the outbox still holds the
        // interrupted run. An Idle memory state alone must not make Record available — the one-file
        // outbox would overwrite that run on the next recording's first snapshot.
        val outbox = RunOutbox(GuardFakeContext(createTempDir(prefix = "recorder-guard")))
        RunRecorder.attachOutbox(outbox)
        outbox.save(PendingRun(request = sampleRequest("interrupted-1"), finished = false, updatedAtEpochMs = 1L))

        assertFalse(RunRecorder.start())

        // The interrupted run is restorable (no `finished` filter) and salvages as Finished,
        // carrying its own clientId so a save retries idempotently.
        val pending = RunRecorder.restorePending()
        assertNotNull(pending)
        RunRecorder.resumeFinished(pending!!)
        assertEquals(RecordingStatus.Finished, RunRecorder.state.value.status)
        assertEquals("interrupted-1", RunRecorder.state.value.clientId)

        // An explicit discard resolves the outbox, and only then does Record work again.
        RunRecorder.reset()
        assertFalse(outbox.hasPending())
        assertTrue(RunRecorder.start())
    }

    @Test
    fun `a finished run on disk also blocks start until resolved`() {
        val outbox = RunOutbox(GuardFakeContext(createTempDir(prefix = "recorder-guard")))
        RunRecorder.attachOutbox(outbox)
        outbox.save(PendingRun(request = sampleRequest("finished-1"), finished = true, updatedAtEpochMs = 1L))

        assertFalse(RunRecorder.start())
        assertEquals("finished-1", RunRecorder.restorePending()?.request?.clientId)

        RunRecorder.reset()
        assertTrue(RunRecorder.start())
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

private fun sampleRequest(clientId: String) = CreateRunRequest(
    clientId = clientId,
    startedAt = "2026-08-04T10:00:00Z",
    distanceKm = 1.2,
    durationSeconds = 420,
    perceivedEffort = 5,
)

private class GuardFakeContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}
