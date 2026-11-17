package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AskCoachRequest
import dz.racedz.nativeapp.core.network.LiveRunSnapshotDto
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
 * server enforces it regardless. Both voice and text are supported: voice is transcribed into the
 * composer for the runner to check and send, text is for when speaking is not possible.
 *
 * The question is about *this* run, so each ask carries a typed [LiveRunSnapshotDto] of what the
 * recorder sees at that moment (server `coachLiveRunSchema`) — a separate field, never text spliced
 * into the runner's words.
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
    /** The question [reply] answers, kept on screen above it (it used to vanish on send). */
    val question: String? = null,
    /** The latest reply, shown in the sheet (and spoken when cues are on). */
    val reply: String? = null,
    /**
     * AI coaching needs a current health-data consent, given on the goal — not possible mid-run.
     * Known up front from the overview, or learned from a refusal; the sheet then explains that
     * instead of offering a composer that can only fail.
     */
    val consentNeeded: Boolean = false,
    val error: String? = null,
) {
    val busy: Boolean get() = asking || transcribing
}

class MidRunCoachViewModel(private val coach: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(MidRunCoachUiState())
    val state: StateFlow<MidRunCoachUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            resolveCoachEntitlement(
                check = {
                    when (val result = coach.overview()) {
                        is ApiResult.Success -> {
                            if (result.value.healthConsentActive == false) _state.update { it.copy(consentNeeded = true) }
                            if (result.value.entitlement.tier != "NONE") EntitlementCheck.Entitled else EntitlementCheck.NotEntitled
                        }
                        is ApiResult.Failure ->
                            if (result.error.requiresSignIn) EntitlementCheck.SignedOut else EntitlementCheck.Unavailable
                    }
                },
                onResult = { canCoach -> _state.update { it.copy(canCoach = canCoach, ready = true) } },
            )
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
     * Only the runner's own words are sent. An earlier version prefixed a bracketed live snapshot to
     * the message, but that is stored/shown as runner-authored text, leaks technical English into
     * every locale, and is spoofable (ALL-R09) — and the server still could not use it for safety. A
     * proper mid-run request with a typed, provenance-tagged live snapshot is a Coach-contract change
     * tracked for later; until then the coach answers as general CHAT rather than misattributing text.
     */
    fun ask(
        message: String,
        speak: (String) -> Unit,
        snapshot: () -> LiveRunSnapshotDto? = {
            RunRecorder.state.value.toCoachSnapshot(
                guided = GuidedSessionController.state.value.session != null,
            )
        },
    ) {
        val trimmed = message.trim()
        if (trimmed.isEmpty() || _state.value.asking) return
        _state.update { it.copy(asking = true, error = null, reply = null, question = trimmed) }
        val requestId = requestIdFor(trimmed)
        viewModelScope.launch {
            val request = AskCoachRequest(
                type = "CHAT",
                message = trimmed,
                requestId = requestId,
                liveRun = snapshot(),
            )
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
                is ApiResult.Failure -> _state.update {
                    if (result.error.code == dz.racedz.nativeapp.core.network.ApiErrorCode.ConsentRequired) {
                        // The server's text says "open your goal and save it" — not something to do
                        // mid-run. The sheet shows its own explanation instead.
                        it.copy(asking = false, question = null, consentNeeded = true, error = null)
                    } else {
                        it.copy(asking = false, error = result.error.message)
                    }
                }
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

    override fun onCleared() {
        // A transcription in flight when the screen closes must not leave its audio behind.
        pendingVoiceFile?.delete()
        pendingVoiceFile = null
        super.onCleared()
    }
}

/**
 * The live snapshot sent with a mid-run question, or null when there is no run in progress.
 *
 * Every value is clamped to the server's bounds (`coachLiveRunSchema`) so a GPS glitch — a 20 s/km
 * "pace" from a jump, a strap reading 0 bpm — becomes a missing value instead of a rejected
 * question. Pace and HR outside the plausible range are dropped, not clamped: a clamped number
 * would be a made-up one.
 */
internal fun RecordingState.toCoachSnapshot(guided: Boolean): LiveRunSnapshotDto? {
    val liveStatus = when {
        status == RecordingStatus.Paused && autoPaused -> "AUTO_PAUSED"
        status == RecordingStatus.Paused -> "PAUSED"
        status == RecordingStatus.Recording || status == RecordingStatus.Acquiring ->
            if (autoPaused) "AUTO_PAUSED" else "RECORDING"
        else -> return null
    }
    fun pace(value: Int?) = value?.takeIf { it in 60..7_200 }
    fun bpm(value: Int?) = value?.takeIf { it in 30..240 }
    return LiveRunSnapshotDto(
        sport = sport.takeIf { it in setOf("RUN", "WALK", "TRAIL", "RIDE") } ?: "RUN",
        status = liveStatus,
        elapsedSeconds = elapsedSeconds.coerceIn(0, 172_800),
        movingSeconds = movingSeconds.coerceIn(0, 172_800),
        distanceKm = (Math.round(distanceKm.coerceIn(0.0, 400.0) * 100) / 100.0),
        currentPaceSecondsPerKm = pace(currentPaceSecondsPerKm),
        averagePaceSecondsPerKm = pace(averagePaceSecondsPerKm),
        // Newest 60, oldest first — the server's cap, and plenty for any question about the run.
        splitPacesSecondsPerKm = splits.mapNotNull { pace(it.paceSecondsPerKm) }.takeLast(60),
        elevationGainM = Math.round(elevationGainM.coerceIn(0.0, 10_000.0)).toDouble(),
        heartRateBpm = bpm(heartRateBpm),
        averageHeartRateBpm = bpm(averageHeartRate),
        cadenceSpm = (liveCadenceSpm ?: avgCadenceSpm)?.takeIf { it in 30..260 },
        guidedWorkout = guided,
    )
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

/** What one entitlement lookup said. [Unavailable] (offline, server error) is not an answer. */
internal enum class EntitlementCheck { Entitled, NotEntitled, Unavailable, SignedOut }

/**
 * Resolves whether the coach button shows, retrying while the answer is unknown.
 *
 * A failed lookup used to mean "not entitled" for the whole run, so a dropped connection at the
 * start line hid the coach until the next run even after signal came back. Now only a real answer
 * (or a signed-out session) settles it; an unavailable lookup reports "hidden for now" and tries
 * again with backoff (15 s doubling to 2 min) for as long as the recording screen lives.
 */
internal suspend fun resolveCoachEntitlement(
    check: suspend () -> EntitlementCheck,
    onResult: (canCoach: Boolean) -> Unit,
    wait: suspend (Long) -> Unit = { kotlinx.coroutines.delay(it) },
) {
    var backoffMs = ENTITLEMENT_RETRY_START_MS
    while (true) {
        when (check()) {
            EntitlementCheck.Entitled -> { onResult(true); return }
            EntitlementCheck.NotEntitled, EntitlementCheck.SignedOut -> { onResult(false); return }
            EntitlementCheck.Unavailable -> {
                onResult(false)
                wait(backoffMs)
                backoffMs = (backoffMs * 2).coerceAtMost(ENTITLEMENT_RETRY_MAX_MS)
            }
        }
    }
}

private const val ENTITLEMENT_RETRY_START_MS = 15_000L
private const val ENTITLEMENT_RETRY_MAX_MS = 120_000L
