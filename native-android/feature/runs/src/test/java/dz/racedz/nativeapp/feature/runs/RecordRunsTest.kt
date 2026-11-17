package dz.racedz.nativeapp.feature.runs

import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.network.RunDto
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Test

class RecordRunsTest {

    private fun run(sport: String, km: Double, pace: Int, validity: String = "VALID") =
        RunDto(id = "$sport-$km", startedAt = "2026-11-17T08:00:00Z", distanceKm = km, averagePaceSecondsPerKm = pace, sport = sport, validity = validity)

    @Test
    fun `personal bests count runs and trail runs only`() {
        val state = RunsUiState(
            runs = listOf(
                run("RUN", 5.0, 330),
                run("TRAIL", 12.0, 420),
                run("RIDE", 30.0, 132), // a 2:12/km "best pace" until 2026-11-17
                run("WALK", 4.0, 600),
                run("RUN", 0.3, 149), // too short for a best pace (server: 1 km minimum)
                run("RUN", 8.0, 200, validity = "EXCLUDED"),
            ),
            loading = false,
        )
        assertEquals(330, state.bestPaceSecondsPerKm)
        assertEquals(12.0, state.longestRunKm, 0.0)
        assertEquals(17.3, state.totalDistanceKm, 0.001)
        // Weekly volume keeps the walk, never the ride.
        assertEquals(listOf("RUN", "TRAIL", "WALK", "RUN"), state.countedRuns.map { it.sport })
    }

    @Test
    fun `units follow the reading script`() {
        val saved = Locale.getDefault()
        try {
            Locale.setDefault(Locale("ar", "DZ"))
            assertEquals("\u2067\u206621\u2069 م\u2069", ZidRunFormat.meters(21))
            assertEquals("\u2067\u20665:55\u2069/كم\u2069", ZidRunFormat.pace(355))
            Locale.setDefault(Locale.ENGLISH)
            assertEquals("\u206621 m\u2069", ZidRunFormat.meters(21))
            assertEquals("\u20665:55/km\u2069", ZidRunFormat.pace(355))
        } finally {
            Locale.setDefault(saved)
        }
    }
}
