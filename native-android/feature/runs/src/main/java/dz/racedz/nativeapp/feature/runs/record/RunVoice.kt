package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.speech.tts.TextToSpeech
import java.io.File
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Spoken cues during a run.
 *
 * Device text-to-speech first: on a run the phone is often out of signal, and a cue that arrives
 * late — or not at all — is worse than one in a plainer voice.
 *
 * When the device has no voice for the runner's language, it falls back to the server's synthesized
 * audio. This is not a nicety. The M21 has no `ara-DZA` voice, and the old behaviour was to call
 * `setLanguage(Locale.ENGLISH)` and carry on — which meant an English voice reading Arabic text
 * aloud, phonetic nonsense at the exact moment the runner is being told what to do. Silence would
 * have been better; the runner's own language is better still.
 *
 * Every call is safe before the engine is ready and after it is released; a missing voice, a failed
 * fetch or a dead network simply means no cue, never a crash mid-run.
 */
class RunVoice(
    private val context: Context,
    private val locale: Locale,
    /**
     * Fetches server-synthesized audio for a cue, or null. Absent in previews and wherever the
     * runner has no coach entitlement — the endpoint is gated, so there is nothing to fall back to.
     */
    private val fetchCueAudio: (suspend (String, String) -> ByteArray?)? = null,
) {

    private var engine: TextToSpeech? = null
    private var ready = false

    /**
     * Whether the device can actually speak [locale].
     *
     * The distinction the old code collapsed: "the engine started" is not "the engine can say this
     * in the runner's language".
     */
    private var deviceHasVoice = false

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Cloud cues are played one at a time, in order.
     *
     * A rendezvous-free buffered channel rather than launching a coroutine per cue: two overlapping
     * MediaPlayers talking over each other is worse than a cue arriving a second late, and the
     * device path already serialises through TextToSpeech's own QUEUE_ADD.
     */
    private val cloudQueue = Channel<String>(capacity = 8)

    init {
        engine = TextToSpeech(context.applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val result = engine?.setLanguage(locale)
                deviceHasVoice =
                    result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
                ready = true
            }
        }
        scope.launch {
            for (text in cloudQueue) {
                val audio = cachedOrFetch(text) ?: continue
                playBlocking(audio)
            }
        }
    }

    /**
     * Speaks a guided-run cue: a split, a step change, the finish.
     *
     * Only cues go through here. The server's synthesis endpoint accepts an allowlist of known
     * coaching phrases precisely so it cannot be used as general text-to-speech, and honouring that
     * on the client keeps arbitrary text from ever being sent.
     */
    fun sayCue(text: String) {
        if (text.isBlank()) return
        if (deviceHasVoice || fetchCueAudio == null) {
            say(text)
            return
        }
        cloudQueue.trySend(text)
    }

    /**
     * Speaks arbitrary text on the device only — a coach reply read aloud, for instance.
     *
     * Never routed to the cloud voice: generated prose is exactly what the endpoint's allowlist
     * exists to refuse, and sending it would be both a rejected request and the wrong instinct.
     */
    fun say(text: String) {
        if (!ready || text.isBlank()) return
        engine?.speak(text, TextToSpeech.QUEUE_ADD, null, text.hashCode().toString())
    }

    /**
     * The cue's audio, from disk if it has been heard before.
     *
     * Cues repeat constantly — every kilometre, every step of an interval session — and the audio
     * is content-addressed by (locale, text), so the first run of a session pays for them and every
     * later one is free and works offline. The server disk-caches the same synthesis; this keeps
     * the request off the network entirely.
     */
    private suspend fun cachedOrFetch(text: String): ByteArray? {
        val cacheDir = File(context.cacheDir, "cues").apply { mkdirs() }
        val key = "${locale.language}-${text.hashCode().toUInt().toString(16)}.mp3"
        val file = File(cacheDir, key)
        if (file.exists() && file.length() > 0) return runCatching { file.readBytes() }.getOrNull()

        val audio = fetchCueAudio?.invoke(text, locale.language) ?: return null
        if (audio.isEmpty()) return null
        // Best-effort: a full cache directory must not stop the cue being spoken this time.
        runCatching { file.writeBytes(audio) }
        return audio
    }

    /** Plays one cue and suspends until it finishes, so queued cues do not overlap. */
    private suspend fun playBlocking(audio: ByteArray) {
        val temp = runCatching {
            File.createTempFile("cue-", ".mp3", context.cacheDir).apply { writeBytes(audio) }
        }.getOrNull() ?: return

        suspendCancellableCoroutine { continuation ->
            val player = MediaPlayer()
            var finished = false
            fun finish() {
                if (finished) return
                finished = true
                runCatching { player.release() }
                runCatching { temp.delete() }
                if (continuation.isActive) continuation.resume(Unit)
            }
            runCatching {
                player.setAudioAttributes(
                    AudioAttributes.Builder()
                        // Spoken guidance, not music: this is what tells the system to duck the
                        // runner's playlist rather than compete with it.
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                player.setDataSource(temp.absolutePath)
                player.setOnCompletionListener { finish() }
                player.setOnErrorListener { _, _, _ -> finish(); true }
                player.prepare()
                player.start()
            }.onFailure { finish() }
            continuation.invokeOnCancellation { finish() }
        }
    }

    fun release() {
        ready = false
        deviceHasVoice = false
        cloudQueue.close()
        scope.cancel()
        engine?.stop()
        engine?.shutdown()
        engine = null
    }
}
