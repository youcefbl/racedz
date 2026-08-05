package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.core.network.RoutePointDto
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/**
 * "Log this run" on the coach's plan has to reach the saved run as `workoutId`.
 *
 * It is the least visible thing in the whole flow: without it the run still records, still saves,
 * and still looks right — it simply never counts toward the session it was run for, and the
 * runner's adherence quietly depends on the server's after-the-fact matcher instead of on what they
 * actually told the app. Nothing on screen says the link was dropped, which is exactly why it needs
 * a test rather than a look.
 */
class WorkoutHandoffTest {

    private lateinit var root: File
    private lateinit var outbox: RunOutbox

    @Before
    fun setUp() {
        root = createTempDir(prefix = "workout-handoff-test")
        outbox = RunOutbox(HandoffContext(root))
    }

    @After
    fun tearDown() {
        root.deleteRecursively()
    }

    private fun pending(request: CreateRunRequest) =
        PendingRun(request = request, finished = true, updatedAtEpochMs = 1_785_000_100_000, ownerUserId = TEST_OWNER)

    private fun recording(workoutId: String?) = RecordingState(
        status = RecordingStatus.Finished,
        clientId = "c-handoff",
        startedAtEpochMs = 1_785_000_000_000,
        distanceMeters = 4_000.0,
        elapsedSeconds = 1_500,
        movingSeconds = 1_450,
        route = listOf(
            RoutePointDto(36.75, 3.06, 40.0, 1_785_000_000_000),
            RoutePointDto(36.76, 3.07, 42.0, 1_785_000_060_000),
        ),
        workoutId = workoutId,
    )

    @Test
    fun `a run started from a planned session carries its workout id into the request`() {
        with(RunRecorder) {
            assertEquals("w-123", recording("w-123").toCreateRequest().workoutId)
        }
    }

    @Test
    fun `a free run carries no workout id`() {
        with(RunRecorder) {
            assertNull(recording(null).toCreateRequest().workoutId)
        }
    }

    /**
     * The link has to survive the app being killed mid-run.
     *
     * The outbox restores from the stored *request*, so if `workoutId` were held only in memory the
     * run would come back after a crash detached from its session — the one case where losing the
     * link is least visible and most annoying to reconstruct.
     */
    @Test
    fun `the workout id survives a round trip through the outbox`() {
        val request = with(RunRecorder) { recording("w-456").toCreateRequest() }
        outbox.save(pending(request))

        val restored = outbox.load(TEST_OWNER)
        assertEquals("w-456", restored?.request?.workoutId)

        RunRecorder.resumeFinished(restored!!)
        assertEquals("w-456", RunRecorder.state.value.workoutId)
        RunRecorder.reset()
    }

    /** A request built by hand (the outbox's own fixture path) still round-trips its id. */
    @Test
    fun `a create request serialises its workout id`() {
        val request = CreateRunRequest(
            clientId = "c-1",
            startedAt = "2026-08-01T08:00:00Z",
            distanceKm = 4.0,
            durationSeconds = 1_500,
            perceivedEffort = 5,
            workoutId = "w-789",
        )
        outbox.save(pending(request))
        assertEquals("w-789", outbox.load(TEST_OWNER)?.request?.workoutId)
    }
}

/** Minimal Context so [RunOutbox] can pick a files directory without an Android runtime. */
private class HandoffContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}

private const val TEST_OWNER = "user-a"
