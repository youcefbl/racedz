package dz.racedz.nativeapp.feature.runs

import dz.racedz.nativeapp.core.network.RoutePointDto
import dz.racedz.nativeapp.core.network.RunDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RunSplitsTest {

    /**
     * A straight north-bound line at a known pace, with a point every 100 m.
     *
     * The degrees-per-kilometre figure must match the sphere `computeSplits` measures on
     * (R = 6371 km, so one degree of latitude is 2πR/360 = 111.195 km). Using the more familiar
     * 111.32 makes a "3 km" track actually 2.9966 km, which produces a legitimate partial final
     * split and looks like a bug in the code under test.
     */
    private val kmPerDegreeLat = 2 * Math.PI * 6371.0 / 360.0
    private fun straightRun(km: Double, paceSecondsPerKm: Int, startMs: Long = 1_700_000_000_000): RunDto {
        val steps = (km * 10).toInt()
        val points = (0..steps).map { i ->
            val travelledKm = i / 10.0
            RoutePointDto(
                lat = 36.75 + travelledKm / kmPerDegreeLat,
                lng = 3.06,
                ele = 40.0 + i,
                t = startMs + (travelledKm * paceSecondsPerKm * 1000).toLong(),
            )
        }
        return RunDto(route = points, distanceKm = km, durationSeconds = (km * paceSecondsPerKm).toInt())
    }

    @Test
    fun `derives one split per kilometre at the recorded pace`() {
        // Deliberately past a whole kilometre: asserting on a track built to land exactly on a
        // boundary tests floating-point luck, not the split logic.
        val splits = computeSplits(straightRun(km = 3.4, paceSecondsPerKm = 300))

        assertEquals(listOf("1", "2", "3"), splits.take(3).map { it.label })
        // `t` is milliseconds. Treating it as seconds — the first version of this did — yields
        // 300_000 s/km here, which is why this asserts the value and not merely the count.
        splits.forEach { assertTrue("pace was ${it.paceSecondsPerKm}", it.paceSecondsPerKm in 290..310) }
    }

    @Test
    fun `charges each kilometre only for its own distance`() {
        // A crossing is interpolated inside the segment that spans it. Without that, the kilometre
        // that first exceeded the boundary is billed for the overshoot and the next one is paid
        // back, so every split drifts and the error compounds along the run.
        val splits = computeSplits(straightRun(km = 5.4, paceSecondsPerKm = 330))

        assertEquals(5, splits.count { !it.label.contains(".") })
        splits.forEach { assertTrue("pace drifted to ${it.paceSecondsPerKm}", it.paceSecondsPerKm in 320..340) }
    }

    @Test
    fun `reports the final partial kilometre as a comparable per-km pace`() {
        val splits = computeSplits(straightRun(km = 2.5, paceSecondsPerKm = 360))

        assertEquals(3, splits.size)
        // The remainder covers half a kilometre; scaled up it must read like the whole ones, not
        // like a split twice as fast.
        assertTrue("tail pace was ${splits.last().paceSecondsPerKm}", splits.last().paceSecondsPerKm in 340..380)
    }

    @Test
    fun `returns no splits when the track has no timestamps`() {
        val untimed = RunDto(route = listOf(RoutePointDto(36.75, 3.06), RoutePointDto(36.76, 3.06)))

        // Better to show nothing than to spread the average evenly and present it as measured.
        assertEquals(emptyList<RunSplit>(), computeSplits(untimed))
    }

    @Test
    fun `returns no splits for a manual entry with no route`() {
        assertEquals(emptyList<RunSplit>(), computeSplits(RunDto(distanceKm = 5.0, durationSeconds = 1800)))
    }

    @Test
    fun `thins the elevation profile but keeps its shape`() {
        val route = (0 until 1500).map { RoutePointDto(36.75, 3.06, ele = it.toDouble()) }

        val sampled = sampleElevation(route, max = 120)

        assertEquals(120, sampled.size)
        assertEquals(0.0, sampled.first(), 0.001)
        assertTrue("thinning must preserve the trend", sampled.zipWithNext().all { (a, b) -> a <= b })
    }

    @Test
    fun `keeps a short profile untouched`() {
        val route = (0 until 40).map { RoutePointDto(36.75, 3.06, ele = it.toDouble()) }

        assertEquals(40, sampleElevation(route, max = 120).size)
    }
}
