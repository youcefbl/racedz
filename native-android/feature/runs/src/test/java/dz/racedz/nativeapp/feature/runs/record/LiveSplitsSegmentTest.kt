package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.RoutePointDto
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Live splits must not measure across a pause (a route-segment break) or count the paused time —
 * the same rule the server applies to the saved run (scripts/test-route-segments.ts).
 */
class LiveSplitsSegmentTest {

    private val mPerDegLng = 111_195.0 * Math.cos(Math.toRadians(36.0))

    /** One point a second at [mps], starting [east0] metres east at [t0] seconds. */
    private fun stretch(t0: Int, east0: Double, seconds: Int, mps: Double, segment: Int?) =
        (0..seconds).map { i ->
            RoutePointDto(lat = 36.0, lng = 3.0 + (east0 + i * mps) / mPerDegLng, t = 1_780_000_000_000L + (t0 + i) * 1000L, segment = segment)
        }

    @Test
    fun `a pause neither adds distance nor slows the split`() {
        val v = 1000.0 / 300 // 5:00/km
        // 600 m, a 60 s pause during which the phone moved 200 m, then 600 m more.
        val route = stretch(0, 0.0, 180, v, 0) + stretch(240, 180 * v + 200, 180, v, 1)
        val splits = RecordingState(route = route).splits
        assertEquals(1, splits.size)
        assertEquals(300.0, splits[0].paceSecondsPerKm.toDouble(), 2.0)
    }

    @Test
    fun `without markers the old behaviour is unchanged`() {
        val v = 1000.0 / 300
        val route = stretch(0, 0.0, 180, v, null) + stretch(240, 180 * v + 200, 180, v, null)
        // The 200 m gap is walked into the split (as before segments existed).
        val splits = RecordingState(route = route).splits
        assertEquals(1, splits.size)
    }
}
