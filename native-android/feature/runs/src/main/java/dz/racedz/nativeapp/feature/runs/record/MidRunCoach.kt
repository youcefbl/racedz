package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AskCoachRequest
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The mid-run "ask your coach" surface.
 *
 * A run has no server id until it is saved, so a question asked mid-run is a plain CHAT interaction
 * with no runId; its id is handed to [RunRecorder.recordCoachInteraction] and linked to the run at
 * save time. Only subscribers get the affordance — the entitlement is read once up front, and the
 * server enforces it regardless. Both voice and text are supported: voice is transcribed and asked
 * straight away (hands are moving), text is for when speaking is not possible.
 */
data class MidRunCoachUiState(
    /**
     * Whether the runner may use the coach at all — TRIAL or SUBSCRIBED (i.e. entitlement is not
     * NONE), matching what the server enforces. A trial exists to let someone experience the paid
     * coach, so it would be wrong to hide the feature they are trialling; NONE never sees it.
     */
    val canCoach: Boolean = false,
    /** True once the entitlement has been resolved, so the button does not flicker in on load. */
    val ready: Boolean = false,
    val open: Boolean = false,
    val asking: Boolean = false,
    val recording: Boolean = false,
    val transcribing: Boolean = false,
    val draft: String = "",
    /** The latest reply, shown in the sheet (and spoken when cues are on). */
    val reply: String? = null,
    val error: String? = null,
) {
    val busy: Boolean get() = asking || transcribing
}

class MidRunCoachViewModel(private val coach: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(MidRunCoachUiState())
    val state: StateFlow<MidRunCoachUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            // A failure leaves canCoach=false: unknown entitlement hides the affordance rather than
            // showing a coach button that would only 402 on tap. The server is the real gate anyway.
            val canCoach = when (val result = coach.overview()) {
                is ApiResult.Success -> result.value.entitlement.tier != "NONE"
                is ApiResult.Failure -> false
            }
            _state.update { it.copy(canCoach = canCoach, ready = true) }
        }
    }

    // One idempotency key per pending question, retained across a failed attempt so that re-sending
    // the same words replays the one interaction (and quota charge) the server may already have
    // committed but whose response was lost — the whole point of the key on a flaky run connection. A
    // new question mints a new key; a completed ask clears it.
    private var retainedPayload: String? = null
    private var retainedRequestId: String? = null

    // The voice note currently being transcribed, held so it can be deleted even if the screen leaves
    // and cancels the coroutine before the delete runs.
    private var pendingVoiceFile: File? = null

    private fun requestIdFor(payload: String): String {
        retainedRequestId?.let { if (retainedPayload == payload) return it }
        val fresh = java.util.UUID.randomUUID().toString()
        retainedPayload = payload
        retainedRequestId = fresh
        return fresh
    }

    fun open() = _state.update { it.copy(open = true, error = null) }
    fun close() = _state.update { it.copy(open = false, error = null) }
    fun setDraft(text: String) = _state.update { it.copy(draft = text) }
    fun setRecording(active: Boolean) = _state.update { it.copy(recording = active) }

    /**
     * Sends a typed (or reviewed-transcribed) question and, on success, buffers its id onto the run.
     *
     * The question is prefixed with a compact live snapshot of the run — distance, elapsed, average
     * pace, cadence — so the coach answers about *this* run rather than the last saved one. Only these
     * bounded numbers are shared; never the route or raw GPS.
     */
    fun ask(message: String, speak: (String) -> Unit) {
        val trimmed = message.trim()
        if (trimmed.isEmpty() || _state.value.asking) return
        _state.update { it.copy(asking = true, error = null, reply = null) }
        val requestId = requestIdFor(trimmed)
        val grounded = liveContextPrefix()?.let { "$it\n\n$trimmed" } ?: trimmed
        viewModelScope.launch {
            val request = AskCoachRequest(type = "CHAT", message = grounded, requestId = requestId)
            when (val result = coach.ask(request)) {
                is ApiResult.Success -> {
                    RunRecorder.recordCoachInteraction(result.value.id)
                    // Terminal result: the key has served its purpose, so a later identical question
                    // is a genuinely new one.
                    retainedPayload = null
                    retainedRequestId = null
                    val reply = result.value.response
                    val spoken = reply?.spokenText().orEmpty()
                    _state.update {
                        it.copy(asking = false, draft = "", reply = reply?.summary?.ifBlank { spoken } ?: spoken)
                    }
                    if (spoken.isNotBlank()) speak(spoken)
                }
                // Keep the retained key so a retry of the same words replays rather than re-charges.
                is ApiResult.Failure -> _state.update { it.copy(asking = false, error = result.error.message) }
            }
        }
    }

    /**
     * Transcribes a captured voice note into the composer for the runner to read and Send — it never
     * auto-sends. Speech recognition mishears (Darija especially), being in motion makes it worse, and
     * a wrong send spends quota and could store an unintended health statement; the same no-auto-send
     * rule the main Coach composer follows. The audio file is deleted in a finally so it never lingers.
     */
    fun transcribeToDraft(file: File, mimeType: String) {
        _state.update { it.copy(transcribing = true, error = null) }
        pendingVoiceFile = file
        viewModelScope.launch {
            try {
                when (val result = coach.transcribe(file, mimeType)) {
                    is ApiResult.Success ->
                        _state.update { it.copy(transcribing = false, draft = result.value.transcript.trim()) }
                    is ApiResult.Failure ->
                        _state.update { it.copy(transcribing = false, error = result.error.message) }
                }
            } finally {
                file.delete()
                if (pendingVoiceFile === file) pendingVoiceFile = null
            }
        }
    }

    /** A one-line snapshot of the live run for the coach, or null before a run is measuring. */
    private fun liveContextPrefix(): String? {
        val s = RunRecorder.state.value
        if (s.status == RecordingStatus.Idle || s.status == RecordingStatus.Finished) return null
        val elapsed = "%d:%02d".format(s.elapsedSeconds / 60, s.elapsedSeconds % 60)
        return buildString {
            append("[Live run so far: ")
            append("%.2f km".format(java.util.Locale.US, s.distanceKm))
            append(", $elapsed elapsed")
            s.averagePaceSecondsPerKm?.let { append(", avg pace %d:%02d/km".format(it / 60, it % 60)) }
            s.avgCadenceSpm?.let { append(", cadence $it spm") }
            append("]")
        }
    }

    override fun onCleared() {
        // A transcription in flight when the screen closes must not leave its audio behind.
        pendingVoiceFile?.delete()
        pendingVoiceFile = null
        super.onCleared()
    }
}

/**
 * Records a short voice note for the mid-run coach question.
 *
 * Mirrors the coach module's VoiceNoteRecorder rather than depending on it: the runs feature does not
 * (and should not) depend on the coach feature. Same container (MPEG-4/AAC) and the same server
 * allow-list [MIME_TYPE]. The microphone is open only between [start] and [stop]; the file lives in
 * the app cache and is deleted right after it is transcribed.
 */
class RunCoachVoiceRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var output: File? = null

    fun start() {
        stopSilently()
        val file = File.createTempFile("run-coach-", ".m4a", context.cacheDir)
        // Track the file and recorder BEFORE prepare()/start() so a setup failure is cleaned up here
        // rather than leaving an orphan recording (with possible health context) in the cache.
        output = file
        val created = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        recorder = created
        try {
            created.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(22_050)
                setAudioEncodingBitRate(48_000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
        } catch (error: Exception) {
            runCatching { created.release() }
            recorder = null
            output = null
            file.delete()
            throw error
        }
    }

    /** Deletes any orphaned voice notes left in the cache by a killed process or a past failure. */
    fun cleanupStale() {
        runCatching {
            context.cacheDir.listFiles { f -> f.name.startsWith("run-coach-") }?.forEach { it.delete() }
        }
    }

    /** Stops and returns the recording, or null when nothing usable was captured. */
    fun stop(): File? {
        val active = recorder ?: return null
        recorder = null
        val file = output
        output = null
        return try {
            active.stop()
            active.release()
            file?.takeIf { it.length() > 0 }
        } catch (error: RuntimeException) {
            active.release()
            file?.delete()
            null
        }
    }

    fun cancel() {
        val file = output
        stopSilently()
        file?.delete()
    }

    private fun stopSilently() {
        val active = recorder ?: return
        recorder = null
        output = null
        try {
            active.stop()
        } catch (_: RuntimeException) {
        }
        active.release()
    }

    companion object {
        const val MIME_TYPE = "audio/mp4"
    }
}
