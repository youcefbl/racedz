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

    /**
     * One slot per account (P234-R01).
     *
     * A single shared file meant one runner's pending run blocked another runner's recording — and
     * before ownership existed, exposed it. Keying the file by account keeps each person's run
     * intact and invisible to everyone else, and lets the next account record immediately.
     */
    private fun slotFor(ownerUserId: String?): File =
        File(directory, if (ownerUserId.isNullOrBlank()) PENDING_FILE else "pending-run-$ownerUserId.json")

    // Tolerant on read: a snapshot written by an older build must not crash the app that finds it.
    // Losing a field is recoverable; refusing to parse means losing the run.
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /**
     * Writes the current recording to disk, replacing any previous snapshot.
     *
     * Written to a temporary file and then renamed, so a process killed mid-write leaves either the
     * previous complete snapshot or the new one — never a half-written file that parses into a run
     * with the wrong distance.
     *
     * @return false when the snapshot did not reach disk — including a failed rename, which
     *   `runCatching` alone would have reported as success (P234-R02). The caller decides what a
     *   lost durability guarantee means; silently continuing to record a run that is no longer
     *   backed by anything is the failure mode this exists to prevent.
     */
    fun save(pending: PendingRun): Boolean = runCatching {
        val target = slotFor(pending.ownerUserId)
        val temporary = File(directory, "${target.name}.tmp")
        temporary.writeText(json.encodeToString(PendingRun.serializer(), pending))
        if (!temporary.renameTo(target)) {
            temporary.delete()
            return@runCatching false
        }
        true
    }.getOrDefault(false)

    /**
     * What is on disk right now.
     *
     * Explicit rather than a nullable run (P234-R02): "nothing waiting" and "something is waiting
     * but cannot be read" demand opposite behaviour, and collapsing both to null let the app show
     * Record while [RunRecorder.start] refused because the file existed — an unrecoverable dead end.
     */
    fun read(ownerUserId: String?): OutboxState {
        val file = slotFor(ownerUserId)
        if (!file.exists()) return OutboxState.Empty
        val text = runCatching { file.readText() }.getOrNull()
            ?: return OutboxState.Unreadable
        return runCatching { json.decodeFromString(PendingRun.serializer(), text) }
            .fold(
                onSuccess = { OutboxState.Present(it) },
                onFailure = { OutboxState.Unreadable },
            )
    }

    /** The pending run for this account, or null when there is nothing waiting or it is corrupt. */
    fun load(ownerUserId: String?): PendingRun? = (read(ownerUserId) as? OutboxState.Present)?.run

    /**
     * Moves an unreadable snapshot aside so the app can record again without deleting bytes that
     * support might still recover. Best effort: if even the rename fails the file is deleted,
     * because a permanently un-clearable outbox would wedge recording forever.
     */
    fun quarantineUnreadable(ownerUserId: String?): Boolean {
        val file = slotFor(ownerUserId)
        if (!file.exists()) return true
        val target = File(directory, "${file.name}.corrupt")
        runCatching { target.delete() }
        val moved = runCatching { file.renameTo(target) }.getOrDefault(false)
        if (moved) return true
        return runCatching { file.delete() }.getOrDefault(false)
    }

    /**
     * Removes the pending run.
     *
     * Called only after the server has confirmed the save, or when the runner explicitly discards.
     * A failed request must NOT clear this — that is the whole point of the outbox.
     */
    fun clear(ownerUserId: String?): Boolean = runCatching {
        val file = slotFor(ownerUserId)
        !file.exists() || file.delete()
    }.getOrDefault(false)

    fun hasPending(ownerUserId: String?): Boolean = slotFor(ownerUserId).exists()

    private companion object {
        const val DIRECTORY = "run-outbox"
        /** Legacy, ownerless slot from builds before per-account storage. Never surfaced. */
        const val PENDING_FILE = "pending-run.json"
    }
}

/** What [RunOutbox.read] found on disk. */
sealed interface OutboxState {
    /** Nothing is waiting — recording may start. */
    data object Empty : OutboxState
    /** A run is waiting and was parsed. */
    data class Present(val run: PendingRun) : OutboxState
    /** A file is waiting but cannot be read or parsed; it must be resolved before recording. */
    data object Unreadable : OutboxState
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
    /**
     * The account that recorded this run (P234-R01).
     *
     * A route is a record of where a specific person actually ran. Without an owner, a recovered
     * snapshot was shown — and could be uploaded — under whichever account next reached the shell,
     * so on a shared phone the next user saw the previous user's precise route. Null only for
     * snapshots written by builds before this field existed; those are treated as belonging to no
     * one and are never displayed (see [RunRecorder.pendingFor]).
     */
    val ownerUserId: String? = null,
)
