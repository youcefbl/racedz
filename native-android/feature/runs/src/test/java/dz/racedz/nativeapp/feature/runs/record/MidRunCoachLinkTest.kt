package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * Coach questions asked mid-run must reach the server at save so it can link them to the run.
 *
 * A run has no server id while it is being recorded, so the link cannot be made at ask time; the
 * ids are buffered on the recording and sent with the create request. If that buffer were lost — to
 * a dedupe, a reset, or a process kill before save — the question would stay a general chat, quietly
 * detached from the run it was asked on, which is the whole thing this feature is meant to prevent.
 */
class MidRunCoachLinkTest {

    private lateinit var root: File
    private lateinit var outbox: RunOutbox

    @Before
    fun setUp() {
        RunRecorder.reset()
        root = createTempDir(prefix = "coach-link-test")
        outbox = RunOutbox(CoachLinkContext(root))
    }

    @After
    fun tearDown() {
        RunRecorder.reset()
        root.deleteRecursively()
    }

    @Test
    fun `asked interactions buffer in order and dedupe`() {
        RunRecorder.start()
        RunRecorder.recordCoachInteraction("i-1")
        RunRecorder.recordCoachInteraction("i-2")
        RunRecorder.recordCoachInteraction("i-1") // a retry of the same ask must not double up
        RunRecorder.recordCoachInteraction("")     // blank is ignored
        assertEquals(listOf("i-1", "i-2"), RunRecorder.state.value.askedCoachIds)
    }

    @Test
    fun `buffered ids ride into the create request`() {
        RunRecorder.start()
        RunRecorder.recordCoachInteraction("i-1")
        RunRecorder.recordCoachInteraction("i-2")
        val request = with(RunRecorder) { RunRecorder.state.value.toCreateRequest() }
        assertEquals(listOf("i-1", "i-2"), request.coachInteractionIds)
    }

    @Test
    fun `a run with no mid-run coaching sends no ids`() {
        RunRecorder.start()
        val request = with(RunRecorder) { RunRecorder.state.value.toCreateRequest() }
        assertNull(request.coachInteractionIds)
    }

    @Test
    fun `the ids survive a round trip through the outbox`() {
        val request = CreateRunRequest(
            clientId = "c-coach",
            startedAt = "2026-08-08T08:00:00Z",
            distanceKm = 3.0,
            durationSeconds = 1_200,
            perceivedEffort = 5,
            movingTimeSeconds = 1_180,
            coachInteractionIds = listOf("i-7", "i-8"),
        )
        outbox.save(PendingRun(request = request, finished = true, updatedAtEpochMs = 1_785_000_100_000, ownerUserId = OWNER))

        val restored = outbox.load(OWNER)
        assertEquals(listOf("i-7", "i-8"), restored?.request?.coachInteractionIds)

        RunRecorder.resumeFinished(restored!!)
        assertEquals(listOf("i-7", "i-8"), RunRecorder.state.value.askedCoachIds)
        // And re-saving that restored run still carries them.
        val resent = with(RunRecorder) { RunRecorder.state.value.toCreateRequest() }
        assertEquals(listOf("i-7", "i-8"), resent.coachInteractionIds)
    }

    @Test
    fun `reset clears the buffer`() {
        RunRecorder.start()
        RunRecorder.recordCoachInteraction("i-1")
        RunRecorder.reset()
        RunRecorder.start()
        assertEquals(emptyList<String>(), RunRecorder.state.value.askedCoachIds)
    }
}

private class CoachLinkContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}

private const val OWNER = "user-coach"
