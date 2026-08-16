package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.LapMarkDto

/**
 * Manual laps on the phone (NATRUN-06.5) — the same rules as the server's src/lib/coach/laps.ts, so
 * the pending summary shows exactly the table Run Details will show once saved.
 */
object LapMath {
    const val MAX_LAPS = 100
    /** Two presses closer than this are one press. */
    const val MIN_LAP_SECONDS = 5
    const val MIN_LAP_METERS = 5.0

    data class Lap(val index: Int, val meters: Double, val seconds: Int, val paceSecondsPerKm: Int?)

    /** Whether a press now — at [atMeters]/[atSeconds] — would be a real lap after [previous]. */
    fun accepts(previous: LapMarkDto?, atMeters: Double, atSeconds: Int, count: Int): Boolean {
        if (count >= MAX_LAPS) return false
        val prevM = previous?.atMeters ?: 0.0
        val prevS = previous?.atSeconds ?: 0
        return atSeconds - prevS >= MIN_LAP_SECONDS && atMeters - prevM >= MIN_LAP_METERS
    }

    /** Per-lap distance/time/pace including the tail to the finish when it is more than noise. */
    fun derive(marks: List<LapMarkDto>, totalMeters: Double, totalSeconds: Int): List<Lap> {
        if (marks.isEmpty()) return emptyList()
        val out = ArrayList<Lap>(marks.size + 1)
        var prevM = 0.0
        var prevS = 0
        fun push(index: Int, m: Double, s: Int) {
            val meters = (m - prevM).coerceAtLeast(0.0)
            val seconds = (s - prevS).coerceAtLeast(0)
            val pace = if (meters >= MIN_LAP_METERS && seconds > 0) Math.round(seconds / meters * 1000).toInt() else null
            out += Lap(index, meters, seconds, pace)
            prevM = m
            prevS = s
        }
        marks.forEachIndexed { i, mark -> push(i + 1, mark.atMeters, mark.atSeconds) }
        if (totalMeters - prevM >= MIN_LAP_METERS && totalSeconds - prevS >= MIN_LAP_SECONDS) {
            push(marks.size + 1, totalMeters, totalSeconds)
        }
        return out
    }
}
