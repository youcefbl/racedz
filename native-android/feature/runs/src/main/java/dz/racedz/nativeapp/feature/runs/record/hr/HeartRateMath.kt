package dz.racedz.nativeapp.feature.runs.record.hr

/**
 * Pure pieces of the heart-rate feature (NATRUN-07.3): the GATT measurement parser and the
 * run average. Nothing here estimates — no sample, no number.
 */
object HeartRateParser {
    /**
     * Parses a Heart Rate Measurement (0x2A37) value. Flags bit 0: 0 → uint8 bpm at [1],
     * 1 → uint16 little-endian at [1..2]. Returns null for a malformed or implausible value.
     */
    fun parse(value: ByteArray?): Int? {
        if (value == null || value.size < 2) return null
        val flags = value[0].toInt() and 0xFF
        val bpm = if (flags and 0x01 == 0) {
            value[1].toInt() and 0xFF
        } else {
            if (value.size < 3) return null
            (value[1].toInt() and 0xFF) or ((value[2].toInt() and 0xFF) shl 8)
        }
        return bpm.takeIf { it in 30..250 }
    }
}

/** Mean of the samples received while recording; null until there is at least one. */
class HeartRateAverager {
    private var sum = 0L
    private var count = 0
    fun add(bpm: Int) {
        if (bpm !in 30..250) return
        sum += bpm; count += 1
    }
    val average: Int? get() = if (count == 0) null else (sum / count).toInt()
    val samples: Int get() = count
    fun reset() { sum = 0; count = 0 }
}
