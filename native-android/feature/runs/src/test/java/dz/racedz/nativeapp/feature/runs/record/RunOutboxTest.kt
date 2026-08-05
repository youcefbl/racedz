package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.CreateRunRequest
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
 * The outbox exists so a finished run survives the app being killed before it reaches the server.
 * These pin that guarantee — the failure they guard against is silent data loss, which no amount of
 * manual testing reliably catches.
 */
class RunOutboxTest {

    private lateinit var root: File
    private lateinit var outbox: RunOutbox

    @Before
    fun setUp() {
        root = createTempDir(prefix = "outbox-test")
        outbox = RunOutbox(FakeContext(root))
    }

    @After
    fun tearDown() {
        root.deleteRecursively()
    }

    private fun request(clientId: String = "c-1", km: Double = 5.2) = CreateRunRequest(
        clientId = clientId,
        startedAt = "2026-07-31T08:00:00Z",
        distanceKm = km,
        durationSeconds = 1800,
        perceivedEffort = 5,
        route = listOf(RoutePointDto(36.75, 3.06, 40.0, 1_700_000_000_000), RoutePointDto(36.76, 3.07, 42.0, 1_700_000_060_000)),
    )

    @Test
    fun `a saved run is readable by a fresh instance`() {
        outbox.save(PendingRun(request(), finished = true, updatedAtEpochMs = 123, ownerUserId = TEST_OWNER))

        // A new instance stands in for a new process: this is the whole point.
        val restored = RunOutbox(FakeContext(root)).load(TEST_OWNER)

        assertNotNull(restored)
        assertEquals("c-1", restored!!.request.clientId)
        assertEquals(5.2, restored.request.distanceKm, 0.001)
        assertTrue(restored.finished)
    }

    @Test
    fun `the route survives the round trip`() {
        outbox.save(PendingRun(request(), finished = true, updatedAtEpochMs = 1, ownerUserId = TEST_OWNER))

        val route = outbox.load(TEST_OWNER)!!.request.route

        assertEquals(2, route!!.size)
        // Timestamps are what splits are derived from; losing them silently would produce a run
        // with no pace breakdown and no indication why.
        assertEquals(1_700_000_000_000, route[0].t)
        assertEquals(40.0, route[0].ele!!, 0.001)
    }

    @Test
    fun `the clientId is preserved so a retry cannot duplicate the run`() {
        outbox.save(PendingRun(request(clientId = "stable-id"), finished = true, updatedAtEpochMs = 1, ownerUserId = TEST_OWNER))

        // Reusing this id is what makes a resend safe; regenerating it on retry would create a
        // second run for the same effort.
        assertEquals("stable-id", outbox.load(TEST_OWNER)!!.request.clientId)
    }

    @Test
    fun `saving again replaces rather than accumulates`() {
        outbox.save(PendingRun(request(km = 1.0), finished = false, updatedAtEpochMs = 1, ownerUserId = TEST_OWNER))
        outbox.save(PendingRun(request(km = 9.0), finished = true, updatedAtEpochMs = 2, ownerUserId = TEST_OWNER))

        assertEquals(9.0, outbox.load(TEST_OWNER)!!.request.distanceKm, 0.001)
    }

    @Test
    fun `clear removes the pending run`() {
        outbox.save(PendingRun(request(), finished = true, updatedAtEpochMs = 1, ownerUserId = TEST_OWNER))
        assertTrue(outbox.hasPending(TEST_OWNER))

        outbox.clear(TEST_OWNER)

        assertFalse(outbox.hasPending(TEST_OWNER))
        assertNull(outbox.load(TEST_OWNER))
    }

    @Test
    fun `a corrupt snapshot reads as empty instead of crashing`() {
        outbox.save(PendingRun(request(), finished = true, updatedAtEpochMs = 1, ownerUserId = TEST_OWNER))
        File(root, "run-outbox/pending-run-$TEST_OWNER.json").writeText("{ this is not json")

        // A truncated write must not take the app down on every launch — the run is already lost at
        // that point, and crash-looping would lose the app too. It reads as Unreadable rather than
        // Empty, so the app can say so and offer a way out instead of silently doing nothing.
        assertNull(outbox.load(TEST_OWNER))
        assertTrue(outbox.read(TEST_OWNER) is OutboxState.Unreadable)
    }

    @Test
    fun `an empty outbox has nothing pending`() {
        assertFalse(outbox.hasPending(TEST_OWNER))
        assertNull(outbox.load(TEST_OWNER))
    }
}

/** Minimal Context stand-in: the outbox only ever asks for filesDir. */
private class FakeContext(private val files: File) : android.content.ContextWrapper(null) {
    override fun getFilesDir(): File = files
}

private const val TEST_OWNER = "user-a"
