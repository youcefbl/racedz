package dz.racedz.nativeapp.feature.runs.record

/**
 * Per-recording choices made on the start screen.
 *
 * Deliberately not persisted: they are chosen fresh each time on the screen right before the run,
 * and a stale "audio off" from a run three weeks ago silently muting today's would be worse than
 * asking again.
 */
object RunSettings {
    var audioCuesEnabled: Boolean = true
}
