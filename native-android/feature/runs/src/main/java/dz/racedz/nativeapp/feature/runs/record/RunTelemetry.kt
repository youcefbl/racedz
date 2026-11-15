package dz.racedz.nativeapp.feature.runs.record

/**
 * Where the recorder reports what happened to a recording, so a run that never reaches the server
 * still leaves a trace (2026-11-14: a run vanished and the only evidence was on the phone).
 *
 * The app installs the [sink]; this module only names events. Everything is fire-and-forget: a
 * telemetry failure must never affect recording, which is why every call goes through [emit].
 *
 * Never put coordinates, names or free text from the runner into [Sink.issue] context or a
 * summary — those go to a diagnostics store. The start position travels only with
 * [Sink.sessionStarted], and the app rounds it before it leaves the device.
 */
object RunTelemetry {

    interface Sink {
        fun sessionStarted(clientId: String, sport: String, startedAtEpochMs: Long)
        fun sessionEnded(clientId: String, reason: String, summary: Map<String, Any?>)
        fun issue(code: String, message: String? = null, context: Map<String, Any?> = emptyMap(), runClientId: String? = null)
        fun breadcrumb(message: String)
    }

    @Volatile
    var sink: Sink? = null

    internal inline fun emit(block: Sink.() -> Unit) {
        val target = sink ?: return
        runCatching { target.block() }
    }

    /** Recorder totals that explain a run without describing where it went. */
    internal fun summaryOf(state: RecordingState, extra: Map<String, Any?> = emptyMap()): Map<String, Any?> = mapOf(
        "status" to state.status.name,
        "sport" to state.sport,
        "distanceM" to Math.round(state.distanceMeters),
        "elapsedSeconds" to state.elapsedSeconds,
        "movingSeconds" to state.movingSeconds,
        "routePoints" to state.route.size,
        "laps" to state.laps.size,
        "steps" to state.stepCount,
        "lastAccuracyM" to state.gpsAccuracyM?.let { Math.round(it) },
        "autoPaused" to state.autoPaused,
    ) + extra
}
