package dz.racedz.nativeapp.feature.runs.record

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The stationary auto-pause decides when a runner is standing still. Too eager and the clock stops
 * on every slow stride; too lax and a red light counts as running time. These pin the rule the
 * recorder applies per fix, plus the settings it reads.
 */
class AutoPauseRulesTest {

    @After
    fun tearDown() {
        GpsQuality.trustDisplacementWhenSpeedIsZero = false
        RunSettings.autoPauseEnabled = true
        RunSettings.cueInterval = RunSettings.CueInterval.One
    }

    @Test
    fun `reported speed below the moving floor is stationary`() {
        assertTrue(GpsQuality.isStationaryFix(distanceM = 2.5, reportedSpeedMps = 0.2f))
    }

    @Test
    fun `reported speed at a walk is not stationary even with tiny displacement`() {
        assertFalse(GpsQuality.isStationaryFix(distanceM = 0.5, reportedSpeedMps = 1.3f))
    }

    @Test
    fun `without a speed the segment floor decides`() {
        assertTrue(GpsQuality.isStationaryFix(distanceM = 0.6, reportedSpeedMps = null))
        assertFalse(GpsQuality.isStationaryFix(distanceM = 3.0, reportedSpeedMps = null))
    }

    @Test
    fun `emulator zero speed falls back to displacement in debug`() {
        GpsQuality.trustDisplacementWhenSpeedIsZero = true
        assertFalse(GpsQuality.isStationaryFix(distanceM = 3.0, reportedSpeedMps = 0f))
        assertTrue(GpsQuality.isStationaryFix(distanceM = 0.4, reportedSpeedMps = 0f))
    }

    @Test
    fun `auto pause waits five seconds and resumes at a jog`() {
        assertEquals(5.0, GpsQuality.STATIONARY_AUTO_PAUSE_SECONDS, 0.0)
        assertTrue(GpsQuality.AUTO_RESUME_SPEED_MPS > GpsQuality.MIN_MOVING_SPEED_MPS)
    }

    @Test
    fun `settings default on and one kilometre, and remember a change without prefs`() {
        assertTrue(RunSettings.autoPauseEnabled)
        assertEquals(RunSettings.CueInterval.One, RunSettings.cueInterval)
        RunSettings.autoPauseEnabled = false
        RunSettings.cueInterval = RunSettings.CueInterval.Half
        assertFalse(RunSettings.autoPauseEnabled)
        assertEquals(500.0, RunSettings.cueInterval.meters, 0.0)
    }

    @Test
    fun `an unknown stored interval falls back to one kilometre`() {
        assertEquals(RunSettings.CueInterval.One, RunSettings.CueInterval.fromMeters(750))
    }

    @Test
    fun `a jog-speed fix resumes at once`() {
        assertTrue(GpsQuality.shouldAutoResume(reportedSpeedMps = 1.2f, displacementFromPauseM = 0.0, accuracyM = 5f))
    }

    @Test
    fun `a slow walker resumes after walking away from the pause point`() {
        // 0.7 m/s never reaches the jog threshold; 10 m from where they stopped does.
        assertFalse(GpsQuality.shouldAutoResume(reportedSpeedMps = 0.7f, displacementFromPauseM = 4.0, accuracyM = 5f))
        assertTrue(GpsQuality.shouldAutoResume(reportedSpeedMps = 0.7f, displacementFromPauseM = 10.0, accuracyM = 5f))
    }

    @Test
    fun `drift at a red light does not resume`() {
        // Doppler says still: displacement is drift, however large.
        assertFalse(GpsQuality.shouldAutoResume(reportedSpeedMps = 0.1f, displacementFromPauseM = 12.0, accuracyM = 5f))
        // A vague fix has to move further than its own accuracy.
        assertFalse(GpsQuality.shouldAutoResume(reportedSpeedMps = 0.6f, displacementFromPauseM = 12.0, accuracyM = 20f))
    }

    @Test
    fun `without a speed, displacement alone decides`() {
        assertFalse(GpsQuality.shouldAutoResume(reportedSpeedMps = null, displacementFromPauseM = 5.0, accuracyM = 5f))
        assertTrue(GpsQuality.shouldAutoResume(reportedSpeedMps = null, displacementFromPauseM = 9.0, accuracyM = 5f))
        assertFalse(GpsQuality.shouldAutoResume(reportedSpeedMps = null, displacementFromPauseM = null, accuracyM = 5f))
    }
}
