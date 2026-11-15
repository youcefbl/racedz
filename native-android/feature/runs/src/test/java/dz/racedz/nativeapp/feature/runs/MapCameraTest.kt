package dz.racedz.nativeapp.feature.runs

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The full-screen run map's camera: framing, and zoom that keeps the pinched point in place. */
class MapCameraTest {

    // Roughly a 5 km loop in Algiers, as normalised Mercator bounds.
    private val bounds = doubleArrayOf(
        3.03.toMercatorX(), 3.07.toMercatorX(), 36.78.toMercatorY(), 36.74.toMercatorY(),
    )

    @Test
    fun fitFramesTheRouteAtStreetLevel() {
        val camera = MapCamera()
        camera.fit(bounds, widthPx = 1080.0, heightPx = 2000.0)
        assertTrue("zoom ${camera.zoom}", camera.zoom in 13.0..15.0)
        assertEquals((bounds[0] + bounds[1]) / 2, camera.centerX, 1e-12)
    }

    @Test
    fun zoomKeepsTheFocusPointUnderTheFinger() {
        val camera = MapCamera().apply { fit(bounds, 1080.0, 2000.0) }
        val focus = Offset(200f, 300f)
        fun pointUnder(c: MapCamera): Pair<Double, Double> {
            val world = 256.0 * Math.pow(2.0, c.zoom)
            return (c.centerX + (focus.x - 540.0) / world) to (c.centerY + (focus.y - 1000.0) / world)
        }
        val before = pointUnder(camera)
        camera.zoomAround(focus, 1.7, 1080.0, 2000.0)
        val after = pointUnder(camera)
        assertEquals(before.first, after.first, 1e-12)
        assertEquals(before.second, after.second, 1e-12)
    }

    @Test
    fun zoomIsClampedAtBothEnds() {
        val camera = MapCamera().apply { fit(bounds, 1080.0, 2000.0) }
        repeat(20) { camera.zoomAround(Offset(540f, 1000f), 2.0, 1080.0, 2000.0) }
        assertEquals(19.0, camera.zoom, 0.0)
        repeat(40) { camera.zoomAround(Offset(540f, 1000f), 0.5, 1080.0, 2000.0) }
        assertEquals(2.0, camera.zoom, 0.0)
    }
}
