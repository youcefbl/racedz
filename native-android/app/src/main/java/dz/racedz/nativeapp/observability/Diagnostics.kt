package dz.racedz.nativeapp.observability

import android.Manifest
import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.feature.runs.record.RunTelemetry
import java.io.PrintWriter
import java.io.StringWriter
import java.time.Instant
import java.util.ArrayDeque
import java.util.UUID
import org.json.JSONObject

/**
 * The app's own crash / issue / run-session reporting to the ZidRun API.
 *
 * Complements Crashlytics (which only exists in builds with google-services.json and is
 * deliberately identity-free): these reports go to our server, are linked to the signed-in account
 * so a runner's "my run disappeared" can be traced, and carry the device state that explains
 * OS-level kills. Four sources:
 *
 * 1. **Crashes** — an uncaught-exception handler writes the report to disk before the process dies
 *    (then hands over to the previous handler, so Crashlytics and the system dialog still work).
 * 2. **Process exits** — on the next launch, Android's own record of why the process died
 *    (ApplicationExitInfo: low memory, thermal/background kills, ANRs, native crashes). This is
 *    what explained the 2026-11-14 investigation, and the app now reads it itself.
 * 3. **Issues** — named, handled problems from the recorder and service ([RunTelemetry.Sink.issue]).
 * 4. **Run sessions** — start/end of every recording, with a rounded start position.
 *
 * Diagnostics (1–3) honour the runner's crash-reporting switch ([CrashReporting.isEnabled]).
 * Nothing here carries a location except the session start, rounded to ~110 m on the device.
 */
class Diagnostics(
    private val context: Context,
    private val queue: TelemetryQueue,
    private val appVersion: String,
    private val versionCode: Int,
    private val buildType: String,
    private val currentUserId: () -> String?,
) : RunTelemetry.Sink {

    private val prefs by lazy { context.getSharedPreferences("zidrun-diagnostics", Context.MODE_PRIVATE) }
    private val breadcrumbs = ArrayDeque<String>()

    private val installId: String
        get() = prefs.getString(KEY_INSTALL, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(KEY_INSTALL, it).apply()
        }

    fun install() {
        RunTelemetry.sink = this
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching { recordCrash(thread, error) }
            previous?.uncaughtException(thread, error)
        }
        // After the session is restored, so an interrupted run can be attributed to its owner.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            runCatching { reportProcessExits() }
            flush()
        }, EXIT_CHECK_DELAY_MS)
    }

    fun flush() = TelemetryUploadWorker.enqueue(context)

    // ---- RunTelemetry.Sink ------------------------------------------------------------------

    override fun breadcrumb(message: String) {
        synchronized(breadcrumbs) {
            breadcrumbs.addLast("${Instant.now()} ${message.take(160)}")
            while (breadcrumbs.size > MAX_BREADCRUMBS) breadcrumbs.removeFirst()
        }
    }

    override fun issue(code: String, message: String?, context: Map<String, Any?>, runClientId: String?) {
        breadcrumb("issue $code")
        if (!CrashReporting.isEnabled(this.context)) return
        val payload = baseReport(kind = "ISSUE", code = code, message = message, runClientId = runClientId)
        payload.put("context", contextJson(context))
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, payload)
        flush()
    }

    override fun sessionStarted(clientId: String, sport: String, startedAtEpochMs: Long) {
        val owner = currentUserId() ?: return
        val identity = DeviceFacts.identity()
        val payload = JSONObject()
            .put("clientId", clientId)
            .put("startedAt", Instant.ofEpochMilli(startedAtEpochMs).toString())
            .put("sport", sport)
            .put("appVersion", appVersion)
            .put("deviceModel", "${identity.manufacturer} ${identity.model}".trim())
            .put("device", DeviceFacts.collect(context, appVersion, versionCode, buildType))
        lastKnownPosition()?.let { payload.put("position", it) }
        queue.enqueue(TelemetryQueue.TYPE_SESSION_START, payload, owner)
        flush()
    }

    override fun sessionEnded(clientId: String, reason: String, summary: Map<String, Any?>) {
        breadcrumb("session.end $reason")
        val owner = currentUserId() ?: return
        val payload = JSONObject()
            .put("clientId", clientId)
            .put("reason", reason)
            .put("endedAt", Instant.now().toString())
            .put("summary", scalarJson(summary))
        queue.enqueue(TelemetryQueue.TYPE_SESSION_END, payload, owner)
        flush()
    }

    // ---- sources ----------------------------------------------------------------------------

    private fun recordCrash(thread: Thread, error: Throwable) {
        if (!CrashReporting.isEnabled(context)) return
        val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        val recorder = RunRecorder.state.value
        val payload = baseReport(
            kind = "CRASH",
            code = "crash",
            message = "${error.javaClass.name}: ${error.message.orEmpty()}",
            runClientId = recorder.clientId.ifEmpty { null },
        )
        payload.put("stackTrace", trace.take(MAX_TRACE_CHARS))
        payload.put("context", contextJson(mapOf("thread" to thread.name)))
        // Synchronous: the process is about to die. Upload happens on the next launch.
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, payload)
    }

    /**
     * Reports new ApplicationExitInfo records since the last launch. User-initiated stops and
     * updates are not problems and are skipped; everything else (crash, ANR, low memory, OS kills
     * such as thermal/background limits) is reported with whether a run was in progress.
     */
    private fun reportProcessExits() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        if (!CrashReporting.isEnabled(context)) return
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return
        val lastSeen = prefs.getLong(KEY_LAST_EXIT, 0L)
        val exits = manager.getHistoricalProcessExitReasons(context.packageName, 0, 16)
            .filter { it.timestamp > lastSeen }
        if (exits.isEmpty()) return
        prefs.edit().putLong(KEY_LAST_EXIT, exits.maxOf { it.timestamp }).apply()

        // On the first launch with this feature, only the last week is still worth investigating.
        val horizon = if (lastSeen == 0L) System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000 else 0L
        val interruptedRun = RunRecorder.pendingFor(currentUserId())?.takeIf { !it.finished }
        exits.filter { it.timestamp >= horizon && it.reason !in IGNORED_EXIT_REASONS }.forEach { exit ->
            val payload = baseReport(
                kind = "PROCESS_EXIT",
                code = "process_exit.${exitReasonName(exit.reason)}",
                message = exit.description,
                runClientId = interruptedRun?.request?.clientId,
                occurredAtMs = exit.timestamp,
            )
            if (exit.reason == ApplicationExitInfo.REASON_ANR || exit.reason == ApplicationExitInfo.REASON_CRASH_NATIVE) {
                runCatching {
                    exit.traceInputStream?.use { stream ->
                        payload.put("stackTrace", stream.readBytes().decodeToString().take(MAX_TRACE_CHARS))
                    }
                }
            }
            payload.put(
                "context",
                contextJson(
                    mapOf(
                        "reason" to exitReasonName(exit.reason),
                        "status" to exit.status,
                        "importance" to exit.importance,
                        // 125 = foreground service: the recording service was running when it died.
                        "wasForegroundService" to (exit.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE),
                        "pssKb" to exit.pss,
                        "rssKb" to exit.rss,
                        "processName" to exit.processName,
                        "runInterrupted" to (interruptedRun != null),
                    )
                ),
            )
            queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, payload)
        }
    }

    // ---- helpers ----------------------------------------------------------------------------

    private fun baseReport(kind: String, code: String, message: String?, runClientId: String?, occurredAtMs: Long = System.currentTimeMillis()): JSONObject {
        val identity = DeviceFacts.identity()
        return JSONObject()
            .put("reportId", UUID.randomUUID().toString())
            .put("installId", installId)
            .put("kind", kind)
            .put("code", code.take(80))
            .apply { message?.takeIf { it.isNotBlank() }?.let { put("message", it.take(4000)) } }
            .put("occurredAt", Instant.ofEpochMilli(occurredAtMs).toString())
            .put("platform", "android")
            .put("appVersion", appVersion)
            .put("buildType", buildType)
            .put("deviceManufacturer", identity.manufacturer)
            .put("deviceModel", identity.model)
            .put("osVersion", identity.osVersion)
            .put("sdkInt", identity.sdkInt)
            .put("device", DeviceFacts.collect(context, appVersion, versionCode, buildType))
            .apply { runClientId?.let { put("runClientId", it) } }
    }

    private fun recorderContext(): Map<String, Any?> {
        val state = RunRecorder.state.value
        return mapOf(
            "recorderStatus" to state.status.name,
            "recorderDistanceM" to Math.round(state.distanceMeters),
            "recorderRoutePoints" to state.route.size,
            "recorderElapsedSeconds" to state.elapsedSeconds,
        )
    }

    private fun contextJson(values: Map<String, Any?>): JSONObject {
        val json = scalarJson(values + recorderContext())
        val crumbs = synchronized(breadcrumbs) { breadcrumbs.toList() }
        json.put("breadcrumbs", org.json.JSONArray(crumbs))
        return json
    }

    private fun scalarJson(values: Map<String, Any?>): JSONObject {
        val json = JSONObject()
        values.forEach { (key, value) ->
            when (value) {
                null -> json.put(key, JSONObject.NULL)
                is Number, is Boolean -> json.put(key, value)
                else -> json.put(key, value.toString().take(300))
            }
        }
        return json
    }

    /** The freshest last-known fix, rounded to 3 decimals (~110 m) before it leaves the device. */
    private fun lastKnownPosition(): JSONObject? {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return null
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val best: Location = runCatching {
            manager.getProviders(true).mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
                .maxByOrNull { it.time }
        }.getOrNull() ?: return null
        val ageSeconds = ((System.currentTimeMillis() - best.time) / 1000).coerceAtLeast(0)
        return JSONObject()
            .put("lat", Math.round(best.latitude * 1000) / 1000.0)
            .put("lng", Math.round(best.longitude * 1000) / 1000.0)
            .apply { if (best.hasAccuracy()) put("accuracyM", best.accuracy.toDouble()) }
            .put("ageSeconds", ageSeconds)
    }

    private fun exitReasonName(reason: Int): String = when (reason) {
        ApplicationExitInfo.REASON_ANR -> "anr"
        ApplicationExitInfo.REASON_CRASH -> "crash"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash_native"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "dependency_died"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive_resource_usage"
        ApplicationExitInfo.REASON_EXIT_SELF -> "exit_self"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "initialization_failure"
        ApplicationExitInfo.REASON_LOW_MEMORY -> "low_memory"
        // OEMs file thermal/background-limit kills here ("OTHER KILLS BY SYSTEM").
        ApplicationExitInfo.REASON_OTHER -> "other_kill"
        ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "permission_change"
        ApplicationExitInfo.REASON_SIGNALED -> "signaled"
        ApplicationExitInfo.REASON_USER_REQUESTED -> "user_requested"
        ApplicationExitInfo.REASON_USER_STOPPED -> "user_stopped"
        14 -> "freezer"
        15 -> "package_state_change"
        16 -> "package_updated"
        else -> "reason_$reason"
    }

    private companion object {
        const val KEY_INSTALL = "install-id"
        const val KEY_LAST_EXIT = "last-exit-ts"
        const val MAX_BREADCRUMBS = 40
        const val MAX_TRACE_CHARS = 60_000
        const val EXIT_CHECK_DELAY_MS = 3_000L

        /** Exits that are the user's or the installer's doing, not a problem. */
        val IGNORED_EXIT_REASONS = setOf(
            ApplicationExitInfo.REASON_USER_REQUESTED,
            ApplicationExitInfo.REASON_USER_STOPPED,
            ApplicationExitInfo.REASON_EXIT_SELF,
            15, // REASON_PACKAGE_STATE_CHANGE (API 33+)
            16, // REASON_PACKAGE_UPDATED (API 33+)
        )
    }
}
