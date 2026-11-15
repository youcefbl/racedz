package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.design.DistanceUnit
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The run voice is composed from bundled clips. A key the composer emits but the APK lacks would
 * silently fall back to a device engine that may not exist — so every cue the app can produce in
 * normal use is composed here and each key checked against the generated manifests.
 */
class CueComposerTest {

    private val manifests: Map<String, Set<String>> = listOf("en", "fr", "ar").associateWith { lang ->
        val file = File("src/main/assets/cues/$lang/manifest.json")
        assertTrue("missing ${file.path} — run npm run cues:generate", file.exists())
        Regex("\"([a-z0-9_]+)\":\\s*\\{").findAll(file.readText()).map { it.groupValues[1] }.toSet()
    }

    private fun assertCovered(cue: RunCue) {
        for ((lang, keys) in manifests) {
            val clips = CueComposer.clips(cue, lang)
            assertNotNull("$cue not composable in $lang", clips)
            val missing = clips!!.filterNot { it in keys }
            assertTrue("$cue in $lang needs missing clips $missing", missing.isEmpty())
        }
    }

    @Test
    fun everyEverydayCueIsCoveredInEveryLanguage() {
        listOf(RunCue.Started, RunCue.Paused, RunCue.Resumed, RunCue.SessionDone).forEach(::assertCovered)
        GuidedCueEngine.Cue.entries.forEach { assertCovered(RunCue.Tip(it)) }
        for (unit in DistanceUnit.entries) {
            // Every progress mark up to an ultra (half-unit intervals), with realistic times/paces.
            for (half in 1..200) {
                val units = half / 2.0
                assertCovered(RunCue.Progress(units, (units * 330).toInt() + 7, 240 + half % 600, unit))
            }
        }
        for (seconds in listOf(1, 59, 60, 61, 3_599, 3_600, 3_661, 35_999)) assertCovered(RunCue.RepSplit(seconds))
        for (role in listOf("WARMUP", "WORK", "RECOVERY", "COOLDOWN", "STEADY")) {
            listOf(RunCue.Step(role, 20, null), RunCue.Step(role, 600, null), RunCue.Step(role, null, 400),
                RunCue.Step(role, null, 1_000), RunCue.Step(role, null, 1_600), RunCue.Step(role, null, 1_234))
                .forEach(::assertCovered)
        }
        assertCovered(RunCue.Finished(5.234, 1_800, DistanceUnit.KM))
        assertCovered(RunCue.Finished(42.195, 14_400, DistanceUnit.MI))
    }

    @Test
    fun composesTheExpectedPhrases() {
        assertEquals(
            listOf("num_5", "unit_km", "word_time", "min_27", "sec_30", "word_pace", "min_5", "sec_30", "per_km"),
            CueComposer.clips(RunCue.Progress(5.0, 1_650, 330, DistanceUnit.KM), "en"),
        )
        // Darija joins the parts of a duration with و, baked into the following clip.
        assertEquals(
            listOf("num_2", "word_point", "num_5", "unit_km", "word_time", "hr_1", "min_and_2", "sec_and_3"),
            CueComposer.clips(RunCue.Progress(2.5, 3_723, null, DistanceUnit.KM), "ar"),
        )
        assertEquals(listOf("num_1", "unit_mi_one"), CueComposer.distance(10, DistanceUnit.MI))
        assertEquals(listOf("step_work"), CueComposer.clips(RunCue.Step("WORK", null, 1_234), "fr"))
    }

    @Test
    fun outOfVocabularyFallsBackToSpeech() {
        assertNull(CueComposer.clips(RunCue.Progress(150.0, 60, null, DistanceUnit.KM), "en"))
        assertNull(CueComposer.clips(RunCue.FreeText("Slow down a little."), "en"))
        assertNull(CueComposer.pace(3_700, DistanceUnit.KM, ar = false))
    }
}
