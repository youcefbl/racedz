package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import java.util.concurrent.TimeUnit

/**
 * Background retry of a save the runner asked for (NATRUN-07.2; contract in
 * docs/RUNS_STRAVA_PARITY_2026-08-16.md §07.2).
 *
 * Reads the outbox slot for the account it was enqueued for and posts the runner's exact request.
 * It refuses to act unless that account is the one signed in right now — the slot belongs to its
 * owner and stays on disk for them — and it never uploads a slot the runner has not pressed Save
 * on. `clientId` makes a repeat harmless: the server hands the original run back.
 */
class RunSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val deps = dependencies ?: return Result.retry()
        val ownerUserId = inputData.getString(KEY_OWNER) ?: return Result.failure()
        val clientId = inputData.getString(KEY_CLIENT_ID) ?: return Result.failure()

        // Account isolation: only the signed-in owner's runs leave the phone.
        if (deps.currentUserId() != ownerUserId) return Result.success()

        val pending = deps.outbox.load(ownerUserId) ?: return Result.success()
        if (!pending.saveRequested || pending.request.clientId != clientId || pending.ownerUserId != ownerUserId) return Result.success()

        return when (val result = deps.repository.create(pending.request)) {
            is ApiResult.Success -> {
                RunRecorder.onSyncedInBackground(clientId, result.value.id, ownerUserId)
                Result.success(workDataOf(KEY_RUN_ID to result.value.id))
            }
            is ApiResult.Failure -> when (result.error.code) {
                // The session is gone: nothing a retry can fix; the slot stays for a foreground attempt.
                ApiErrorCode.Unauthenticated, ApiErrorCode.SessionExpired, ApiErrorCode.RefreshReuseDetected,
                ApiErrorCode.AccountBlocked, ApiErrorCode.Forbidden -> Result.failure()
                // The server refused the body itself (validation): retrying the same body is pointless.
                ApiErrorCode.ValidationFailed, ApiErrorCode.BadRequest -> Result.failure()
                // Offline, timeouts, 5xx: back off and try again.
                else -> if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
            }
        }
    }

    /** What the worker needs from the app; provided once at startup, never captured per request. */
    class Dependencies(
        val outbox: RunOutbox,
        val repository: RunsRepository,
        val currentUserId: () -> String?,
    )

    companion object {
        private const val KEY_OWNER = "owner"
        private const val KEY_CLIENT_ID = "clientId"
        const val KEY_RUN_ID = "runId"
        const val TAG = "run-sync"
        private const val MAX_ATTEMPTS = 12

        @Volatile private var dependencies: Dependencies? = null

        fun install(deps: Dependencies) {
            dependencies = deps
        }

        fun uniqueName(ownerUserId: String, clientId: String) = "$TAG:$ownerUserId:$clientId"

        /** Enqueues (or keeps) the retry for one pending run. Safe to call repeatedly. */
        fun enqueue(context: Context, ownerUserId: String, clientId: String) {
            val request = OneTimeWorkRequestBuilder<RunSyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .setInputData(workDataOf(KEY_OWNER to ownerUserId, KEY_CLIENT_ID to clientId))
                .addTag(TAG)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(uniqueName(ownerUserId, clientId), ExistingWorkPolicy.KEEP, request)
        }

        /** On sign-out: whatever was queued belongs to an account that just left. */
        fun cancelAll(context: Context) {
            WorkManager.getInstance(context).cancelAllWorkByTag(TAG)
        }

        /** On app start: re-arm the retry for a slot the runner already asked to save. */
        fun enqueuePendingIfAny(context: Context, outbox: RunOutbox, ownerUserId: String?) {
            if (ownerUserId.isNullOrBlank()) return
            val pending = outbox.load(ownerUserId) ?: return
            if (pending.saveRequested && pending.ownerUserId == ownerUserId) enqueue(context, ownerUserId, pending.request.clientId)
        }
    }
}
