package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The background-retry rules (NATRUN-07.2) that live in the recorder/outbox: a slot the runner
 * asked to save keeps their exact body, and a background success clears it like a foreground save.
 */
class RunSyncTest {

    private lateinit var outbox: RunOutbox

    @Before
    fun setUp() {
        RunRecorder.reset()
        outbox = RunOutbox(SyncFakeContext(createTempDir(prefix = "run-sync")))
        RunRecorder.attachOutbox(outbox)
        RunRecorder.setOwner("user-a")
    }

    @After
    fun tearDown() {
        RunRecorder.reset()
        RunRecorder.setOwner(null)
    }

    private fun fullRequest(clientId: String) = CreateRunRequest(
        clientId = clientId, startedAt = "2026-08-16T08:00:00Z", distanceKm = 5.0, durationSeconds = 1500,
        perceivedEffort = 8, title = "Tempo", notes = "felt strong", isPublic = true,
    )

    @Test
    fun `markSaveRequested stores the full body and the recorder snapshot leaves it alone`() {
        assertTrue(RunRecorder.start())
        val clientId = RunRecorder.clientId
        RunRecorder.finish()
        assertTrue(RunRecorder.markSaveRequested(fullRequest(clientId)))

        // A later periodic snapshot must not replace the runner's request with recorder defaults.
        RunRecorder.snapshot(force = true)
        val slot = outbox.load("user-a")!!
        assertTrue(slot.saveRequested)
        assertEquals("Tempo", slot.request.title)
        assertEquals(8, slot.request.perceivedEffort)
        assertEquals(true, slot.request.isPublic)
    }

    @Test
    fun `a background success clears the slot, resets the recorder and signals the run id`() {
        assertTrue(RunRecorder.start())
        val clientId = RunRecorder.clientId
        RunRecorder.finish()
        RunRecorder.markSaveRequested(fullRequest(clientId))

        RunRecorder.onSyncedInBackground(clientId, "run-123", "user-a")
        assertNull(outbox.load("user-a"))
        assertEquals(RecordingStatus.Idle, RunRecorder.state.value.status)
        assertEquals("run-123", RunRecorder.syncedRunIds.value[clientId])
    }

    @Test
    fun `an older slot without the flag reads as not requested`() {
        // Written by a build before saveRequested existed: kotlinx defaults it to false.
        outbox.save(PendingRun(request = fullRequest("old"), finished = true, updatedAtEpochMs = 0, ownerUserId = "user-a"))
        assertEquals(false, outbox.load("user-a")!!.saveRequested)
    }
}

private class SyncFakeContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}
