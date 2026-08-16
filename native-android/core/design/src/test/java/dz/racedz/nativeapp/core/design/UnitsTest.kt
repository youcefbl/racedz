package dz.racedz.nativeapp.core.design

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale

/**
 * Distance unit conversion (NATRUN-06.8): storage stays metric, only presentation converts, and the
 * boundaries a runner actually sees (5 km, a 5:00/km pace, a typed "3.1 mi") round the way they
 * expect. `pace()` reads the process-level unit, so every test resets it.
 */
class UnitsTest {

    @After
    fun tearDown() = ZidRunUnits.reset()

    @Test
    fun `defaults to kilometres and resets`() {
        ZidRunUnits.current = DistanceUnit.MI
        ZidRunUnits.reset()
        assertEquals(DistanceUnit.KM, ZidRunUnits.current)
        assertEquals(DistanceUnit.KM, DistanceUnit.fromCode(null))
        assertEquals(DistanceUnit.KM, DistanceUnit.fromCode("km"))
        assertEquals(DistanceUnit.MI, DistanceUnit.fromCode("mi"))
    }

    @Test
    fun `five kilometres is three point one one miles`() {
        assertEquals("3.11", ZidRunFormat.distanceValue(5.0, Locale.US, unit = DistanceUnit.MI))
        assertEquals("5.00", ZidRunFormat.distanceValue(5.0, Locale.US, unit = DistanceUnit.KM))
        // French locale keeps its comma; digits stay Western.
        assertEquals("3,11", ZidRunFormat.distanceValue(5.0, Locale.FRANCE, unit = DistanceUnit.MI))
    }

    @Test
    fun `a typed mile value is stored as kilometres`() {
        assertEquals(5.0, ZidRunUnits.toKm(3.10686, DistanceUnit.MI), 0.0005)
        assertEquals(10.0, ZidRunUnits.toKm(10.0, DistanceUnit.KM), 0.0)
        // Round trip is exact to the metre.
        assertEquals(12.345, ZidRunUnits.toKm(ZidRunUnits.fromKm(12.345, DistanceUnit.MI), DistanceUnit.MI), 1e-9)
    }

    @Test
    fun `pace converts per unit and rounds to the second`() {
        // 5:00/km = 8:02.8/mi → 8:03/mi
        assertEquals("⁦5:00/km⁩", ZidRunFormat.pace(300, DistanceUnit.KM))
        assertEquals("⁦8:03/mi⁩", ZidRunFormat.pace(300, DistanceUnit.MI))
        ZidRunUnits.current = DistanceUnit.MI
        assertEquals("⁦8:03/mi⁩", ZidRunFormat.pace(300))
        assertEquals("—", ZidRunFormat.pace(0))
    }

    @Test
    fun `boundary values`() {
        assertEquals("0.00", ZidRunFormat.distanceValue(0.0, Locale.US, unit = DistanceUnit.MI))
        // A marathon in miles.
        assertEquals("26.22", ZidRunFormat.distanceValue(42.195, Locale.US, unit = DistanceUnit.MI))
        assertEquals(1609.344, DistanceUnit.MI.meters, 0.0)
    }
}
