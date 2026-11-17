package dz.racedz.nativeapp.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RouteSegmentsTest {

    private fun p(i: Int, segment: Int?) = RoutePointDto(lat = 36.0, lng = 3.0 + i * 1e-5, t = 1_780_000_000_000L + i * 1000L, segment = segment)

    @Test
    fun `an unmarked route is one segment`() {
        val route = List(5) { p(it, null) }
        assertTrue((0 until route.size).none { route.startsSegmentAt(it) })
        assertEquals(0, route[3].segmentIndex)
    }

    @Test
    fun `a segment change is a break, index 0 never is`() {
        val route = listOf(p(0, 0), p(1, 0), p(2, 1), p(3, 1), p(4, 3))
        assertFalse(route.startsSegmentAt(0))
        assertFalse(route.startsSegmentAt(1))
        assertTrue(route.startsSegmentAt(2))
        assertFalse(route.startsSegmentAt(3))
        assertTrue(route.startsSegmentAt(4))
        assertFalse(route.startsSegmentAt(5))
    }

    @Test
    fun `thinning keeps both sides of every break and the ends`() {
        val route = List(1200) { p(it, it / 400) }
        val thin = route.downsampleKeepingSegments(64)
        assertTrue(thin.size <= 64 + 4)
        assertEquals(route.first(), thin.first())
        assertEquals(route.last(), thin.last())
        for (boundary in listOf(400, 800)) {
            assertTrue(route[boundary - 1] in thin)
            assertTrue(route[boundary] in thin)
        }
        assertEquals(2, thin.indices.count { thin.startsSegmentAt(it) })
    }

    @Test
    fun `a short route is returned whole`() {
        val route = List(10) { p(it, 0) }
        assertEquals(route, route.downsampleKeepingSegments(64))
    }
}
