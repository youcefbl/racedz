package dz.racedz.nativeapp.core.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

/**
 * Bidirectional isolation and unit formatting (COACH-F5, COACH-F7).
 *
 * Both findings came from the same place: the coach's language is chosen per goal and is
 * independent of the app's language, so English text routinely lands inside an Arabic RTL layout.
 * Without an isolate, the paragraph direction drags terminal punctuation to the wrong end — the
 * field test photographed ".I felt chest pain and almost fainted during my run" — and a hardcoded
 * Latin "km" put two scripts for one unit on the same screen.
 */
class ZidRunFormatTest {

    private val fsi = '⁨' // FIRST STRONG ISOLATE
    private val lri = '⁦' // LEFT-TO-RIGHT ISOLATE
    private val pdi = '⁩' // POP DIRECTIONAL ISOLATE

    @Test
    fun `an isolated sentence keeps its punctuation inside the isolate`() {
        // The failing case, verbatim. What matters is that the full stop sits INSIDE the isolate:
        // that is what stops the surrounding RTL paragraph from re-ordering it to the front.
        val english = "I felt chest pain and almost fainted during my run."
        val isolated = ZidRunFormat.isolate(english)

        assertEquals(fsi, isolated.first())
        assertEquals(pdi, isolated.last())
        assertTrue("the sentence must end with its own full stop", isolated.dropLast(1).endsWith("run."))
    }

    @Test
    fun `isolation is first-strong, so it works in both directions`() {
        // FSI rather than LRI: the same wrapper has to serve an Arabic reply inside an English
        // layout. Hardcoding LTR here would fix one direction and break the other.
        val arabic = "راكِ في البداية."
        assertEquals(fsi, ZidRunFormat.isolate(arabic).first())
        assertEquals(fsi, ZidRunFormat.isolate("Keep it easy.").first())
    }

    @Test
    fun `an empty string is left alone rather than wrapped in invisible marks`() {
        assertEquals("", ZidRunFormat.isolate(""))
    }

    @Test
    fun `kilometres uses the unit it is given, not a hardcoded one`() {
        val arabic = ZidRunFormat.kilometres(4.0, Locale("ar", "DZ"), "كم")
        assertTrue("the Arabic unit must survive", arabic.contains("كم"))
        assertFalse("no Latin km alongside the Arabic label", arabic.contains("km"))
    }

    @Test
    fun `only the digits are LTR-isolated, never the unit`() {
        // Wrapping the whole string forced an Arabic unit label left-to-right, which is the same
        // class of bug one level down from the one being fixed.
        val arabic = ZidRunFormat.kilometres(4.0, Locale("ar", "DZ"), "كم")
        val closed = arabic.indexOf(pdi)

        assertEquals(lri, arabic.first())
        assertTrue("the isolate must close before the unit", closed in 0 until arabic.indexOf("كم"))
    }

    @Test
    fun `the value cannot wrap away from its unit`() {
        assertTrue(
            "a non-breaking space keeps the number and unit on one line",
            ZidRunFormat.kilometres(4.0, Locale("ar", "DZ"), "كم").contains(' ')
        )
    }

    @Test
    fun `Algerian Arabic formats western digits, not Arabic-Indic`() {
        val arabic = ZidRunFormat.kilometres(4.5, Locale("ar", "DZ"), "كم")
        assertTrue("expected western digits, got $arabic", arabic.contains("4"))
        assertFalse("Arabic-Indic digits must not appear", arabic.any { it in '٠'..'٩' })
    }

    @Test
    fun `English keeps its own unit and decimal point`() {
        val english = ZidRunFormat.kilometres(4.0, Locale.UK, "km")
        assertTrue(english.contains("4.0"))
        assertTrue(english.contains("km"))
    }
}
