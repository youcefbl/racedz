package dz.racedz.nativeapp.locale

import android.app.LocaleManager as PlatformLocaleManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import java.util.Locale

/**
 * Wraps Android's per-app language API. On API 33+ this calls the platform LocaleManager service
 * directly — AppCompatDelegate's static setApplicationLocales() only reliably persists a change
 * when it is driven from an AppCompatActivity lifecycle, which this Compose-only app does not use,
 * so it silently no-ops here. Below API 33, AppCompatDelegate is the only available mechanism.
 * Locales mirror src/lib/i18n.ts LOCALES exactly: en/fr/ar, where "ar" carries Algerian Darija
 * phrasing rather than a fourth locale code. Setting a new app locale recreates the current
 * Activity with the new configuration; there is no separate Compose state to keep in sync.
 */
object LocaleManager {
    private val supportedTags = listOf("en", "fr", "ar")

    fun currentTag(context: Context): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val platformLocales = context.getSystemService(PlatformLocaleManager::class.java)
                ?.applicationLocales
            val tag = platformLocales?.takeIf { !it.isEmpty }?.get(0)?.language
            if (tag != null && supportedTags.contains(tag)) return tag
        } else {
            val applied = AppCompatDelegate.getApplicationLocales()
            if (!applied.isEmpty) {
                val tag = applied[0]?.language
                if (tag != null && supportedTags.contains(tag)) return tag
            }
        }
        val systemTag = Locale.getDefault().language
        return if (supportedTags.contains(systemTag)) systemTag else "en"
    }

    fun currentLanguageLabel(context: Context): String = when (currentTag(context)) {
        "fr" -> "FR"
        "ar" -> "AR"
        else -> "EN"
    }

    /** Applies a locale chosen in Account > Profile & preferences. Recreates the Activity. */
    fun setLocale(context: Context, tag: String) {
        val target = if (supportedTags.contains(tag)) tag else "en"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.getSystemService(PlatformLocaleManager::class.java)?.applicationLocales =
                LocaleList.forLanguageTags(target)
        } else {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(target))
        }
    }
}
