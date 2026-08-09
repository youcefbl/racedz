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
 * late is worse than one that has to buffer. Speech is queued as ADD so a kilometre split announced
 * while a step change is still speaking is heard rather than cutting the first off.
 *
 * Three rules, two of them (ALL-R08) about not saying the wrong thing:
 *  - **Never cross-language fallback.** The old code called `setLanguage(Locale.ENGLISH)` when the
 *    device had no voice for the run's language, so Arabic copy was read aloud by an English engine
 *    — unintelligible at the exact moment the runner is being told what to do.
 *  - **Never drop the first cue to a cold engine.** Engine init is asynchronous; a cue spoken before
 *    it is ready is buffered and flushed once the voice accepts it, so the warm-up is not lost.
 *  - **Prefer the runner's own language over silence.** Where ALL-R08 could only choose silence,
 *    a guided-run cue can now be fetched from the server already synthesized in the right language
 *    (NATGAP-09). Silence remains the floor, not the target: no entitlement, no network or a failed
 *    fetch and the cue is simply not spoken — never spoken wrongly.
 *
 * Every call is safe before the engine is ready and after it is released.
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
    private var initDone = false
    /** True only when the engine has a voice for [locale] — no English fallback. */
    private var available = false
    private val pending = mutableListOf<String>()

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
                val result = engine?.setLanguage(locale) ?: TextToSpeech.LANG_NOT_SUPPORTED
                available = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            }
            initDone = true
            // Flush anything queued during init, in order — but only if we actually have the voice.
            val queued: List<String>
            synchronized(pending) { queued = pending.toList(); pending.clear() }
            // Flushed through the same decision as a live cue: to the engine when it has the voice,
            // otherwise to the cloud. Upstream could only drop these when `available` was false;
            // now they are still spoken, in the right language.
            queued.forEach { text ->
                if (available) enqueue(text) else if (fetchCueAudio != null) cloudQueue.trySend(text)
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
        if (!initDone) {
            // Which path this cue takes depends on `available`, which is not known until init
            // finishes. Buffer it rather than guessing — guessing device-first would silently drop
            // the warm-up on a phone with no voice, which is the case this whole class exists for.
            synchronized(pending) { pending.add(text) }
            return
        }
        if (available || fetchCueAudio == null) {
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
        // Both teardowns: the engine's state and buffer, and the cloud queue's coroutine — leaving
        // the scope alive would keep a cue playing after the runner left the screen.
        initDone = false
        available = false
        synchronized(pending) { pending.clear() }
        cloudQueue.close()
        scope.cancel()
        engine?.stop()
        engine?.shutdown()
        engine = null
    }
}
