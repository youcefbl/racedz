package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import dz.racedz.nativeapp.core.network.CreateRunRequest
import java.io.File
import kotlinx.serialization.json.Json

/**
 * Durable storage for a recorded run that has not reached the server yet.
 *
 * Without this, a finished run lives only in [RunRecorder]'s in-memory state: a runner who finishes
 * in a park with no signal, fails to save, and whose app is then killed by the OS loses the run
 * outright. That is the worst thing this app can do, so the recording is written to disk as it is
 * recorded — not only when the runner presses Save.
 *
 * Deliberately a JSON file rather than Room. The plan names Room, but this is a single pending
 * record with no queries, no relations, and no migrations worth the annotation processor the project
 * has otherwise avoided (see AppContainer). The storage is behind this small interface, so swapping
 * in Room later changes this file and nothing that calls it. If the outbox ever needs to hold many
 * runs, or to be queried, that is the moment to revisit.
 *
 * Files live in `filesDir`, which is app-private and covered by Android's file-based encryption. A
 * route is a record of where someone actually ran, so it must not go anywhere world-readable, and
 * `allowBackup=false` already keeps it off cloud backups.
 */
class RunOutbox(context: Context) {

    private val directory = File(context.filesDir, DIRECTORY).apply { mkdirs() }
    private val pendingFile = File(directory, PENDING_FILE)

    // Tolerant on read: a snapshot written by an older build must not crash the app that finds it.
    // Losing a field is recoverable; refusing to parse means losing the run.
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /**
     * Writes the current recording to disk, replacing any previous snapshot.
     *
     * Written to a temporary file and then renamed, so a process killed mid-write leaves either the
     * previous complete snapshot or the new one — never a half-written file that parses into a run
     * with the wrong distance.
     */
    fun save(pending: PendingRun) {
        runCatching {
            val temporary = File(directory, "$PENDING_FILE.tmp")
            temporary.writeText(json.encodeToString(PendingRun.serializer(), pending))
            temporary.renameTo(pendingFile)
        }
    }

    /** The pending run, or null when there is nothing waiting. */
    fun load(): PendingRun? {
        if (!pendingFile.exists()) return null
        return runCatching {
            json.decodeFromString(PendingRun.serializer(), pendingFile.readText())
        }.getOrNull()
    }

    /**
     * Removes the pending run.
     *
     * Called only after the server has confirmed the save, or when the runner explicitly discards.
     * A failed request must NOT clear this — that is the whole point of the outbox.
     */
    fun clear() {
        runCatching { pendingFile.delete() }
    }

    fun hasPending(): Boolean = pendingFile.exists()

    private companion object {
        const val DIRECTORY = "run-outbox"
        const val PENDING_FILE = "pending-run.json"
    }
}

/**
 * A recording durable enough to survive process death.
 *
 * [request] is the exact body that will be posted, including the `clientId` generated when the
 * recording started — reusing it on every retry is what makes a resend safe rather than a duplicate.
 * [finished] distinguishes a run the runner has ended (ready to send) from one still in progress
 * (restored so recording can resume, or at least be salvaged).
 */
@kotlinx.serialization.Serializable
data class PendingRun(
    val request: CreateRunRequest,
    val finished: Boolean,
    /** Wall-clock time of the last write, so the UI can say how long a run has been waiting. */
    val updatedAtEpochMs: Long,
)
