package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Spoken cues during a run.
 *
 * Uses Android's own TextToSpeech rather than the streamed cloud voice the web app falls back to:
 * on a run the phone is often out of signal, and a cue that arrives late — or not at all — is worse
 * than one in a plainer voice. Speech is queued as ADD so a kilometre split announced while a step
 * change is still speaking is heard rather than cutting the first off.
 *
 * Every call is safe before the engine is ready and after it is released; a missing or still-loading
 * voice simply means no cue, never a crash mid-run.
 */
class RunVoice(context: Context, private val locale: Locale) {

    private var engine: TextToSpeech? = null
    private var ready = false

    init {
        engine = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = engine?.setLanguage(locale)
                // A device with no data for this language falls back to whatever it does have,
                // rather than speaking nothing at all.
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    engine?.setLanguage(Locale.ENGLISH)
                }
                ready = true
            }
        }
    }

    fun say(text: String) {
        if (!ready || text.isBlank()) return
        engine?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    fun release() {
        ready = false
        engine?.stop()
        engine?.shutdown()
        engine = null
    }
}
