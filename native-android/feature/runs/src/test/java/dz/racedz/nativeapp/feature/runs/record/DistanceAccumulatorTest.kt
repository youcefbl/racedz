package dz.racedz.nativeapp.feature.runs.record

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.random.Random

/**
 * Distance is the number runners judge the app by. These replay realistic 1 Hz fix streams —
 * slow walks, jogs, standing still with jitter, a bad fix — and pin the totals.
 *
 * The regression that motivated this: a 1.33 km walk at ~0.7 m/s saved as 0.167 km, because every
 * sub-metre fix-to-fix step was rejected and the rejected stretch was lost.
 */
class DistanceAccumulatorTest {

    @After
    fun tearDown() {
        GpsQuality.trustDisplacementWhenSpeedIsZero = false
    }

    private val originLat = 36.0
    private val originLng = 3.0
    private val metresPerDegLat = 111_195.0
    private val metresPerDegLng = metresPerDegLat * cos(Math.toRadians(originLat))

    private fun fixAt(seconds: Double, east: Double, north: Double, speed: Float?, accuracy: Float? = 6f) =
        DistanceAccumulator.Fix(
            lat = originLat + north / metresPerDegLat,
            lng = originLng + east / metresPerDegLng,
            timeMs = (seconds * 1000).toLong(),
            accuracyM = accuracy,
            speedMps = speed,
        )

    private class Totals(var meters: Double = 0.0, var moving: Double = 0.0, var maxStationaryRun: Double = 0.0)

    /** Feeds fixes and sums, also tracking the longest consecutive stationary window (auto-pause). */
    private fun replay(fixes: List<DistanceAccumulator.Fix>): Totals {
        val acc = DistanceAccumulator()
        val totals = Totals()
        var stationary = 0.0
        fixes.forEach { fix ->
            val step = acc.onFix(fix, recordingAgeSeconds = fix.timeMs / 1000.0 + 60.0)
            if (step.rejected) return@forEach
            totals.meters += step.countedMeters
            totals.moving += step.movingSeconds
            stationary = when {
                step.moving -> 0.0
                step.stationary -> stationary + step.elapsedSeconds
                else -> stationary
            }
            totals.maxStationaryRun = maxOf(totals.maxStationaryRun, stationary)
        }
        return totals
    }

    /**
     * Position noise with standard deviation [sigma] per axis. Phone GPS error is strongly
     * correlated second to second (the chipset filters it), so the default is AR(1) with rho 0.9;
     * rho 0 is the pessimistic white-noise case.
     */
    private class Noise(seed: Int, private val sigma: Double, private val rho: Double = 0.9) {
        private val rnd = java.util.Random(seed.toLong())
        private var e = 0.0
        private var n = 0.0
        private val innovation = sigma * kotlin.math.sqrt(1 - rho * rho)
        fun gauss() = rnd.nextGaussian()
        fun next(): Pair<Double, Double> {
            e = rho * e + innovation * rnd.nextGaussian()
            n = rho * n + innovation * rnd.nextGaussian()
            return e to n
        }
    }

    /** A straight line at [speedMps] for [seconds], 1 Hz, with GPS-like position noise and noisy Doppler. */
    private fun straightLine(speedMps: Double, seconds: Int, noiseM: Double, seed: Int, rho: Double = 0.9): List<DistanceAccumulator.Fix> {
        val noise = Noise(seed, noiseM, rho)
        return (0..seconds).map { s ->
            val (e, n) = noise.next()
            val reported = (speedMps + noise.gauss() * 0.15).coerceAtLeast(0.0).toFloat()
            fixAt(s.toDouble(), east = speedMps * s + e, north = n, speed = reported)
        }
    }

    @Test
    fun `a slow walk at 0_7 mps is measured, not dropped`() {
        val totals = replay(straightLine(speedMps = 0.7, seconds = 600, noiseM = 1.0, seed = 1))
        // 420 m walked. Within 5 %.
        assertEquals(420.0, totals.meters, 21.0)
        assertTrue("moving time ${totals.moving}", totals.moving > 540)
        assertTrue("never a 5 s stationary window: ${totals.maxStationaryRun}", totals.maxStationaryRun < GpsQuality.STATIONARY_AUTO_PAUSE_SECONDS)
    }

    @Test
    fun `even white position noise does not inflate a walk much`() {
        // Worst case, not the expected one: uncorrelated 1.5 m noise every second. Bounds the error
        // (measured ~+10 %) so a future floor change cannot quietly make slow walks balloon.
        val totals = replay(straightLine(speedMps = 0.7, seconds = 600, noiseM = 1.5, seed = 9, rho = 0.0))
        assertEquals(420.0, totals.meters, 420.0 * 0.15)
    }

    @Test
    fun `a very slow stroll at 0_5 mps still counts`() {
        val totals = replay(straightLine(speedMps = 0.5, seconds = 600, noiseM = 1.0, seed = 2))
        assertEquals(300.0, totals.meters, 30.0)
    }

    @Test
    fun `a jog is measured within a few percent`() {
        val totals = replay(straightLine(speedMps = 3.0, seconds = 600, noiseM = 1.5, seed = 3))
        assertEquals(1800.0, totals.meters, 36.0)
        assertTrue(totals.moving > 590)
    }

    @Test
    fun `standing still with jitter adds nothing`() {
        val rnd = Random(4)
        fun gauss() = (1..6).sumOf { rnd.nextDouble() } - 3.0
        val fixes = (0..600).map { s ->
            fixAt(s.toDouble(), east = gauss() * 2.5, north = gauss() * 2.5, speed = (rnd.nextDouble() * 0.3).toFloat())
        }
        val totals = replay(fixes)
        assertEquals(0.0, totals.meters, 0.0)
        assertEquals(0.0, totals.moving, 0.0)
        assertTrue(totals.maxStationaryRun >= GpsQuality.STATIONARY_AUTO_PAUSE_SECONDS)
    }

    @Test
    fun `a teleport fix is ignored and measuring continues from before it`() {
        val fixes = straightLine(speedMps = 1.2, seconds = 120, noiseM = 0.5, seed = 5).toMutableList()
        fixes[60] = fixes[60].copy(lat = fixes[60].lat + 500.0 / metresPerDegLat)
        val totals = replay(fixes)
        assertEquals(144.0, totals.meters, 8.0)
    }

    @Test
    fun `a motorbike ride with fixes arriving every 3 s keeps its distance`() {
        // 25 m/s (90 km/h): every fix is 75 m from the last, past the 60 m teleport bound. The
        // owner's ride on 0.8.3 lost these; the Doppler speed explains them, so they now count.
        val fixes = straightLine(speedMps = 25.0, seconds = 300, noiseM = 2.0, seed = 11)
            .filterIndexed { i, _ -> i % 3 == 0 }
        val totals = replay(fixes)
        assertEquals(7_500.0, totals.meters, 150.0)
    }

    @Test
    fun `a teleport is still rejected at speed - the jump must match the Doppler`() {
        val fixes = straightLine(speedMps = 12.0, seconds = 120, noiseM = 1.0, seed = 12).toMutableList()
        fixes[60] = fixes[60].copy(lat = fixes[60].lat + 400.0 / metresPerDegLat)
        val totals = replay(fixes)
        assertEquals(1_440.0, totals.meters, 30.0)
    }

    @Test
    fun `a long signal gap is not bridged with a straight line`() {
        val before = straightLine(speedMps = 2.0, seconds = 60, noiseM = 0.5, seed = 6)
        // 90 s with no fixes, then the runner reappears 300 m further on.
        val after = straightLine(speedMps = 2.0, seconds = 60, noiseM = 0.5, seed = 7).map {
            val shiftedEast = (it.lng - originLng) * metresPerDegLng + 420.0
            it.copy(timeMs = it.timeMs + 150_000, lng = originLng + shiftedEast / metresPerDegLng)
        }
        val totals = replay(before + after)
        assertEquals(240.0, totals.meters, 12.0)
    }

    @Test
    fun `without Doppler, only real displacement after the settle window counts`() {
        val acc = DistanceAccumulator()
        acc.onFix(fixAt(0.0, 0.0, 0.0, speed = null), recordingAgeSeconds = 0.0)
        // Inside the settle window: a 10 m move is acquisition convergence, not a run.
        assertFalse(acc.onFix(fixAt(1.0, 10.0, 0.0, speed = null), recordingAgeSeconds = 1.0).counted)
        // After it, displacement past the floor counts.
        assertTrue(acc.onFix(fixAt(30.0, 20.0, 0.0, speed = null), recordingAgeSeconds = 30.0).counted)
    }

    @Test
    fun `the jitter floor tracks accuracy within bounds`() {
        assertEquals(5.0, DistanceAccumulator.stepFloorMeters(3f), 0.0)
        assertEquals(7.0, DistanceAccumulator.stepFloorMeters(7f), 0.0)
        assertEquals(10.0, DistanceAccumulator.stepFloorMeters(25f), 0.0)
        assertEquals(8.0, DistanceAccumulator.stepFloorMeters(null), 0.0)
    }

    /**
     * The real 2026-11-14 walk (location stripped; offsets in metres), resampled to 1 Hz along its
     * path with GPS-like noise. The phone saved this as 0.167 km; the path is ~1.33 km.
     */
    @Test
    fun `the real slow walk that saved as 167 m now measures its full length`() {
        val points = javaClass.classLoader!!.getResourceAsStream("slow-walk-route.csv")!!.bufferedReader().readLines()
            .filter { it.isNotBlank() && !it.startsWith("#") }
            .map { line -> line.split(",").map(String::toDouble) }
        val pathLength = points.zipWithNext().sumOf { (a, b) -> hypot(b[1] - a[1], b[2] - a[2]) }

        val noise = Noise(8, sigma = 1.5)
        val fixes = mutableListOf<DistanceAccumulator.Fix>()
        points.zipWithNext().forEach { (a, b) ->
            val span = (b[0] - a[0]).toInt().coerceAtLeast(1)
            val speed = hypot(b[1] - a[1], b[2] - a[2]) / span
            for (k in 0 until span) {
                val f = k.toDouble() / span
                val (e, n) = noise.next()
                fixes += fixAt(
                    seconds = a[0] + k,
                    east = a[1] + (b[1] - a[1]) * f + e,
                    north = a[2] + (b[2] - a[2]) * f + n,
                    speed = (speed + noise.gauss() * 0.15).coerceAtLeast(0.0).toFloat(),
                )
            }
        }
        val totals = replay(fixes)
        assertEquals(pathLength, totals.meters, pathLength * 0.06)
        assertTrue("moving ${totals.moving}s of ${points.last()[0]}s", totals.moving > points.last()[0] * 0.85)
    }
}
