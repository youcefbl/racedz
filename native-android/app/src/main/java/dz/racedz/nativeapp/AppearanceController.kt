package dz.racedz.nativeapp

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dz.racedz.nativeapp.core.design.ZidRunThemeMode
import dz.racedz.nativeapp.locale.LocaleManager

/**
 * Holds the theme the UI is currently drawing with, and applies a language change to the OS.
 *
 * Theme and language are *account* settings, synced through /api/v1/me/preferences so the same
 * choice follows a runner between the website and this app. This class is the local view of them:
 * it applies a value immediately (so the control responds instantly) while the network save runs,
 * and reconciles with the account when `/api/v1/me` comes back.
 *
 * The chosen theme is also mirrored into plain SharedPreferences. That mirror is what makes the
 * theme survive a cold start or an Activity recreation (which a language change triggers): the
 * account value needs an authenticated network round trip, and rendering a light frame first and
 * repainting dark a second later is a visible flash. It is a display preference, not a secret, so
 * it does not belong in the encrypted session store.
 */
class AppearanceController(private val context: Context, systemInDarkTheme: Boolean) {

    private val prefs = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    var themeMode by mutableStateOf(
        // No stored choice yet (first launch, or signed out) — follow the system.
        parseTheme(prefs.getString(KEY_THEME, null))
            ?: if (systemInDarkTheme) ZidRunThemeMode.Dark else ZidRunThemeMode.Light
    )
        private set

    /** Applies the values the account returned. Nulls mean "no saved preference", so leave as is. */
    fun apply(theme: String?, language: String?) {
        theme?.let { value ->
            parseTheme(value)?.let {
                themeMode = it
                prefs.edit().putString(KEY_THEME, value).apply()
            }
        }
        // Changing the app locale recreates the Activity; only do it when it actually differs,
        // otherwise every preferences save would restart the screen the user is looking at.
        language?.let {
            if (it != LocaleManager.currentTag(context)) LocaleManager.setLocale(context, it)
        }
    }

    /** Drops the local mirror on sign-out so the next account does not inherit this one's theme. */
    fun clear() {
        prefs.edit().remove(KEY_THEME).apply()
    }

    private fun parseTheme(value: String?): ZidRunThemeMode? = when (value) {
        "light" -> ZidRunThemeMode.Light
        "dark" -> ZidRunThemeMode.Dark
        "race" -> ZidRunThemeMode.Race
        else -> null
    }

    private companion object {
        const val FILE_NAME = "zidrun_appearance"
        const val KEY_THEME = "theme"
    }
}
