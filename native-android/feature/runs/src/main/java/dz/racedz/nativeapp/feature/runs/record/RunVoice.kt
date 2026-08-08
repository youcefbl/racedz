package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Spoken cues during a run.
 *
 * Uses Android's own TextToSpeech rather than the streamed cloud voice the web app falls back to:
 * on a run the phone is often out of signal, and a cue that arrives late is worse than one that has
 * to buffer. Speech is queued as ADD so a kilometre split announced while a step change is still
 * speaking is heard rather than cutting the first off.
 *
 * Two correctness rules (ALL-R08):
 *  - **Never cross-language fallback.** If the device has no voice for the run's language we stay
 *    silent rather than pronouncing Arabic/French copy with an English engine — the start screen
 *    already prompts the runner to install a voice. Silent + visible steps beats mispronounced.
 *  - **Never drop the first cue to a cold engine.** Engine init is asynchronous; a cue spoken before
 *    it is ready is buffered and flushed once the (matching) voice accepts it, so the warm-up
 *    announcement is not lost.
 *
 * Every call is safe before the engine is ready and after it is released.
 */
class RunVoice(context: Context, private val locale: Locale) {

    private var engine: TextToSpeech? = null
    private var initDone = false
    /** True only when the engine has a voice for [locale] — no English fallback. */
    private var available = false
    private val pending = mutableListOf<String>()

    init {
        engine = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = engine?.setLanguage(locale) ?: TextToSpeech.LANG_NOT_SUPPORTED
                available = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            }
            initDone = true
            // Flush anything queued during init, in order — but only if we actually have the voice.
            val queued: List<String>
            synchronized(pending) { queued = pending.toList(); pending.clear() }
            if (available) queued.forEach { enqueue(it) }
        }
    }

    fun say(text: String) {
        if (text.isBlank()) return
        if (!initDone) {
            // Engine still loading: hold the cue so a cold start does not swallow the first one.
            synchronized(pending) { pending.add(text) }
            return
        }
        if (!available) return
        enqueue(text)
    }

    private fun enqueue(text: String) {
        engine?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    fun release() {
        initDone = false
        available = false
        synchronized(pending) { pending.clear() }
        engine?.stop()
        engine?.shutdown()
        engine = null
    }
}
