package dz.racedz.nativeapp.locale

import android.content.Context
import android.content.res.Configuration
import android.os.LocaleList
import java.util.Locale

/**
 * Pins a bare Arabic locale to Algeria, so every number Android formats is in Western digits.
 *
 * The app's Arabic is Algerian Darija, and Algeria writes 0–9. A bare `ar` formats `%d` in string
 * resources with Arabic-Indic digits, so on 2026-11-17 the run history read "٦٥ جَريات · 527,80 كم"
 * — two digit systems in one line — wherever a resource carried `%d` (18 strings: steps, races,
 * plans, counts). `ar-DZ` still resolves `values-ar` but formats with Latin digits, the same rule
 * ZidRunFormat already applies to its own numbers (normaliseLocale).
 */
object AlgerianDigits {

    fun wrap(base: Context): Context {
        val locales = base.resources.configuration.locales
        if (locales.isEmpty) return base
        val first = locales[0]
        if (first.language != "ar" || first.country.isNotEmpty()) return base
        val pinned = buildList {
            add(Locale("ar", "DZ"))
            for (i in 1 until locales.size()) add(locales[i])
        }
        val config = Configuration(base.resources.configuration)
        config.setLocales(LocaleList(*pinned.toTypedArray()))
        return base.createConfigurationContext(config)
    }
}
