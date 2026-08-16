package dz.racedz.nativeapp.feature.runs.record

import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.pow

/**
 * The live map pans by converting a finger's travel back into latitude/longitude. If the inverse
 * projection is off by even a little, every drag drifts and "recenter" lands somewhere else.
 */
class LiveMapProjectionTest {

    private val scale = 256.0 * 2.0.pow(16)

    @Test
    fun `projection round-trips at Algiers`() {
        val lat = 36.7538
        val lng = 3.0588
        assertEquals(lat, lat.latToWorldY(scale).worldYToLat(scale), 1e-9)
        assertEquals(lng, lng.lngToWorldX(scale).worldXToLng(scale), 1e-9)
    }

    @Test
    fun `one hundred metres north is about forty world pixels at zoom sixteen`() {
        // 100 m ≈ 0.000899° of latitude; at zoom 16 near 36°N one pixel is ~1.9 m.
        val y0 = 36.4700.latToWorldY(scale)
        val y1 = (36.4700 + 0.000899).latToWorldY(scale)
        val px = y0 - y1
        assert(px in 45.0..60.0) { "expected ~52 px, got $px" }
    }

    @Test
    fun `panning by pixels and back returns to the start`() {
        val lat = 36.4700
        val lng = 2.8300
        val panX = 123.4
        val panY = -87.6
        val movedLng = (lng.lngToWorldX(scale) - panX).worldXToLng(scale)
        val movedLat = (lat.latToWorldY(scale) - panY).worldYToLat(scale)
        val backLng = (movedLng.lngToWorldX(scale) + panX).worldXToLng(scale)
        val backLat = (movedLat.latToWorldY(scale) + panY).worldYToLat(scale)
        assertEquals(lng, backLng, 1e-9)
        assertEquals(lat, backLat, 1e-9)
    }
}
