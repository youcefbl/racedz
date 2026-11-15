package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** How every run cue is routed: spoken guidance, so the system ducks music and uses the headset. */
internal val CUE_AUDIO_ATTRIBUTES: AudioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

/**
 * Plays a cue from the voice clips bundled in the APK (`assets/cues/<language>/<key>.mp3`).
 *
 * This is what makes the run voice work on every phone: no speech engine, language pack, network
 * or entitlement is involved — only MediaPlayer and an MP3, which every Android version has.
 *
 * Clips are chained with [MediaPlayer.setNextMediaPlayer], so the platform starts the next one the
 * instant the previous ends: separately started players leave an audible hiccup between "5" and
 * "kilometres". All players for a cue are prepared before the first starts.
 */
class CueClipPlayer(context: Context, val language: String) {

    private val assets = context.applicationContext.assets

    /** Keys shipped for [language], read once from the APK. */
    private val available: Set<String> = runCatching {
        assets.list("cues/$language").orEmpty()
            .filter { it.endsWith(".mp3") }
            .map { it.removeSuffix(".mp3") }
            .toSet()
    }.getOrDefault(emptySet())

    fun canPlay(keys: List<String>?): Boolean = !keys.isNullOrEmpty() && keys.all { it in available }

    /** Plays [keys] in order and suspends until the last clip ends (or anything fails). */
    suspend fun play(keys: List<String>) {
        val players = mutableListOf<MediaPlayer>()
        try {
            for (key in keys) {
                val player = MediaPlayer()
                players += player
                player.setAudioAttributes(CUE_AUDIO_ATTRIBUTES)
                assets.openFd("cues/$language/$key.mp3").use { fd ->
                    player.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
                }
                player.prepare()
            }
        } catch (error: Exception) {
            players.forEach { runCatching { it.release() } }
            throw error
        }
        for (i in 0 until players.size - 1) players[i].setNextMediaPlayer(players[i + 1])

        suspendCancellableCoroutine { continuation ->
            var finished = false
            fun finish() {
                if (finished) return
                finished = true
                players.forEach { runCatching { it.release() } }
                if (continuation.isActive) continuation.resume(Unit)
            }
            players.last().setOnCompletionListener { finish() }
            players.forEach { it.setOnErrorListener { _, _, _ -> finish(); true } }
            continuation.invokeOnCancellation { finish() }
            runCatching { players.first().start() }.onFailure { finish() }
        }
    }
}

/**
 * Transient, duck-others audio focus for the length of one burst of cues, so the runner's music
 * dips under the voice and comes back — the same contract navigation apps use.
 */
internal class CueAudioFocus(context: Context) {
    private val audio = context.applicationContext.getSystemService(AudioManager::class.java)
    private val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(CUE_AUDIO_ATTRIBUTES)
        .setOnAudioFocusChangeListener { }
        .build()

    fun acquire() {
        runCatching { audio?.requestAudioFocus(request) }
    }

    fun release() {
        runCatching { audio?.abandonAudioFocusRequest(request) }
    }
}
