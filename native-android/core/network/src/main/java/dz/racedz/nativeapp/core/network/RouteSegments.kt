package dz.racedz.nativeapp.core.network

/*
 * Route segments — the Kotlin side of src/lib/runs/route-segments.ts.
 *
 * The recorder starts a new segment on every resume (by hand, automatic, or after the app was
 * killed). Two consecutive points in different segments are not connected: whatever happened
 * between them is not distance, not moving time, not climb, and no map draws a line across it.
 */

/** The segment this point belongs to; a point without one (an older route) is segment 0. */
val RoutePointDto.segmentIndex: Int get() = segment ?: 0

/** True when point [index] starts a new segment: nothing is measured or drawn from [index] - 1. */
fun List<RoutePointDto>.startsSegmentAt(index: Int): Boolean =
    index in 1 until size && this[index - 1].segmentIndex != this[index].segmentIndex

/**
 * Evenly-spaced subsample to about [max] points keeping the first and last point and both sides
 * of every segment break, so a thinned route still starts, stops and resumes where the real one
 * did. Break points take priority over [max].
 */
fun List<RoutePointDto>.downsampleKeepingSegments(max: Int): List<RoutePointDto> {
    if (size <= max || max < 2) return toList()
    val keep = sortedSetOf(0, lastIndex)
    for (i in 1 until size) {
        if (startsSegmentAt(i)) {
            keep += i - 1
            keep += i
        }
    }
    val room = (max - keep.size).coerceAtLeast(0)
    if (room > 0) {
        val step = size.toDouble() / room
        for (k in 0 until room) keep += minOf(lastIndex, (k * step).toInt())
    }
    return keep.map { this[it] }
}
