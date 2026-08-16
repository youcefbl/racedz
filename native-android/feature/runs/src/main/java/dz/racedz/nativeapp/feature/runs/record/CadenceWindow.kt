package dz.racedz.nativeapp.feature.runs.record

import java.util.ArrayDeque

/**
 * Live cadence (NATRUN-06.6): steps per minute over the last [windowMs] of step-counter readings.
 *
 * The whole-run average (RecordingState.avgCadenceSpm) is what the server wants and what the
 * summary shows, but on the live screen it lags a change of rhythm by minutes. This is the short
 * window instead — and it is honest about not knowing: null until the window holds enough time and
 * steps to mean something, null again once no reading has arrived for [staleMs] (the counter only
 * reports when the count changes, so silence is standing still). No Android types; unit-tested.
 */
class CadenceWindow(
    private val windowMs: Long = WINDOW_MS,
    private val staleMs: Long = STALE_MS,
) {
    private class Reading(val atMs: Long, val steps: Long)

    private val readings = ArrayDeque<Reading>()

    fun clear() = readings.clear()

    /** Records the run's cumulative step count as of [atMs]. Ignores a count that went backwards. */
    fun add(atMs: Long, cumulativeSteps: Long) {
        val last = readings.peekLast()
        if (last != null && (cumulativeSteps < last.steps || atMs <= last.atMs)) return
        readings.addLast(Reading(atMs, cumulativeSteps))
        while (readings.size > 2 && atMs - readings.peekFirst().atMs > windowMs) readings.removeFirst()
    }

    /** Steps per minute over the window, or null when there is not enough recent, valid data. */
    fun cadenceSpm(nowMs: Long): Int? {
        val newest = readings.peekLast() ?: return null
        val oldest = readings.peekFirst() ?: return null
        if (nowMs - newest.atMs > staleMs) return null
        val spanMs = newest.atMs - oldest.atMs
        val steps = newest.steps - oldest.steps
        if (spanMs < MIN_SPAN_MS || steps < MIN_STEPS) return null
        return (steps * 60_000.0 / spanMs).toInt().coerceIn(0, 300)
    }

    companion object {
        const val WINDOW_MS = 20_000L
        /** Silence this long from a counter that reports on change means the feet have stopped. */
        const val STALE_MS = 8_000L
        /** A window shorter than this, or with fewer steps, is a guess, not a cadence. */
        const val MIN_SPAN_MS = 10_000L
        const val MIN_STEPS = 12L
    }
}
