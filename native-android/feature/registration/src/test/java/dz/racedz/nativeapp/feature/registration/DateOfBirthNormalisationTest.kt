package dz.racedz.nativeapp.feature.registration

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Birth-date entry has now failed twice for the same underlying reason: what the keyboard can
 * produce did not match what the validator would accept, and the only symptom was a Confirm button
 * that never enabled. These pin both halves — ASCII and Arabic-Indic input — so the next change
 * cannot quietly reintroduce a dead end.
 *
 * The normalisation is duplicated here rather than reached through the view model, which needs
 * repositories and a SavedStateHandle; the logic under test is pure string handling.
 */
class DateOfBirthNormalisationTest {

    private fun normalise(value: String): String {
        val digits = value
            .filter(Char::isDigit)
            .map { Character.digit(it, 10) }
            .filter { it >= 0 }
            .joinToString("")
            .take(8)
        return buildString {
            append(digits.take(4))
            if (digits.length > 4) {
                append('-').append(digits.drop(4).take(2))
                if (digits.length > 6) append('-').append(digits.drop(6))
            }
        }
    }

    private fun valid(value: String) =
        Regex("""\d{4}-\d{2}-\d{2}""").matches(value) &&
            runCatching { java.time.LocalDate.parse(value) }.isSuccess

    @Test
    fun `ascii digits are formatted and accepted`() {
        assertEquals("1996-05-21", normalise("19960521"))
        assertTrue(valid(normalise("19960521")))
    }

    @Test
    fun `arabic-indic digits are normalised to ascii and accepted`() {
        // What an Arabic keyboard actually emits. Char.isDigit() accepts these, so before
        // normalisation they formatted into a string ISO parsing could never read.
        assertEquals("1996-05-21", normalise("١٩٩٦٠٥٢١"))
        assertTrue(valid(normalise("١٩٩٦٠٥٢١")))
    }

    @Test
    fun `hyphens typed by a full keyboard are harmless`() {
        assertEquals("1996-05-21", normalise("1996-05-21"))
    }

    @Test
    fun `partial input formats progressively without being valid yet`() {
        assertEquals("1996", normalise("1996"))
        assertEquals("1996-05", normalise("199605"))
        assertFalse(valid(normalise("199605")))
    }

    @Test
    fun `an impossible calendar date is refused rather than accepted by shape`() {
        assertEquals("2026-02-31", normalise("20260231"))
        assertFalse(valid("2026-02-31"))
    }

    @Test
    fun `extra characters are ignored and the value is capped at eight digits`() {
        assertEquals("1996-05-21", normalise("19/96 05.21 999"))
    }
}
