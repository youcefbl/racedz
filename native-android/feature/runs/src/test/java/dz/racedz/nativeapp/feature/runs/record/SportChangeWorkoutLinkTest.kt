package dz.racedz.nativeapp.feature.runs.record

import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Review P2 (2026-11-17): changing the activity on the summary must never lose the planned workout.
 * A ride is posted without it; switching back to Run or Trail posts it again.
 */
class SportChangeWorkoutLinkTest {

    @Before
    fun setUp() {
        RunRecorder.attachOutbox(RunOutbox(LinkFakeContext(createTempDir(prefix = "sport-link"))))
        RunRecorder.setOwner("user-a")
        RunRecorder.reset()
    }

    @After
    fun tearDown() {
        RunRecorder.reset()
        RunRecorder.setOwner(null)
    }

    private fun finishedGuidedRun() {
        RunRecorder.start(workoutId = "w-1", sport = "RUN")
        RunRecorder.finish()
    }

    @Test
    fun `run to ride to run keeps the workout link`() {
        finishedGuidedRun()
        with(RunRecorder) {
            setSport("RIDE")
            assertNull(state.value.toCreateRequest().workoutId)
            assertEquals("w-1", state.value.workoutId)
            setSport("RUN")
            assertEquals("w-1", state.value.toCreateRequest().workoutId)
            setSport("TRAIL")
            assertEquals("w-1", state.value.postedWorkoutId)
        }
    }

    @Test
    fun `the link survives a restore taken while set to ride`() {
        finishedGuidedRun()
        RunRecorder.setSport("RIDE")
        // Drop the in-memory run the way a new process starts empty; the outbox keeps the snapshot.
        RunRecorder.setOwner(null)
        RunRecorder.setOwner("user-a")
        val pending = RunRecorder.restorePending()
        assertNotNull(pending)
        assertNull(pending!!.request.workoutId)
        RunRecorder.resumeFinished(pending)
        assertEquals("RIDE", RunRecorder.state.value.sport)
        RunRecorder.setSport("RUN")
        assertEquals("w-1", with(RunRecorder) { state.value.toCreateRequest().workoutId })
    }
}

private class LinkFakeContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}
