package dz.racedz.nativeapp

import android.content.Intent
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dz.racedz.nativeapp.core.design.DistanceUnit
import dz.racedz.nativeapp.feature.runs.record.CueClipPlayer
import dz.racedz.nativeapp.feature.runs.record.CueComposer
import dz.racedz.nativeapp.feature.runs.record.RunCue
import dz.racedz.nativeapp.feature.runs.record.RunVoice
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.util.Locale
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The run voice on a real phone (it really plays audio).
 *
 * Cues are composed from voice clips bundled in the APK, so they must play on any phone with no
 * speech engine involved; the device engine is only a fallback (coach replies, out-of-vocabulary
 * values), and on API 30+ the app only sees an engine if its manifest declares the TTS_SERVICE query.
 */
@RunWith(AndroidJUnit4::class)
class RunVoiceDeviceTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun bundledClipsPlayAComposedCueInEveryLanguage() = runBlocking {
        val cue = RunCue.Progress(5.0, 1_650, 330, DistanceUnit.KM)
        for (language in listOf("en", "fr", "ar")) {
            val player = CueClipPlayer(context, language)
            val keys = CueComposer.clips(cue, language)
            assertTrue("clips for $language missing from the APK: $keys", player.canPlay(keys))
            val started = System.currentTimeMillis()
            withTimeout(20_000) { player.play(keys!!) }
            val ms = System.currentTimeMillis() - started
            Log.i(TAG, "$language cue ${keys!!.size} clips played in $ms ms")
            assertTrue("$language cue ended suspiciously fast ($ms ms)", ms > 2_000)
        }
    }

    @Test
    fun appCanSeeATextToSpeechEngine() {
        val engines = context.packageManager.queryIntentServices(Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE), 0)
        Log.i(TAG, "visible TTS engines: ${engines.map { it.serviceInfo.packageName }}")
        assertTrue("no TTS engine visible to the app", engines.isNotEmpty())
    }

    /**
     * The fallback engine search. On this OPPO the default engine (com.oplus.ttsaccessibilityengine)
     * binds but has no voice even for English, so a plain TextToSpeech(context) is silent; RunVoice
     * must move on to another installed engine (Google's) and actually finish speaking.
     */
    @Test
    fun runVoiceFindsAnEngineWithTheLanguageAndSpeaks() = runBlocking {
        for (tag in listOf("en", "fr", "ar")) {
            val voice = RunVoice(context, Locale.forLanguageTag(tag))
            withTimeout(20_000) { while (!voice.ready) kotlinx.coroutines.delay(100) }
            Log.i(TAG, "RunVoice $tag available=${voice.available}")
            if (tag == "en") assertTrue("no engine with an English voice was found", voice.available)
            if (voice.available) {
                val started = System.currentTimeMillis()
                voice.say(if (tag == "ar") "بدا التسجيل" else if (tag == "fr") "Enregistrement démarré" else "Recording started")
                voice.awaitQuiet()
                Log.i(TAG, "RunVoice $tag spoke for ${System.currentTimeMillis() - started} ms")
            }
            voice.release()
        }
    }

    private companion object { const val TAG = "RunVoiceDeviceTest" }
}
