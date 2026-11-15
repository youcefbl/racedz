package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The snapshot that lets the coach answer about *this* run. It must stay inside the server's
 * `coachLiveRunSchema` bounds — one out-of-range value would reject the whole question mid-run.
 */
class MidRunCoachSnapshotTest {

    private val running = RecordingState(
        status = RecordingStatus.Recording,
        distanceMeters = 4_623.4,
        elapsedSeconds = 1_500,
        movingSeconds = 1_480,
        elevationGainM = 21.4,
        currentPaceSecondsPerKm = 330,
        heartRateBpm = 162,
        averageHeartRate = 154,
        liveCadenceSpm = 172,
    )

    @Test
    fun recordingRunCarriesItsNumbers() {
        val snapshot = running.toCoachSnapshot(guided = true)!!
        assertEquals("RECORDING", snapshot.status)
        assertEquals(4.62, snapshot.distanceKm, 0.0)
        assertEquals(1_500, snapshot.elapsedSeconds)
        assertEquals(330, snapshot.currentPaceSecondsPerKm)
        assertEquals(320, snapshot.averagePaceSecondsPerKm)
        assertEquals(162, snapshot.heartRateBpm)
        assertEquals(172, snapshot.cadenceSpm)
        assertEquals(21.0, snapshot.elevationGainM!!, 0.0)
        assertTrue(snapshot.guidedWorkout)
    }

    @Test
    fun pausedAndAutoPausedAreDistinct() {
        assertEquals("PAUSED", running.copy(status = RecordingStatus.Paused).toCoachSnapshot(false)!!.status)
        assertEquals(
            "AUTO_PAUSED",
            running.copy(autoPauseReason = AutoPauseReason.values().first()).toCoachSnapshot(false)!!.status,
        )
    }

    @Test
    fun noRunInProgressSendsNoSnapshot() {
        assertNull(running.copy(status = RecordingStatus.Idle).toCoachSnapshot(false))
        assertNull(running.copy(status = RecordingStatus.Finished).toCoachSnapshot(false))
    }

    @Test
    fun implausibleSensorValuesAreDroppedNotInvented() {
        val glitchy = running.copy(currentPaceSecondsPerKm = 20, heartRateBpm = 0, liveCadenceSpm = 400, sport = "SWIM")
        val snapshot = glitchy.toCoachSnapshot(false)!!
        assertNull(snapshot.currentPaceSecondsPerKm)
        assertNull(snapshot.heartRateBpm)
        assertNull(snapshot.cadenceSpm)
        assertEquals("RUN", snapshot.sport)
    }
}
