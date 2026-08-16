package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.core.network.LapMarkDto
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Mirrors scripts/test-laps.ts on the server: same boundaries, same derived table. */
class LapMathTest {

    @Before
    fun setUp() = RunRecorder.reset()

    @After
    fun tearDown() = RunRecorder.reset()

    private val marks = listOf(
        LapMarkDto(1200.0, 391),
        LapMarkDto(2000.0, 633),
        LapMarkDto(3650.0, 1184),
    )

    @Test
    fun `derives each lap and the tail to the finish`() {
        val laps = LapMath.derive(marks, 5000.0, 1700)
        assertEquals(4, laps.size)
        assertEquals(LapMath.Lap(1, 1200.0, 391, 326), laps[0])
        assertEquals(LapMath.Lap(2, 800.0, 242, 303), laps[1])
        assertEquals(LapMath.Lap(4, 1350.0, 516, 382), laps[3])
    }

    @Test
    fun `no tail when finish is right after the last press`() {
        assertEquals(1, LapMath.derive(listOf(LapMarkDto(1000.0, 300)), 1002.0, 302).size)
    }

    @Test
    fun `a double tap is refused, a real lap accepted, the cap holds`() {
        assertFalse(LapMath.accepts(LapMarkDto(500.0, 150), 502.0, 151, 1))
        assertTrue(LapMath.accepts(LapMarkDto(500.0, 150), 640.0, 190, 1))
        assertTrue(LapMath.accepts(null, 40.0, 12, 0))
        assertFalse(LapMath.accepts(LapMarkDto(500.0, 150), 640.0, 190, LapMath.MAX_LAPS))
    }

    @Test
    fun `a lap without distance has no pace`() {
        assertNull(LapMath.derive(listOf(LapMarkDto(3.0, 60)), 5000.0, 1700)[0].paceSecondsPerKm)
    }

    @Test
    fun `laps ride into the request and back through a restored pending run`() {
        val request = with(RunRecorder) {
            RecordingState(distanceMeters = 5000.0, movingSeconds = 1700, laps = marks).toCreateRequest()
        }
        assertEquals(marks, request.laps)

        RunRecorder.resumeFinished(
            PendingRun(
                request = CreateRunRequest(
                    clientId = "c1", startedAt = "2026-08-16T08:00:00Z", distanceKm = 5.0,
                    durationSeconds = 1700, perceivedEffort = 5, laps = marks,
                ),
                finished = true, updatedAtEpochMs = 0, ownerUserId = null,
            )
        )
        assertEquals(marks, RunRecorder.state.value.laps)
    }

    @Test
    fun `lap needs a live recording`() {
        assertEquals(RunRecorder.LapResult.NotRecording, RunRecorder.markLap())
        RunRecorder.start()
        // Acquiring, not yet Recording: still refused.
        assertEquals(RunRecorder.LapResult.NotRecording, RunRecorder.markLap())
    }
}
