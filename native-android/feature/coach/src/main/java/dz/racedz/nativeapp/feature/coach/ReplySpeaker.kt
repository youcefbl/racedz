package dz.racedz.nativeapp.feature.coach

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Speaks a coach reply out loud using the device's OWN text-to-speech engine (COACHPAR-001).
 *
 * Deliberately not the server's /api/coach/tts endpoint: that endpoint is allow-listed to guided-run
 * cue phrases (T0-R03) precisely so it can never be used to synthesize arbitrary text, and a coach
 * reply is arbitrary text. Speaking it on-device also means the reply is not sent anywhere to be
 * read aloud, and playback works with no network at all.
 *
 * The language is the one the reply was WRITTEN in — the coach answers in the goal's language, not
 * the phone's — so the caller passes it in. A device with no installed voice for that language is a
 * normal outcome, reported as [State.Unsupported] rather than mispronounced by a fallback voice.
 */
class ReplySpeaker(context: Context) {

    sealed interface State {
        /** The engine is still starting up, or has not been asked for anything yet. */
        data object Idle : State
        data class Speaking(val messageId: String) : State
        /** No voice is installed for the requested language. */
        data object Unsupported : State
        data object Unavailable : State
    }

    private var engine: TextToSpeech? = null
    private var ready = false
    private var pending: Pair<String, Request>? = null
    private var onState: ((State) -> Unit)? = null

    private data class Request(val text: String, val locale: Locale)

    init {
        engine = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (!ready) {
                emit(State.Unavailable)
            } else {
                engine?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        utteranceId?.let { emit(State.Speaking(it)) }
                    }

                    override fun onDone(utteranceId: String?) = emit(State.Idle)

                    @Deprecated("Required by the platform base class")
                    override fun onError(utteranceId: String?) = emit(State.Unavailable)

                    override fun onError(utteranceId: String?, errorCode: Int) = emit(State.Unavailable)
                })
                // A tap that arrived while the engine was still initializing is honoured now rather
                // than silently dropped.
                pending?.let { (id, request) -> speak(id, request.text, request.locale) }
                pending = null
            }
        }
    }

    fun observeState(listener: (State) -> Unit) {
        onState = listener
    }

    /** Speaks [text] as [messageId]; speaking a second reply replaces the first rather than queueing. */
    fun speak(messageId: String, text: String, locale: Locale) {
        val tts = engine
        if (tts == null) {
            emit(State.Unavailable)
            return
        }
        if (!ready) {
            pending = messageId to Request(text, locale)
            return
        }
        when (tts.setLanguage(locale)) {
            TextToSpeech.LANG_MISSING_DATA, TextToSpeech.LANG_NOT_SUPPORTED -> {
                emit(State.Unsupported)
                return
            }
        }
        emit(State.Speaking(messageId))
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, messageId)
    }

    fun stop() {
        engine?.stop()
        pending = null
        emit(State.Idle)
    }

    /** Releases the engine. The screen must call this: a leaked TextToSpeech keeps a service bound. */
    fun release() {
        pending = null
        onState = null
        engine?.stop()
        engine?.shutdown()
        engine = null
        ready = false
    }

    private fun emit(state: State) {
        onState?.invoke(state)
    }

    companion object {
        /**
         * The coach writes in the goal's language. Arabic replies are Algerian Darija, which no TTS
         * engine ships as its own voice — Modern Standard Arabic is the closest installed voice and
         * is understood, so it is the deliberate fallback rather than refusing to speak.
         */
        fun localeFor(language: String?): Locale = when (language) {
            "fr" -> Locale.FRENCH
            "ar" -> Locale("ar")
            else -> Locale.ENGLISH
        }
    }
}
