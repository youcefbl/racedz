package dz.racedz.nativeapp.core.design

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * WCAG AA contrast for the notice colours, in every theme.
 *
 * Notices are where the app says "stop and see a doctor". A palette that reads as decorative in a
 * design review can still be unreadable in daylight, and the only way to know is to measure — a
 * review of the COACH-F3 work measured light `danger` on `dangerSoft` at 4.41:1, and measuring the
 * rest turned up two more: light `accent` on `accentSoft` at 2.52:1 (the safety caution, and the
 * worst of the three) and race `info` on `infoSoft` at 4.48:1.
 *
 * The threshold is 4.5:1 throughout: notice text is 12sp and 14sp at normal weight, so none of it
 * qualifies for the 3:1 large-text allowance.
 */
class NoticeContrastTest {

    private fun channel(value: Float): Double {
        val c = value.toDouble()
        return if (c <= 0.03928) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
    }

    private fun luminance(color: Color): Double =
        0.2126 * channel(color.red) + 0.7152 * channel(color.green) + 0.0722 * channel(color.blue)

    private fun ratio(foreground: Color, background: Color): Double {
        val a = luminance(foreground)
        val b = luminance(background)
        return (max(a, b) + 0.05) / (min(a, b) + 0.05)
    }

    private fun assertReadable(theme: String, role: String, fg: Color, bg: Color) {
        val measured = ratio(fg, bg)
        assertTrue(
            "$theme $role notice text measures %.2f:1 on its soft background, below the 4.5:1 AA "
                .format(measured) + "minimum for 12–14sp normal-weight text",
            measured >= 4.5
        )
    }

    private val themes = listOf(
        "light" to ZidRunLightColors,
        "dark" to ZidRunDarkColors,
        "race" to ZidRunRaceColors,
    )

    @Test
    fun `urgent notice text is readable in every theme`() {
        themes.forEach { (name, colors) ->
            assertReadable(name, "urgent", colors.dangerContent, colors.dangerSoft)
        }
    }

    @Test
    fun `warning notice text is readable in every theme`() {
        themes.forEach { (name, colors) ->
            assertReadable(name, "warning", colors.accentContent, colors.accentSoft)
        }
    }

    @Test
    fun `informational notice text is readable in every theme`() {
        themes.forEach { (name, colors) ->
            assertReadable(name, "info", colors.infoContent, colors.infoSoft)
        }
    }

    @Test
    fun `the content tokens are the ones that were actually fixed`() {
        // Guards against someone "simplifying" the tokens back to the brand colours: these three
        // pairs are exactly the ones that failed when measured, so if a token is reset to its base
        // colour the assertions above must fail rather than silently pass on a different pair.
        assertTrue(
            "light accentContent should differ from accent — the base measured 2.52:1",
            ZidRunLightColors.accentContent != ZidRunLightColors.accent
        )
        assertTrue(
            "light dangerContent should differ from danger — the base measured 4.41:1",
            ZidRunLightColors.dangerContent != ZidRunLightColors.danger
        )
        assertTrue(
            "race infoContent should differ from info — the base measured 4.48:1",
            ZidRunRaceColors.infoContent != ZidRunRaceColors.info
        )
    }
}
