package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.design.DistanceUnit
import dz.racedz.nativeapp.core.design.ZidRunFormat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The phone's port of the server's sport-specific check (scripts/test-activity-check.ts). */
class ActivityCheckTest {

    private fun check(sport: String, kmh: Double, minutes: Int = 10, cadence: Int? = null) =
        GpsQuality.checkActivity(sport, kmh * minutes / 60.0, minutes * 60, cadence)

    @Test
    fun `an 18 kmh walk is too fast for a walk, the same run is fine`() {
        assertEquals(GpsQuality.ActivityMismatch.TooFastForWalk, check("WALK", 18.0))
        assertNull(check("RUN", 18.0, cadence = 175))
        assertNull(check("TRAIL", 18.0, cadence = 175))
    }

    @Test
    fun `ordinary walks pass`() {
        listOf(4.0, 5.5, 7.0, 9.0).forEach { assertNull("$it km/h", check("WALK", it)) }
    }

    @Test
    fun `a car is a vehicle on any foot sport and never on a ride`() {
        listOf("RUN", "WALK", "TRAIL").forEach { assertEquals(it, GpsQuality.ActivityMismatch.Vehicle, check(it, 45.0)) }
        assertNull(check("RIDE", 45.0))
        assertEquals(GpsQuality.ActivityMismatch.RideTooFast, check("RIDE", 80.0))
    }

    @Test
    fun `a bike cadence at running speed is low cadence`() {
        assertEquals(GpsQuality.ActivityMismatch.LowCadence, check("RUN", 15.0, cadence = 60))
    }

    @Test
    fun `a ride shows speed in its unit`() {
        // 2:24/km is 25.0 km/h, or 15.5 mph.
        assertEquals("⁦25.0 km/h⁩", ZidRunFormat.speed(144, DistanceUnit.KM))
        assertEquals("⁦15.5 mph⁩", ZidRunFormat.speed(144, DistanceUnit.MI))
    }
}
