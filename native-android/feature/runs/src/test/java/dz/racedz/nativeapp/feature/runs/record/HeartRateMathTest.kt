package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.feature.runs.record.hr.HeartRateAverager
import dz.racedz.nativeapp.feature.runs.record.hr.HeartRateParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** GATT 0x2A37 parsing and the run average (NATRUN-07.3). */
class HeartRateMathTest {
    @Test
    fun `eight bit and sixteen bit formats`() {
        assertEquals(148, HeartRateParser.parse(byteArrayOf(0x00, 148.toByte())))
        assertEquals(148, HeartRateParser.parse(byteArrayOf(0x01, 148.toByte(), 0x00)))
        assertNull(HeartRateParser.parse(byteArrayOf(0x01, 0x00, 0x01))) // 256 bpm: beyond plausible
        assertEquals(200, HeartRateParser.parse(byteArrayOf(0x01, 0xC8.toByte(), 0x00)))
    }

    @Test
    fun `garbage and implausible values are null`() {
        assertNull(HeartRateParser.parse(null))
        assertNull(HeartRateParser.parse(byteArrayOf(0x00)))
        assertNull(HeartRateParser.parse(byteArrayOf(0x01, 0x10))) // 16-bit flag but one byte
        assertNull(HeartRateParser.parse(byteArrayOf(0x00, 0x05))) // 5 bpm
        assertNull(HeartRateParser.parse(byteArrayOf(0x00, 0xFF.toByte()))) // 255 bpm
    }

    @Test
    fun `average is the mean of valid samples`() {
        val a = HeartRateAverager()
        assertNull(a.average)
        a.add(140); a.add(150); a.add(160); a.add(999)
        assertEquals(150, a.average)
        assertEquals(3, a.samples)
        a.reset(); assertNull(a.average)
    }
}
