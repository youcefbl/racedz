package dz.racedz.nativeapp.core.design

import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * [syncedFieldValue] decides where the caret lands whenever a caller hands ZidRunTextField text the
 * runner did not type. Every shared field in the app goes through it, so the cases below cover the
 * reformat it was written for *and* the ordinary fields that must not change behaviour.
 */
class SyncedFieldValueTest {

    /** Types one character at a time through the caller's formatter, as the real field does. */
    private fun typeThrough(format: (String) -> String, keys: String): TextFieldValue {
        var field = TextFieldValue("", TextRange(0))
        var lastEmitted = ""
        for (key in keys) {
            // The IME inserts at the caret.
            val typed = field.text.substring(0, field.selection.start) + key +
                field.text.substring(field.selection.end)
            val caret = field.selection.start + 1
            field = TextFieldValue(typed, TextRange(caret))
            lastEmitted = typed

            val formatted = format(typed)
            if (formatted != field.text) {
                field = syncedFieldValue(current = field, incoming = formatted, lastEmitted = lastEmitted)
                lastEmitted = formatted
            }
        }
        return field
    }

    /** The registration date of birth: digits in, dashes inserted by the view model. */
    private fun isoDate(raw: String): String {
        val digits = raw.filter(Char::isDigit).take(8)
        return buildString {
            append(digits.take(4))
            if (digits.length > 4) {
                append('-').append(digits.drop(4).take(2))
                if (digits.length > 6) append('-').append(digits.drop(6))
            }
        }
    }

    @Test
    fun `typing a date on the numeric keypad produces the date that was typed`() {
        val field = typeThrough(::isoDate, "19960521")
        assertEquals("1996-05-21", field.text)
        assertEquals(TextRange(10), field.selection)
    }

    @Test
    fun `the caret sits after the digit just typed, not before the inserted dash`() {
        val afterFourth = typeThrough(::isoDate, "1996")
        assertEquals("1996", afterFourth.text)
        assertEquals(TextRange(4), afterFourth.selection)

        val afterFifth = typeThrough(::isoDate, "19960")
        assertEquals("1996-0", afterFifth.text)
        assertEquals(TextRange(6), afterFifth.selection)
    }

    @Test
    fun `deleting a digit keeps the caret on the surviving text`() {
        // "1996-05-21" with the trailing "1" removed by backspace.
        val current = TextFieldValue("1996-05-2", TextRange(9))
        val synced = syncedFieldValue(current = current, incoming = "1996-05-2", lastEmitted = "1996-05-2")
        assertEquals("1996-05-2", synced.text)
        assertEquals(TextRange(9), synced.selection)
    }

    @Test
    fun `deleting back across a separator lands before the separator, not after it`() {
        // The runner backspaced the "0" out of "1996-05"; the formatter drops the now-empty dash.
        val current = TextFieldValue("1996-5", TextRange(6))
        val synced = syncedFieldValue(current = current, incoming = "1996-5", lastEmitted = "1996-5")
        assertEquals(TextRange(6), synced.selection)
    }

    @Test
    fun `an async prefill puts the caret at the end, not at zero`() {
        // Registration prefills first name from the profile after the screen is already composed.
        val empty = TextFieldValue("", TextRange(0))
        val synced = syncedFieldValue(current = empty, incoming = "Device", lastEmitted = "")
        assertEquals("Device", synced.text)
        assertEquals(TextRange(6), synced.selection)
    }

    @Test
    fun `replacing the value wholesale moves the caret to the end`() {
        val current = TextFieldValue("1996-05-21", TextRange(3))
        val synced = syncedFieldValue(current = current, incoming = "2001-01-01", lastEmitted = "1996-05-21")
        assertEquals(TextRange(10), synced.selection)
    }

    @Test
    fun `clearing the field collapses the caret to zero`() {
        val current = TextFieldValue("1996-05-21", TextRange(10))
        val synced = syncedFieldValue(current = current, incoming = "", lastEmitted = "1996-05-21")
        assertEquals("", synced.text)
        assertEquals(TextRange(0), synced.selection)
    }

    @Test
    fun `a caller that clamps length sends the caret to the new end`() {
        val current = TextFieldValue("0555123456789", TextRange(13))
        val synced = syncedFieldValue(current = current, incoming = "0555123456", lastEmitted = "0555123456789")
        assertEquals("0555123456", synced.text)
        assertEquals(TextRange(10), synced.selection)
    }

    @Test
    fun `punctuation in free text is preserved and the caret still tracks content`() {
        // A caller that trims a double space keeps the same letters, so this is a reformat.
        val current = TextFieldValue("knee  pain, mild", TextRange(12))
        val synced = syncedFieldValue(
            current = current,
            incoming = "knee pain, mild",
            lastEmitted = "knee  pain, mild",
        )
        assertEquals("knee pain, mild", synced.text)
        // Caret was after the 8th letter/digit ("knee pai|n"); it stays there.
        assertEquals(8, synced.text.take(synced.selection.end).count(Char::isLetterOrDigit))
    }

    @Test
    fun `arabic digits reformatted to western keep the caret at the same position`() {
        // The DOB view model maps Arabic-Indic digits to ASCII, which is a content change, so this
        // is a replacement and the caret goes to the end rather than to a stale offset.
        val current = TextFieldValue("١٩٩٦", TextRange(4))
        val synced = syncedFieldValue(current = current, incoming = "1996", lastEmitted = "١٩٩٦")
        assertEquals("1996", synced.text)
        assertEquals(TextRange(4), synced.selection)
    }

    @Test
    fun `an unchanged value is never resynced by the caller`() {
        // The field only calls this when text differs; asserting the no-op keeps that contract
        // explicit if the guard is ever moved.
        val current = TextFieldValue("Amina Benali", TextRange(5))
        val synced = syncedFieldValue(current = current, incoming = "Amina Benali", lastEmitted = "Amina Benali")
        assertEquals("Amina Benali", synced.text)
        assertEquals(TextRange(5), synced.selection)
    }

    @Test
    fun `a password field is untouched by the reformat path`() {
        // Ordinary fields echo back exactly what was typed, so the caret never moves.
        var field = TextFieldValue("", TextRange(0))
        var lastEmitted = ""
        for (key in "Pass123!") {
            val typed = field.text + key
            field = TextFieldValue(typed, TextRange(typed.length))
            lastEmitted = typed
            if (typed != field.text) {
                field = syncedFieldValue(field, typed, lastEmitted)
            }
        }
        assertEquals("Pass123!", field.text)
        assertEquals(TextRange(8), field.selection)
    }
}
