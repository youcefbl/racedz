package dz.racedz.nativeapp.feature.runs.record

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/** Review P2: one failed lookup at the start line must not hide the mid-run coach for the whole run. */
class CoachEntitlementRetryTest {

    private fun run(vararg answers: EntitlementCheck): Pair<List<Boolean>, List<Long>> {
        val results = mutableListOf<Boolean>()
        val waits = mutableListOf<Long>()
        val queue = ArrayDeque(answers.toList())
        runTest {
            resolveCoachEntitlement(
                check = { queue.removeFirst() },
                onResult = { results += it },
                wait = { waits += it },
            )
        }
        return results to waits
    }

    @Test
    fun `an offline start retries and shows the coach once the connection is back`() {
        val (results, waits) = run(EntitlementCheck.Unavailable, EntitlementCheck.Unavailable, EntitlementCheck.Entitled)
        assertEquals(listOf(false, false, true), results)
        assertEquals(listOf(15_000L, 30_000L), waits)
    }

    @Test
    fun `a real answer settles it without retrying`() {
        assertEquals(listOf(false) to emptyList<Long>(), run(EntitlementCheck.NotEntitled))
        assertEquals(listOf(true) to emptyList<Long>(), run(EntitlementCheck.Entitled))
        assertEquals(listOf(false) to emptyList<Long>(), run(EntitlementCheck.SignedOut))
    }

    @Test
    fun `backoff is capped at two minutes`() {
        val answers = Array(7) { EntitlementCheck.Unavailable } + EntitlementCheck.Entitled
        val (_, waits) = run(*answers)
        assertEquals(listOf(15_000L, 30_000L, 60_000L, 120_000L, 120_000L, 120_000L, 120_000L), waits)
    }
}
