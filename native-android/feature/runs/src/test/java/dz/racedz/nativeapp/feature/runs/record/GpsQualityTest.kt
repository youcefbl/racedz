package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The rules that decide what becomes distance.
 *
 * Worth testing directly rather than through the recorder: these cannot be exercised on an emulator
 * at all. The Android emulator's GPS reports speed = 0 for every fix, whether fed by `geo fix` or
 * NMEA, so the speed branch below always rejects and no simulated run ever accumulates a metre.
 * A real device is the only place the happy path runs — which makes these the only automated
 * coverage the acceptance logic has.
 */
class GpsQualityTest {

    @Test
    fun `accepts a fix with no accuracy and rejects a vague one`() {
        assertTrue(GpsQuality.isUsableFix(null))
        assertTrue(GpsQuality.isUsableFix(8f))
        assertTrue(GpsQuality.isUsableFix(25f))
        // Beyond this the "position" is a neighbourhood, not a point on a route.
        assertFalse(GpsQuality.isUsableFix(26f))
        assertFalse(GpsQuality.isUsableFix(120f))
    }

    @Test
    fun `counts a segment at running speed`() {
        assertTrue(
            GpsQuality.shouldCountSegment(
                distanceM = 3.0,
                elapsedSeconds = 1.0,
                reportedSpeedMps = 3.0f,
                recordingAgeSeconds = 60.0,
            )
        )
    }

    @Test
    fun `rejects the jitter of a stationary phone`() {
        // A phone on a table drifts a metre or two; without this a runner waiting at a crossing
        // would silently accumulate distance.
        assertFalse(
            GpsQuality.shouldCountSegment(
                distanceM = 2.0,
                elapsedSeconds = 1.0,
                reportedSpeedMps = 0.1f,
                recordingAgeSeconds = 60.0,
            )
        )
    }

    @Test
    fun `rejects a teleport`() {
        // 200 m between consecutive fixes is a bad fix, not a sprint.
        assertFalse(
            GpsQuality.shouldCountSegment(
                distanceM = 200.0,
                elapsedSeconds = 1.0,
                reportedSpeedMps = 5.0f,
                recordingAgeSeconds = 60.0,
            )
        )
        // And below a metre there is nothing to measure.
        assertFalse(
            GpsQuality.shouldCountSegment(
                distanceM = 0.5,
                elapsedSeconds = 1.0,
                reportedSpeedMps = 5.0f,
                recordingAgeSeconds = 60.0,
            )
        )
    }

    @Test
    fun `waits out the settle window when the provider omits speed`() {
        // Some providers report no speed while acquiring. Counting those fixes would turn the
        // initial position convergence into the first hundred metres of the run.
        assertFalse(
            GpsQuality.shouldCountSegment(
                distanceM = 5.0,
                elapsedSeconds = 1.0,
                reportedSpeedMps = null,
                recordingAgeSeconds = 5.0,
            )
        )
        assertTrue(
            GpsQuality.shouldCountSegment(
                distanceM = 5.0,
                elapsedSeconds = 1.0,
                reportedSpeedMps = null,
                recordingAgeSeconds = 20.0,
            )
        )
    }

    @Test
    fun `accumulates the non-foot window only above foot speed`() {
        // 10 m/s is a car. Two sustained minutes of it is what triggers the auto-pause.
        var window = 0.0
        repeat(130) { window = GpsQuality.advanceHighSpeedWindow(window, 10.0, 1.0) }
        assertTrue(window >= GpsQuality.NON_FOOT_AUTO_PAUSE_SECONDS)
    }

    @Test
    fun `decays the non-foot window while running normally`() {
        // A single fast GPS glitch inside a normal run must not creep toward an auto-pause.
        var window = 30.0
        repeat(60) { window = GpsQuality.advanceHighSpeedWindow(window, 3.0, 1.0) }
        assertEquals(0.0, window, 0.001)
    }

    @Test
    fun `measures a known distance`() {
        // One degree of latitude on this sphere is 2*pi*R/360 = 111.195 km.
        val metres = GpsQuality.haversineMeters(36.7538, 3.0588, 36.7538 + 1.0 / 111.195, 3.0588)
        assertEquals(1000.0, metres, 5.0)
    }
}
