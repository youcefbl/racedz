package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale
import kotlinx.coroutines.delay

/**
 * The device speech engine, as the run voice's *fallback*.
 *
 * Cues are normally spoken from bundled clips ([CueClipPlayer]); this speaks only what the clips
 * cannot — a coach reply, or a value outside the clip vocabulary. Two rules carried over:
 *
 *  - **Never cross-language fallback** (ALL-R08): Arabic copy read by an English voice is
 *    unintelligible at the moment the runner is being told what to do. No voice → silence.
 *  - **But look for the voice before giving up.** Phones ship several engines and the default is
 *    often an OEM one with few languages (an OPPO PLG110 defaults to `com.oplus.ttsaccessibility
 *    engine`, beside Google's). When the default has no voice for [locale], every other installed
 *    engine is tried in turn.
 *
 * Text spoken before the engine is ready is buffered and flushed once a voice is found. Every call
 * is safe before init and after [release].
 */
class RunVoice(context: Context, private val locale: Locale) {

    private val appContext = context.applicationContext
    private var engine: TextToSpeech? = null
    @Volatile private var initDone = false
    /** True only when the engine has a voice for [locale]. */
    @Volatile var available = false
        private set
    private val pending = mutableListOf<String>()
    private var released = false

    init {
        connect(enginePackage = null, fallbacks = null)
    }

    /**
     * Binds an engine; on a missing voice, moves on to the next installed one. [fallbacks] is null
     * on the first (default) attempt and is filled from that engine's list of installed engines.
     */
    private fun connect(enginePackage: String?, fallbacks: List<String>?) {
        var created: TextToSpeech? = null
        created = TextToSpeech(appContext, { status ->
            val tts = created ?: return@TextToSpeech
            if (released) { tts.shutdown(); return@TextToSpeech }
            val hasVoice = status == TextToSpeech.SUCCESS && tts.setLanguage(locale).let {
                it != TextToSpeech.LANG_MISSING_DATA && it != TextToSpeech.LANG_NOT_SUPPORTED
            }
            val remaining = fallbacks ?: runCatching {
                tts.engines.map { it.name }.filter { it != tts.defaultEngine }
            }.getOrDefault(emptyList())
            if (!hasVoice && remaining.isNotEmpty()) {
                tts.shutdown()
                connect(remaining.first(), remaining.drop(1))
                return@TextToSpeech
            }
            if (hasVoice) tts.setAudioAttributes(CUE_AUDIO_ATTRIBUTES)
            engine = tts
            available = hasVoice
            initDone = true
            val queued: List<String>
            synchronized(pending) { queued = pending.toList(); pending.clear() }
            if (hasVoice) queued.forEach(::enqueue)
        }, enginePackage)
    }

    /** True once the engine search has finished, with or without a voice. */
    val ready: Boolean get() = initDone

    fun say(text: String) {
        if (text.isBlank() || released) return
        if (!initDone) {
            synchronized(pending) { pending.add(text) }
            return
        }
        if (available) enqueue(text)
    }

    /** Suspends until the engine has finished speaking (bounded), so cues never talk over each other. */
    suspend fun awaitQuiet(timeoutMs: Long = 20_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        // Give a just-queued utterance a moment to start before polling whether it is speaking.
        delay(250)
        while ((!initDone || engine?.isSpeaking == true) && System.currentTimeMillis() < deadline) delay(150)
    }

    private fun enqueue(text: String) {
        engine?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    fun release() {
        released = true
        initDone = false
        available = false
        synchronized(pending) { pending.clear() }
        engine?.stop()
        engine?.shutdown()
        engine = null
    }
}
