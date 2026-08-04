package dz.racedz.nativeapp.feature.coach

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Records a short voice note for the coach (COACHPAR-001).
 *
 * Deliberately small and explicit rather than a general audio abstraction: the microphone is opened
 * only between [start] and [stop], the recording is written to the app's own cache directory, and
 * [discard] deletes it. Nothing here survives the transcription round-trip — a voice note is
 * arbitrary runner speech, symptoms and injuries included, and the plan's rule is that local data
 * stays minimal.
 *
 * MPEG_4/AAC is chosen because every supported device can produce it and the server accepts the
 * container; the sample rate is kept low because speech recognition gains nothing from more and a
 * smaller file is a shorter upload on a weak connection.
 */
class VoiceNoteRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var output: File? = null

    val isRecording: Boolean get() = recorder != null

    /** Starts recording. Throws if the microphone is unavailable; the caller reports that as an error. */
    fun start() {
        stopSilently()
        val file = File.createTempFile("coach-note-", ".m4a", context.cacheDir)
        val created = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
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
        recorder = created
        output = file
    }

    /**
     * Stops and returns the recording, or null when nothing usable was captured (a tap so short the
     * encoder wrote no frames, or a device that failed mid-record). A null is not an error state —
     * the caller simply has nothing to transcribe.
     */
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
            // stop() throws when the recording was too short to produce a valid file. The partial
            // file is unusable, so it is removed rather than uploaded.
            active.release()
            file?.delete()
            null
        }
    }

    /** Abandons an in-flight recording and leaves nothing on disk. */
    fun cancel() {
        val file = output
        stopSilently()
        file?.delete()
    }

    /** Deletes a finished recording once it has been transcribed (or failed to be). */
    fun discard(file: File?) {
        file?.delete()
    }

    private fun stopSilently() {
        val active = recorder ?: return
        recorder = null
        output = null
        try {
            active.stop()
        } catch (_: RuntimeException) {
            // Already stopped or never produced a frame — nothing to salvage.
        }
        active.release()
    }

    companion object {
        /** Matches the container produced above and the server's allow-list. */
        const val MIME_TYPE = "audio/mp4"
    }
}
