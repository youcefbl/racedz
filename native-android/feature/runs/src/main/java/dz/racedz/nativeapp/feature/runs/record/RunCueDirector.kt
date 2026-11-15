package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.content.res.Configuration
import dz.racedz.nativeapp.core.design.ZidRunUnits
import dz.racedz.nativeapp.core.design.localeOf
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Decides what the run voice says and when, for the life of a recording — screen on or off.
 *
 * This used to live in the recording screen's composition, whose state collection stops whenever
 * the app is not in the foreground: with the phone in a pocket, no cue could ever fire (and guided
 * steps did not advance). It is now started by [RunTrackingService] and reacts to
 * [RunRecorder.state] directly, so it runs exactly as long as the run does.
 *
 * Each cue is spoken from the bundled clips when the vocabulary covers it ([CueComposer] +
 * [CueClipPlayer]) — the default on every phone — and otherwise by the device engine ([RunVoice]).
 * Cues are spoken one at a time, in order, under transient duck-others audio focus.
 */
object RunCueDirector {

    private var scope: CoroutineScope? = null
    private var appContext: Context? = null
    private var queue: Channel<RunCue>? = null

    /** The app language the recording screen is showing; wins over the process default. */
    @Volatile private var localeOverride: Locale? = null

    // Per-run decision state.
    private var lastStatus: RecordingStatus? = null
    private var announcedFirstStep = false
    private var announcedSessionDone = false
    private val guidedCues = GuidedCueEngine()

    // Speech resources, rebuilt only if the language changes mid-run.
    private var clipPlayer: CueClipPlayer? = null
    private var deviceVoice: VoiceForLocale? = null
    private var focus: CueAudioFocus? = null

    val isRunning: Boolean get() = scope != null

    /**
     * The last cues spoken this process, newest last, as "Kind:path" (path = clips | device |
     * silent). Bounded. Read by the on-device voice test and handy in a bug report; never sent.
     */
    val recentlySpoken: List<String> get() = synchronized(spokenLog) { spokenLog.toList() }
    private val spokenLog = ArrayDeque<String>()

    private fun remember(cue: RunCue, path: String) {
        val entry = "${cue::class.simpleName}:$path"
        android.util.Log.i("RunCueDirector", entry)
        synchronized(spokenLog) {
            spokenLog.addLast(entry)
            while (spokenLog.size > 50) spokenLog.removeFirst()
        }
    }

    /** Sets the language cues are spoken in (the screen's app language). */
    fun setLocale(locale: Locale) {
        localeOverride = locale
    }

    /** Starts for the current recording; idempotent, so a service restart does not double cues. */
    fun start(context: Context) {
        if (scope != null) return
        appContext = context.applicationContext
        focus = CueAudioFocus(context)
        lastStatus = null
        announcedFirstStep = false
        announcedSessionDone = false
        guidedCues.reset()
        val newScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate).also { scope = it }
        val channel = Channel<RunCue>(capacity = 16).also { queue = it }
        newScope.launch { speakLoop(channel) }
        newScope.launch {
            RunRecorder.state.collect { state -> onState(state) }
        }
    }

    /** Speaks a coach reply (device engine only — generated prose is not in the clip vocabulary). */
    fun sayText(text: String) {
        if (text.isNotBlank()) enqueue(RunCue.FreeText(text))
    }

    /** Stops at once (discard, sign-out). */
    fun stop() {
        scope?.cancel()
        scope = null
        queue?.close()
        queue = null
        focus?.release()
        releaseVoices()
    }

    private fun enqueue(cue: RunCue) {
        if (!RunSettings.audioCuesEnabled) return
        queue?.trySend(cue)
    }

    // ---- What to say -----------------------------------------------------------------------------

    private fun onState(state: RecordingState) {
        when (state.status) {
            RecordingStatus.Idle -> { stop(); return }
            RecordingStatus.Finished -> { onFinished(state); return }
            else -> Unit
        }
        onStatusChange(state)
        onProgress(state)
        onGuided(state)
    }

    /**
     * Started / paused / resumed, spoken on the transition only — never for the state the director
     * found on start, so a service restart into a running recording stays silent.
     */
    private fun onStatusChange(state: RecordingState) {
        val previous = lastStatus
        lastStatus = state.status
        if (previous == null || previous == state.status) return
        when {
            previous == RecordingStatus.Acquiring && state.status == RecordingStatus.Recording -> enqueue(RunCue.Started)
            state.status == RecordingStatus.Paused -> enqueue(RunCue.Paused)
            previous == RecordingStatus.Paused && state.status == RecordingStatus.Recording -> enqueue(RunCue.Resumed)
        }
    }

    /** Distance, time and the pace held over the interval just closed, every N units. */
    private fun onProgress(state: RecordingState) {
        val interval = RunSettings.cueInterval
        if (interval.meters <= 0) return
        val index = (state.distanceMeters / interval.meters).toInt()
        if (index <= 0) return
        val mark = ProgressCueTracker.advance(state.clientId, index, state.elapsedSeconds) ?: return
        // Only when this mark closes exactly one interval — a GPS catch-up jumping several marks, or
        // a re-entry after process death, would otherwise average across a gap.
        val closesOne = mark.previousIndex == index - 1 && mark.secondsSincePrevious > 0
        val pace = if (closesOne) (mark.secondsSincePrevious / interval.units).toInt() else null
        enqueue(RunCue.Progress(index * interval.units, state.elapsedSeconds, pace, ZidRunUnits.current))
    }

    private fun onGuided(state: RecordingState) {
        val guided = GuidedSessionController.state.value
        if (guided.session == null) return
        // The first step (the warm-up) is announced once; advanceIfDue only reports transitions.
        if (!announcedFirstStep) {
            guided.currentStep?.let {
                announcedFirstStep = true
                enqueue(RunCue.Step(it.role, it.seconds, it.meters))
            }
        }
        if (state.status != RecordingStatus.Recording) return
        val entered = GuidedSessionController.advanceIfDue(state.elapsedSeconds, state.distanceMeters)
        when {
            entered != null -> {
                // The rep just finished, then the one starting — the order the runner needs.
                guidedCues.onStepChanged(entered, state.elapsedSeconds)?.let { enqueue(RunCue.RepSplit(it.seconds)) }
                enqueue(RunCue.Step(entered.role, entered.seconds, entered.meters))
            }
            GuidedSessionController.state.value.isComplete -> {
                // Once: the screen version re-queued "session complete" on every tick after the end.
                if (!announcedSessionDone) {
                    announcedSessionDone = true
                    guidedCues.onStepChanged(null, state.elapsedSeconds)?.let { enqueue(RunCue.RepSplit(it.seconds)) }
                    enqueue(RunCue.SessionDone)
                }
            }
            else -> guidedCues.onTick(
                step = guided.currentStep,
                elapsedSecondsInStep = GuidedSessionController.elapsedInStep(state.elapsedSeconds),
                metersInStep = GuidedSessionController.metersInStep(state.distanceMeters),
                totalElapsedSeconds = state.elapsedSeconds,
            ).forEach { enqueue(RunCue.Tip(it)) }
        }
    }

    /** "Run finished…", then the voice is let go once it has been heard. */
    private fun onFinished(state: RecordingState) {
        if (lastStatus == RecordingStatus.Finished) return
        lastStatus = RecordingStatus.Finished
        enqueue(RunCue.Finished(state.distanceKm, state.elapsedSeconds, ZidRunUnits.current))
        queue?.close() // the speak loop drains what is queued, then releases
    }

    // ---- Saying it -------------------------------------------------------------------------------

    private suspend fun speakLoop(channel: Channel<RunCue>) {
        try {
            while (true) {
                var cue: RunCue? = channel.receiveCatching().getOrNull() ?: break
                focus?.acquire()
                while (cue != null) {
                    // Bounded, so a wedged player or engine cannot stall every later cue.
                    withTimeoutOrNull(CUE_TIMEOUT_MS) { speak(cue!!) }
                    cue = channel.tryReceive().getOrNull()
                }
                focus?.release()
            }
        } finally {
            focus?.release()
            // Channel closed: either finished (drained) or stopped. Either way the run is over.
            releaseVoices()
            if (queue === channel) {
                queue = null
                scope?.cancel()
                scope = null
            }
        }
    }

    private suspend fun speak(cue: RunCue) {
        val context = localizedContext() ?: return
        val language = cueLanguage(context)
        val player = clipPlayer?.takeIf { it.language == language }
            ?: CueClipPlayer(context, language).also { clipPlayer = it }
        val keys = CueComposer.clips(cue, language)
        if (player.canPlay(keys)) {
            val played = runCatching { player.play(keys!!) }.isSuccess
            if (played) {
                remember(cue, "clips")
                return
            }
        }
        // Outside the clip vocabulary (or a clip failed): the device engine, if it has the voice.
        val locale = localeOf(context)
        val voice = deviceVoice?.takeIf { it.localeTag == locale.toLanguageTag() }
            ?: VoiceForLocale(RunVoice(context, locale), locale.toLanguageTag()).also {
                deviceVoice?.voice?.release()
                deviceVoice = it
            }
        voice.voice.say(cue.text(context))
        voice.voice.awaitQuiet()
        remember(cue, if (voice.voice.available) "device" else "silent")
    }

    private fun localizedContext(): Context? {
        val base = appContext ?: return null
        val locale = localeOverride ?: return base
        val config = Configuration(base.resources.configuration).apply { setLocale(locale) }
        return base.createConfigurationContext(config)
    }

    private fun cueLanguage(context: Context): String = when (localeOf(context).language) {
        "fr" -> "fr"
        "ar" -> "ar"
        else -> "en"
    }

    private fun releaseVoices() {
        deviceVoice?.voice?.release()
        deviceVoice = null
        clipPlayer = null
    }

    private class VoiceForLocale(val voice: RunVoice, val localeTag: String)

    private const val CUE_TIMEOUT_MS = 30_000L
}

/**
 * Which progress mark was last spoken for which recording. Process-level, so a restart of the
 * director neither repeats the last mark nor measures the next interval from the moment of return.
 */
internal object ProgressCueTracker {
    var clientId: String = ""
    var lastIndex: Int = 0
    var lastElapsedSeconds: Int = 0

    class Mark(val secondsSincePrevious: Int, val previousIndex: Int)

    /** Records [index] as spoken and returns how far it is from the previous mark, or null if not new. */
    fun advance(clientId: String, index: Int, elapsedSeconds: Int): Mark? {
        if (this.clientId != clientId) {
            this.clientId = clientId
            lastIndex = 0
            lastElapsedSeconds = 0
        }
        if (index <= lastIndex) return null
        val mark = Mark(elapsedSeconds - lastElapsedSeconds, lastIndex)
        lastIndex = index
        lastElapsedSeconds = elapsedSeconds
        return mark
    }
}
