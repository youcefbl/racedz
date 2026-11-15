package dz.racedz.nativeapp.observability

import android.content.Context
import java.io.File
import java.util.UUID
import org.json.JSONObject

/**
 * A small on-disk queue of telemetry envelopes (run-session events and diagnostic reports).
 *
 * On disk rather than in memory because the events that matter most happen exactly when the app
 * is about to lose its memory: a crash, an OS kill, a run started with no network. Each envelope
 * is its own file, written atomically (temp + rename) so a crash mid-write leaves either the old
 * state or the new one, never half a file. Bounded: the oldest envelopes are dropped past
 * [MAX_ENVELOPES], so a device that is offline for weeks cannot fill its storage.
 *
 * Synchronous on purpose — the crash handler writes from a dying thread and cannot wait for a
 * coroutine. Writes are a few KB.
 */
class TelemetryQueue(context: Context) {

    private val dir = File(context.applicationContext.filesDir, "telemetry").apply { mkdirs() }

    data class Envelope(val file: File, val type: String, val ownerUserId: String?, val payload: JSONObject)

    @Synchronized
    fun enqueue(type: String, payload: JSONObject, ownerUserId: String? = null): Boolean = runCatching {
        val envelope = JSONObject()
            .put("type", type)
            .put("owner", ownerUserId ?: JSONObject.NULL)
            .put("payload", payload)
        // Time-prefixed so a directory listing sorts in send order (a session's start before its end).
        val name = "%013d-%s.json".format(System.currentTimeMillis(), UUID.randomUUID())
        val temp = File(dir, "$name.tmp")
        temp.writeText(envelope.toString())
        val ok = temp.renameTo(File(dir, name))
        if (!ok) temp.delete()
        trim()
        ok
    }.getOrDefault(false)

    @Synchronized
    fun pending(limit: Int = 100): List<Envelope> =
        (dir.listFiles { file -> file.name.endsWith(".json") } ?: emptyArray())
            .sortedBy { it.name }
            .take(limit)
            .mapNotNull { file ->
                runCatching {
                    val json = JSONObject(file.readText())
                    Envelope(
                        file = file,
                        type = json.getString("type"),
                        ownerUserId = json.optString("owner").takeIf { !json.isNull("owner") && it.isNotEmpty() },
                        payload = json.getJSONObject("payload"),
                    )
                }.getOrElse {
                    // Unparseable (truncated by a power loss): it can never be sent.
                    file.delete()
                    null
                }
            }

    @Synchronized
    fun remove(envelope: Envelope) {
        envelope.file.delete()
    }

    fun isEmpty(): Boolean = (dir.listFiles { file -> file.name.endsWith(".json") } ?: emptyArray()).isEmpty()

    private fun trim() {
        val files = (dir.listFiles { file -> file.name.endsWith(".json") } ?: return).sortedBy { it.name }
        if (files.size <= MAX_ENVELOPES) return
        files.take(files.size - MAX_ENVELOPES).forEach { it.delete() }
    }

    companion object {
        const val TYPE_SESSION_START = "session_start"
        const val TYPE_SESSION_END = "session_end"
        const val TYPE_DIAGNOSTIC = "diagnostic"
        private const val MAX_ENVELOPES = 300
    }
}
