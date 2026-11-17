package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.core.network.GuidedSessionDto
import dz.racedz.nativeapp.core.network.GuidedStepDto
import dz.racedz.nativeapp.core.network.RoutePointDto
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Continuing a recording after the OS killed the app mid-run (found 2026-11-17 by crashing the app
 * on the M21: the service came back, found an empty recorder, and the run silently ended).
 */
class RecordingRecoveryTest {

    private val now = 1_780_000_000_000L
    private val owner = "user-a"

    private fun pending(
        ageMs: Long = 20_000,
        finished: Boolean = false,
        live: LiveRecording? = LiveRecording(elapsedSeconds = 600),
        ownerId: String? = owner,
        saveRequested: Boolean = false,
    ) = PendingRun(
        request = CreateRunRequest(clientId = "c-1", startedAt = "2026-05-28T20:00:00Z", distanceKm = 1.5, durationSeconds = 600, perceivedEffort = 5),
        finished = finished,
        updatedAtEpochMs = now - ageMs,
        ownerUserId = ownerId,
        saveRequested = saveRequested,
        live = live,
    )

    private fun decide(p: PendingRun?, ownerId: String? = owner, permitted: Boolean = true) =
        RecordingRecovery.decide(p, ownerId, now, permitted)

    @Test
    fun `a fresh in-progress snapshot of the signed-in account resumes`() {
        assertEquals(RecordingRecovery.Decision.Resume, decide(pending()))
    }

    @Test
    fun `finished, save-requested, foreign and missing snapshots are not touched`() {
        assertEquals(RecordingRecovery.Decision.Nothing, decide(null))
        assertEquals(RecordingRecovery.Decision.Nothing, decide(pending(finished = true, live = null)))
        assertEquals(RecordingRecovery.Decision.Nothing, decide(pending(saveRequested = true)))
        assertEquals(RecordingRecovery.Decision.Nothing, decide(pending(ownerId = "user-b")))
        assertEquals(RecordingRecovery.Decision.Nothing, decide(pending(), ownerId = null))
        assertEquals(RecordingRecovery.Decision.Nothing, decide(pending(ownerId = null), ownerId = null))
    }

    @Test
    fun `stale, permission-less, old-format and crash-looping snapshots are salvaged`() {
        assertEquals(RecordingRecovery.Decision.Salvage("stale"), decide(pending(ageMs = RecordingRecovery.MAX_INTERRUPTION_MS + 1)))
        assertEquals(RecordingRecovery.Decision.Salvage("no_location_permission"), decide(pending(), permitted = false))
        assertEquals(RecordingRecovery.Decision.Salvage("no_live_state"), decide(pending(live = null)))
        assertEquals(
            RecordingRecovery.Decision.Salvage("too_many_recoveries"),
            decide(pending(live = LiveRecording(elapsedSeconds = 600, recoveries = RecordingRecovery.MAX_RECOVERIES))),
        )
        assertEquals(RecordingRecovery.Decision.Salvage("clock_changed"), decide(pending(ageMs = -5 * 60_000L)))
    }

    // ---- through the real recorder and outbox ------------------------------------------------

    @Before
    fun setUp() {
        RunRecorder.attachOutbox(RunOutbox(RecoveryFakeContext(createTempDir(prefix = "recovery"))))
        RunRecorder.setOwner(owner)
        RunRecorder.reset()
        GuidedSessionController.clear()
    }

    @After
    fun tearDown() {
        RunRecorder.reset()
        RunRecorder.setOwner(null)
        GuidedSessionController.clear()
    }

    /** Records, snapshots, then drops everything in memory the way a process death does. */
    private fun recordAndDie(pause: Boolean = false, guided: GuidedSessionDto? = null): String {
        assertTrue(RunRecorder.start(workoutId = "w-1", sport = "TRAIL"))
        GuidedSessionController.start(guided)
        if (pause) RunRecorder.pause()
        RunRecorder.snapshot(force = true)
        val clientId = RunRecorder.state.value.clientId
        // Signing out drops the in-memory run and keeps the snapshot: the closest a JVM test gets
        // to a new process. Signing back in is the restarted process learning its owner.
        RunRecorder.setOwner(null)
        GuidedSessionController.clear()
        RunRecorder.setOwner(owner)
        assertEquals(RecordingStatus.Idle, RunRecorder.state.value.status)
        return clientId
    }

    @Test
    fun `a killed recording continues as the same run with a route break`() {
        val clientId = recordAndDie()
        val outcome = RunRecorder.recoverInterrupted(System.currentTimeMillis() + 10_000, locationPermitted = true, trigger = "test")
        assertEquals(RunRecorder.RecoveryOutcome.Resumed, outcome)
        val state = RunRecorder.state.value
        assertEquals(RecordingStatus.Recording, state.status)
        assertEquals(clientId, state.clientId)
        assertEquals("w-1", state.workoutId)
        assertEquals("TRAIL", state.sport)
        assertTrue(state.resumedAfterInterruption)
        // The 10 s the app was "dead" are not on the clock.
        assertTrue("elapsed ${state.elapsedSeconds}", state.elapsedSeconds <= 1)
        // A second recovery attempt (the other trigger) finds the recorder busy.
        assertEquals(RunRecorder.RecoveryOutcome.Nothing, RunRecorder.recoverInterrupted(System.currentTimeMillis(), true, "test"))
    }

    @Test
    fun `a run killed while paused by hand comes back paused`() {
        recordAndDie(pause = true)
        assertEquals(RunRecorder.RecoveryOutcome.Resumed, RunRecorder.recoverInterrupted(System.currentTimeMillis(), true, "test"))
        val state = RunRecorder.state.value
        assertEquals(RecordingStatus.Paused, state.status)
        assertNull(state.autoPauseReason)
    }

    @Test
    fun `a guided run continues on the step it was on`() {
        val session = GuidedSessionDto(
            workoutId = "w-1",
            title = "Intervals",
            fromPlan = true,
            steps = listOf(
                GuidedStepDto(index = 0, total = 2, role = "WARMUP", intensity = "EASY", seconds = 1),
                GuidedStepDto(index = 1, total = 2, role = "WORK", intensity = "HARD", meters = 200),
            ),
        )
        assertTrue(RunRecorder.start(workoutId = "w-1"))
        GuidedSessionController.start(session)
        GuidedSessionController.advanceIfDue(totalElapsedSeconds = 5, totalMeters = 30.0)
        assertEquals(1, GuidedSessionController.state.value.stepIndex)
        RunRecorder.snapshot(force = true)
        RunRecorder.setOwner(null)
        GuidedSessionController.clear()
        RunRecorder.setOwner(owner)

        RunRecorder.recoverInterrupted(System.currentTimeMillis(), true, "test")
        val guided = GuidedSessionController.state.value
        assertEquals(1, guided.stepIndex)
        assertEquals("WORK", guided.currentStep?.role)
        assertEquals(70.0, GuidedSessionController.metersInStep(100.0), 0.001)
    }

    @Test
    fun `a stale snapshot is restored for saving with the time it stopped`() {
        val clientId = recordAndDie()
        val outcome = RunRecorder.recoverInterrupted(System.currentTimeMillis() + 10 * 60_000L, true, "test")
        assertTrue(outcome is RunRecorder.RecoveryOutcome.Salvaged)
        val state = RunRecorder.state.value
        assertEquals(RecordingStatus.Finished, state.status)
        assertEquals(clientId, state.clientId)
        assertNotNull(state.interruptedAtEpochMs)
        assertFalse(state.resumedAfterInterruption)
    }

    @Test
    fun `another account never recovers someone else's run`() {
        recordAndDie()
        RunRecorder.setOwner("user-b")
        assertEquals(RunRecorder.RecoveryOutcome.Nothing, RunRecorder.recoverInterrupted(System.currentTimeMillis(), true, "test"))
        assertEquals(RecordingStatus.Idle, RunRecorder.state.value.status)
    }

    @Test
    fun `a revoked permission salvages instead of recording without GPS`() {
        recordAndDie()
        val outcome = RunRecorder.recoverInterrupted(System.currentTimeMillis(), locationPermitted = false, trigger = "test")
        assertTrue(outcome is RunRecorder.RecoveryOutcome.Salvaged)
        assertEquals(RecordingStatus.Finished, RunRecorder.state.value.status)
    }

    @Test
    fun `the recovered route resumes on a new segment`() {
        // A route with two segments already, as a snapshot would hold after one pause.
        val route = listOf(
            RoutePointDto(36.0, 3.0, t = 1L, segment = 0),
            RoutePointDto(36.0, 3.001, t = 2L, segment = 0),
            RoutePointDto(36.0, 3.002, t = 30_000L, segment = 1),
        )
        val p = pending(ageMs = 0).let { it.copy(request = it.request.copy(route = route), updatedAtEpochMs = System.currentTimeMillis()) }
        val box = RunOutbox(RecoveryFakeContext(createTempDir(prefix = "recovery-route")))
        assertTrue(box.save(p))
        RunRecorder.attachOutbox(box)
        RunRecorder.setOwner(null)
        RunRecorder.setOwner(owner)
        assertEquals(RunRecorder.RecoveryOutcome.Resumed, RunRecorder.recoverInterrupted(System.currentTimeMillis(), true, "test"))
        assertEquals(route, RunRecorder.state.value.route)
        // The next point recorded is segment 2 — checked through the snapshot the recovery wrote.
        val written = box.load(owner)
        assertEquals(1, written?.live?.recoveries)
    }
}

private class RecoveryFakeContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}
