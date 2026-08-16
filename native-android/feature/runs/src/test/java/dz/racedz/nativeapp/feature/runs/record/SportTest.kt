package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

/** Sport type (NATRUN-07.1): a ride is never flagged non-foot, and the choice survives the outbox. */
class SportTest {

    @Before
    fun setUp() = RunRecorder.reset()

    @After
    fun tearDown() = RunRecorder.reset()

    @Test
    fun `a ride at car speed is not flagged, a run is`() {
        val ride = RecordingState(distanceMeters = 5000.0, movingSeconds = 500, sport = "RIDE")
        assertNull(ride.nonFootReason)
        val run = RecordingState(distanceMeters = 5000.0, movingSeconds = 500, sport = "RUN")
        assertNotNull(run.nonFootReason)
    }

    @Test
    fun `sport rides in the request and back through a restored pending run`() {
        val request = with(RunRecorder) { RecordingState(distanceMeters = 3000.0, movingSeconds = 900, sport = "TRAIL").toCreateRequest() }
        assertEquals("TRAIL", request.sport)
        RunRecorder.resumeFinished(
            PendingRun(
                request = CreateRunRequest(clientId = "c", startedAt = "2026-08-16T08:00:00Z", distanceKm = 3.0, durationSeconds = 900, perceivedEffort = 5, sport = "WALK"),
                finished = true, updatedAtEpochMs = 0, ownerUserId = null,
            )
        )
        assertEquals("WALK", RunRecorder.state.value.sport)
    }

    @Test
    fun `start records the chosen sport and defaults to run`() {
        RunRecorder.start(sport = "RIDE")
        assertEquals("RIDE", RunRecorder.state.value.sport)
        RunRecorder.reset()
        RunRecorder.start()
        assertEquals("RUN", RunRecorder.state.value.sport)
    }
}
