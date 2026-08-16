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
        RunSettings.cueInterval = RunSettings.CueInterval.OneKm
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
        assertEquals(RunSettings.CueInterval.OneKm, RunSettings.cueInterval)
        RunSettings.autoPauseEnabled = false
        RunSettings.cueInterval = RunSettings.CueInterval.HalfKm
        assertFalse(RunSettings.autoPauseEnabled)
        assertEquals(500, RunSettings.cueInterval.meters)
    }

    @Test
    fun `an unknown stored interval falls back to one kilometre`() {
        assertEquals(RunSettings.CueInterval.OneKm, RunSettings.CueInterval.fromMeters(750))
    }
}
