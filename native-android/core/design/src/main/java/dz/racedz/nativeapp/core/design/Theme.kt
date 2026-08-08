package dz.racedz.nativeapp.core.design

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

/** The three ZidRun modes (PRODUCT.md, native-design/NATIVE_APP_DESIGN_FLOW.md). No fourth mode. */
enum class ZidRunThemeMode {
    Light,
    Dark,
    Race,
}

val ZidRunThemeMode.isDarkBase: Boolean
    get() = this == ZidRunThemeMode.Dark || this == ZidRunThemeMode.Race

private val LocalZidRunColors = staticCompositionLocalOf { ZidRunLightColors }
private val LocalZidRunThemeMode = staticCompositionLocalOf { ZidRunThemeMode.Light }

/** Mirrors the `MaterialTheme` companion-object ergonomics: `ZidRunTheme.colors.primary`. */
object ZidRunTheme {
    val colors: ZidRunColors
        @Composable get() = LocalZidRunColors.current

    val mode: ZidRunThemeMode
        @Composable get() = LocalZidRunThemeMode.current

    /**
     * The wordmark variant that reads on the current theme's background. Kept here so no screen has
     * to decide which of the three brand files to draw — picking the wrong one is how a logo ends
     * up invisible in dark mode.
     */
    val wordmarkRes: Int
        @Composable get() = when (LocalZidRunThemeMode.current) {
            ZidRunThemeMode.Light -> R.drawable.ic_zidrun_wordmark_light
            ZidRunThemeMode.Dark -> R.drawable.ic_zidrun_wordmark_dark
            ZidRunThemeMode.Race -> R.drawable.ic_zidrun_wordmark_race
        }
}

private fun materialColorScheme(colors: ZidRunColors, mode: ZidRunThemeMode) = if (mode.isDarkBase) {
    darkColorScheme(
        primary = colors.primary,
        onPrimary = colors.onPrimary,
        secondary = colors.accent,
        onSecondary = colors.onAccent,
        tertiary = colors.info,
        background = colors.background,
        onBackground = colors.foreground,
        surface = colors.surface,
        onSurface = colors.foreground,
        surfaceVariant = colors.surfaceMuted,
        onSurfaceVariant = colors.text,
        error = colors.danger,
        onError = colors.surface,
        errorContainer = colors.dangerSoft,
        outline = colors.border,
        outlineVariant = colors.borderStrong,
    )
} else {
    lightColorScheme(
        primary = colors.primary,
        onPrimary = colors.onPrimary,
        secondary = colors.accent,
        onSecondary = colors.onAccent,
        tertiary = colors.info,
        background = colors.background,
        onBackground = colors.foreground,
        surface = colors.surface,
        onSurface = colors.foreground,
        surfaceVariant = colors.surfaceMuted,
        onSurfaceVariant = colors.text,
        error = colors.danger,
        onError = colors.surface,
        errorContainer = colors.dangerSoft,
        outline = colors.border,
        outlineVariant = colors.borderStrong,
    )
}

@Composable
fun ZidRunTheme(
    mode: ZidRunThemeMode,
    content: @Composable () -> Unit,
) {
    val zidRunColors = when (mode) {
        ZidRunThemeMode.Light -> ZidRunLightColors
        ZidRunThemeMode.Dark -> ZidRunDarkColors
        ZidRunThemeMode.Race -> ZidRunRaceColors
    }
    val colorScheme = remember(mode) { materialColorScheme(zidRunColors, mode) }

    CompositionLocalProvider(
        LocalZidRunColors provides zidRunColors,
        LocalZidRunThemeMode provides mode,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ZidRunTypography,
            content = content,
        )
    }
}

/**
 * Pins the platform status/navigation bar icons to their light (white) form for as long as the
 * caller is on screen, restoring the app theme's own choice on the way out.
 *
 * The record screens deliberately render on a dark surface in every theme. Driving system-bar
 * appearance from the app theme alone therefore drew black clock, battery and signal icons onto a
 * black screen whenever the app was in Light — precisely while a run was being started or
 * controlled outdoors (DEV-R01). Appearance has to follow the *surface underneath the bars*, not
 * the theme setting.
 */
@Composable
fun ZidRunDarkSurfaceSystemBars() {
    val view = androidx.compose.ui.platform.LocalView.current
    if (view.isInEditMode) return
    val restoreToLight = ZidRunTheme.mode == ZidRunThemeMode.Light
    androidx.compose.runtime.DisposableEffect(restoreToLight) {
        val window = (view.context as? android.app.Activity)?.window
        val controller = window?.let { androidx.core.view.WindowCompat.getInsetsController(it, view) }
        darkSurfaceScreens.incrementAndGet()
        controller?.isAppearanceLightStatusBars = false
        controller?.isAppearanceLightNavigationBars = false
        onDispose {
            // Navigating from one dark-surface screen straight to the next composes the incoming
            // screen before disposing the outgoing one, so an unconditional restore here runs last
            // and hands the *new* screen the theme's bar appearance. That is how starting a run in
            // Light went from white icons on the pre-run screen to black-on-black the moment the
            // live screen appeared. Only the last dark surface to leave restores.
            if (darkSurfaceScreens.decrementAndGet() <= 0) {
                controller?.isAppearanceLightStatusBars = restoreToLight
                controller?.isAppearanceLightNavigationBars = restoreToLight
            }
        }
    }
}

/** How many dark-surface screens are currently composed. Single-activity app, so one counter. */
private val darkSurfaceScreens = java.util.concurrent.atomic.AtomicInteger(0)
