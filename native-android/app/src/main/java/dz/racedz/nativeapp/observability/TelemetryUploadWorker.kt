package dz.racedz.nativeapp.observability

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dz.racedz.nativeapp.core.network.ZidRunApi
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Response

/**
 * Drains [TelemetryQueue] to the API.
 *
 * Two paths share one [drain]: [sendNow] posts immediately from the app process (Android 16 holds
 * connectivity jobs for up to ~30 minutes to batch radio use, and a run-start event is worth having
 * while the run is happening), and this worker is the fallback for whatever cannot go yet —
 * offline, server down, process about to die.
 *
 * Session events go one by one in queue order (a start before its end); diagnostics go in batches
 * of up to 20. A 2xx or a refused body (4xx other than auth/not-found/rate limits) removes the
 * envelope — a body the server refuses once it will refuse forever; anything transient retries.
 * Session events belong to the account that recorded them: if a different account is signed in
 * when they are sent, they are dropped rather than filed under the wrong person.
 */
class TelemetryUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    class Dependencies(
        val api: ZidRunApi,
        val queue: TelemetryQueue,
        val currentUserId: () -> String?,
        /** Refreshes the session after a 401 (the raw API has no refresh of its own); null = signed out. */
        val refreshAccessToken: suspend () -> String?,
    )

    override suspend fun doWork(): Result {
        val deps = dependencies ?: return Result.success()
        val transientFailure = drain(deps)
        return if (transientFailure && runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.success()
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private const val WORK_NAME = "zidrun-telemetry-upload"
        private const val MAX_ATTEMPTS = 8

        @Volatile
        private var dependencies: Dependencies? = null

        /** Serialises the in-process send and the worker so they never post the same envelope at once. */
        private val drainLock = Mutex()

        private enum class Outcome { Done, Retry }

        fun install(deps: Dependencies) {
            dependencies = deps
        }

        /** Sends queued telemetry now; leaves anything that fails transiently to the worker. */
        suspend fun sendNow(context: Context) {
            val deps = dependencies ?: return
            val failed = runCatching { drain(deps) }.getOrDefault(true)
            if (failed || !deps.queue.isEmpty()) enqueue(context)
        }

        /** Schedules a background drain. */
        fun enqueue(context: Context) {
            runCatching {
                val request = OneTimeWorkRequestBuilder<TelemetryUploadWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                    .build()
                WorkManager.getInstance(context.applicationContext)
                    .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
            }
        }

        /** Sends everything queued; true when something failed transiently and should be retried. */
        private suspend fun drain(deps: Dependencies): Boolean = drainLock.withLock {
            var transientFailure = false
            val diagnostics = mutableListOf<TelemetryQueue.Envelope>()

            for (envelope in deps.queue.pending()) {
                when (envelope.type) {
                    TelemetryQueue.TYPE_DIAGNOSTIC -> diagnostics += envelope
                    TelemetryQueue.TYPE_SESSION_START, TelemetryQueue.TYPE_SESSION_END -> {
                        val current = deps.currentUserId()
                        if (current == null || current != envelope.ownerUserId) {
                            // Signed out: keep it for when they sign back in, unless another account
                            // is in — then it can never be sent under its owner from this session.
                            if (current != null) deps.queue.remove(envelope)
                            continue
                        }
                        val outcome = send(deps) {
                            val body = envelope.payload.toString().toRequestBody(JSON)
                            if (envelope.type == TelemetryQueue.TYPE_SESSION_START) {
                                deps.api.startRunSession(body)
                            } else {
                                deps.api.endRunSession(envelope.payload.getString("clientId"), body)
                            }
                        }
                        when (outcome) {
                            Outcome.Done -> deps.queue.remove(envelope)
                            Outcome.Retry -> transientFailure = true
                        }
                    }
                    else -> deps.queue.remove(envelope)
                }
            }

            diagnostics.chunked(20).forEach { batch ->
                val reports = JSONArray()
                batch.forEach { reports.put(it.payload) }
                val outcome = send(deps) { deps.api.sendDiagnostics(JSONObject().put("reports", reports).toString().toRequestBody(JSON)) }
                when (outcome) {
                    Outcome.Done -> batch.forEach(deps.queue::remove)
                    Outcome.Retry -> transientFailure = true
                }
            }
            transientFailure
        }

        private suspend fun send(deps: Dependencies, call: suspend () -> Response<*>): Outcome = try {
            var response = call()
            if (response.code() == 401) {
                // An expired access token: refresh once and replay, as ApiClient does. If the
                // session is gone the replay goes without a token (diagnostics are then stored
                // anonymously; session events wait for the owner to sign back in).
                runCatching { deps.refreshAccessToken() }
                response = call()
            }
            val code = response.code()
            when {
                response.isSuccessful -> Outcome.Done
                // 404: a server that predates these endpoints — keep the envelope until it is deployed.
                code == 401 || code == 404 || code == 408 || code == 429 || code >= 500 -> Outcome.Retry
                else -> Outcome.Done
            }
        } catch (error: IOException) {
            Outcome.Retry
        } catch (error: Exception) {
            Outcome.Retry
        }
    }
}
