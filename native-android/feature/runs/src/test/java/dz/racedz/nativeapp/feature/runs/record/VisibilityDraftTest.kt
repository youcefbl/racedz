package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The visibility chosen on the summary screen must reach the server exactly once chosen — through
 * a first save, a retry, and a restore from the outbox — and must never publish a flagged run.
 */
class VisibilityDraftTest {

    @Before
    fun setUp() = RunRecorder.reset()

    @After
    fun tearDown() = RunRecorder.reset()

    @Test
    fun `private by default`() {
        val request = with(RunRecorder) { RecordingState(distanceMeters = 3000.0, movingSeconds = 900).toCreateRequest() }
        assertEquals(false, request.isPublic)
    }

    @Test
    fun `chosen visibility rides into the request`() {
        val request = with(RunRecorder) {
            RecordingState(distanceMeters = 3000.0, movingSeconds = 900, draftIsPublic = true).toCreateRequest()
        }
        assertEquals(true, request.isPublic)
    }

    @Test
    fun `a non-foot recording is never posted public`() {
        // 1 km in 100 s of moving time is 1:40/km — the server's IMPOSSIBLE_PACE rule.
        val state = RecordingState(distanceMeters = 1000.0, movingSeconds = 100, draftIsPublic = true)
        assertEquals(GpsQuality.NonFootReason.Speed, state.nonFootReason)
        val request = with(RunRecorder) { state.toCreateRequest() }
        assertEquals(false, request.isPublic)
    }

    @Test
    fun `setDraftVisibility updates the live state and a restored pending run keeps it`() {
        RunRecorder.start()
        assertFalse(RunRecorder.state.value.draftIsPublic)
        RunRecorder.setDraftVisibility(true)
        assertTrue(RunRecorder.state.value.draftIsPublic)

        // What the outbox would hand back after a process death.
        val pending = PendingRun(
            request = CreateRunRequest(
                clientId = "c1",
                startedAt = "2026-08-16T08:00:00Z",
                distanceKm = 5.0,
                durationSeconds = 1500,
                perceivedEffort = 5,
                isPublic = true,
            ),
            finished = true,
            updatedAtEpochMs = 0,
            ownerUserId = null,
        )
        RunRecorder.reset()
        RunRecorder.resumeFinished(pending)
        assertTrue(RunRecorder.state.value.draftIsPublic)
        assertEquals(true, with(RunRecorder) { RunRecorder.state.value.toCreateRequest() }.isPublic)
    }
}
