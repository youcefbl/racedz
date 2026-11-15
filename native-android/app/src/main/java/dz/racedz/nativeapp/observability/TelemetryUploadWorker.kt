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
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Response

/**
 * Drains [TelemetryQueue] to the API when there is a network.
 *
 * Session events go one by one in queue order (a start before its end); diagnostics go in batches
 * of up to 20. A 2xx or a refused body (4xx other than auth/rate limits) removes the envelope —
 * a body the server refuses once it will refuse forever; anything transient retries with backoff.
 * Session events belong to the account that recorded them: if a different account (or none) is
 * signed in when they are sent, they are dropped rather than filed under the wrong person.
 */
class TelemetryUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    class Dependencies(
        val api: ZidRunApi,
        val queue: TelemetryQueue,
        val currentUserId: () -> String?,
    )

    override suspend fun doWork(): Result {
        val deps = dependencies ?: return Result.success()
        var transientFailure = false

        val envelopes = deps.queue.pending()
        val diagnostics = mutableListOf<TelemetryQueue.Envelope>()
        for (envelope in envelopes) {
            when (envelope.type) {
                TelemetryQueue.TYPE_DIAGNOSTIC -> diagnostics += envelope
                TelemetryQueue.TYPE_SESSION_START, TelemetryQueue.TYPE_SESSION_END -> {
                    val current = deps.currentUserId()
                    if (current == null || current != envelope.ownerUserId) {
                        // Signed out: keep it for when they sign back in, unless another account is
                        // in — then it can never be sent under its owner from this session.
                        if (current != null) deps.queue.remove(envelope)
                        continue
                    }
                    val outcome = send {
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
            val outcome = send { deps.api.sendDiagnostics(JSONObject().put("reports", reports).toString().toRequestBody(JSON)) }
            when (outcome) {
                Outcome.Done -> batch.forEach(deps.queue::remove)
                Outcome.Retry -> transientFailure = true
            }
        }

        return if (transientFailure && runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.success()
    }

    private enum class Outcome { Done, Retry }

    private suspend fun send(call: suspend () -> Response<*>): Outcome = try {
        val response = call()
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

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private const val WORK_NAME = "zidrun-telemetry-upload"
        private const val MAX_ATTEMPTS = 8

        @Volatile
        private var dependencies: Dependencies? = null

        fun install(deps: Dependencies) {
            dependencies = deps
        }

        /** Schedules a drain; cheap to call after every enqueue. */
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
    }
}
