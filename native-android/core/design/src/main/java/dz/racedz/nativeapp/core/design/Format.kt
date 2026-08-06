package dz.racedz.nativeapp.core.design

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalConfiguration
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Locale-aware formatting for the values the API sends as raw ISO strings and numbers.
 *
 * Everything here reads the *current* configuration locale rather than Locale.getDefault(), so a
 * user who switches the in-app language sees dates and numbers change with it — including Arabic,
 * where the month name and the digit shaping both differ.
 */
object ZidRunFormat {

    private val dateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")

    /**
     * "02 NOV 2026" — the compact, upper-case form the race mockups use for every date shown beside
     * a calendar icon. Upper-casing is locale-aware, and Arabic simply has no case, so it is a
     * no-op there rather than a mangling.
     */
    private val compactDateFormat = DateTimeFormatter.ofPattern("dd MMM yyyy")
    private val dateTimeFormat = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm")

    fun date(iso: String, locale: Locale): String = runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(dateFormat.withLocale(locale))
    }.getOrDefault("")

    fun dateCompact(iso: String, locale: Locale): String = runCatching {
        Instant.parse(iso)
            .atZone(ZoneId.systemDefault())
            .format(compactDateFormat.withLocale(locale))
            .uppercase(locale)
    }.getOrDefault("")

    /**
     * Isolated for the same reason as [pace]: "3 أوت 2026, 17:30" contains bidi-neutral "," and ":"
     * that an RTL paragraph reorders into "17:30 ,2026 أوت 3" (DEV-R07). First-strong keeps the
     * Arabic month leading in Arabic and the Latin month leading in en/fr.
     */
    fun dateTime(iso: String, locale: Locale): String = runCatching {
        isolate(Instant.parse(iso).atZone(ZoneId.systemDefault()).format(dateTimeFormat.withLocale(locale)))
    }.getOrDefault("")

    fun money(amount: Int, locale: Locale): String =
        NumberFormat.getIntegerInstance(locale).format(amount)

    /**
     * A plain whole number for a plural's placeholder.
     *
     * Plural resources take `%1$s` and are handed this, rather than `%1$d`: Android formats a
     * `%d` argument with the *resource configuration* locale, which for Arabic is bare `ar` and
     * renders Arabic-Indic digits (٧) — beside a [decimal] value formatted through
     * [currentLocale]'s `ar-DZ` normalisation, that put two numeral systems in one card, which is
     * exactly the defect the numeral rule exists to prevent.
     */
    fun count(value: Int, locale: Locale): String =
        NumberFormat.getIntegerInstance(locale).format(value)

    fun distance(km: Double, locale: Locale): String {
        // Whole kilometres are by far the common case (5K, 10K, 21K) and "10 km" reads better
        // than "10.0 km"; fractional distances keep one decimal.
        val rounded = if (km % 1.0 == 0.0) km.toInt().toString() else String.format(locale, "%.1f", km)
        return "${rounded}K"
    }

    /**
     * "10.0 km" — the long form the race-detail stats strip uses, as distinct from the "10K" chip
     * form above. Always one decimal, because the strip aligns three values side by side and a bare
     * "10" next to "420" reads as a different unit.
     */
    fun kilometres(km: Double, locale: Locale): String = ltr(String.format(locale, "%.1f km", km))

    /** "5.72" — a bare two-decimal distance, for places that show the unit separately. */
    /**
     * [digits] defaults to the two places run distances are quoted in. The Runs overview passes 1,
     * because the website's week hero rounds to a single place and the two clients should not
     * disagree about the same number.
     */
    fun decimal(value: Double, locale: Locale, digits: Int = 2): String =
        String.format(locale, "%.${digits}f", value)

    /**
     * "32:18", or "1:02:45" once a run passes the hour. Hours are only shown when there are any, so
     * the common case stays as short as a stopwatch.
     */
    fun duration(totalSeconds: Int): String {
        val safe = totalSeconds.coerceAtLeast(0)
        val hours = safe / 3600
        val minutes = (safe % 3600) / 60
        val seconds = safe % 60
        // Isolated for the same reason as pace: the ":" separators are bidi-neutral, so an RTL
        // paragraph can otherwise flip "32:13" into "13:32".
        return ltr(
            if (hours > 0) {
                String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds)
            } else {
                String.format(Locale.ROOT, "%d:%02d", minutes, seconds)
            }
        )
    }

    /** "2h 14m" — a weekly total, where seconds are noise. */
    fun durationShort(totalSeconds: Int): String {
        val safe = totalSeconds.coerceAtLeast(0)
        val hours = safe / 3600
        val minutes = (safe % 3600) / 60
        return ltr(if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m")
    }

    /**
     * "5:38/km". Pace is always minutes and seconds per kilometre, never a decimal.
     *
     * Wrapped in a left-to-right isolate. In Arabic the bidi algorithm otherwise reorders the
     * neutral "/" and the trailing Latin "km" around the digits, rendering this as "km/5:38" — the
     * value looks like a ratio of the wrong quantities. The isolate pins the whole token to LTR
     * without affecting the sentence around it, and is invisible in LTR locales.
     */
    fun pace(secondsPerKm: Int): String {
        if (secondsPerKm <= 0) return "—"
        return ltr(String.format(Locale.ROOT, "%d:%02d/km", secondsPerKm / 60, secondsPerKm % 60))
    }

    /**
     * Wraps text whose language is not necessarily the UI's in a *first-strong* isolate.
     *
     * The coach writes in the goal's language, which can be English or French while the app is in
     * Arabic. Dropping that Latin text raw into an RTL paragraph let the bidi algorithm reorder it:
     * on device, "6 × 800 m at 5K effort … Stop at the first sign of pain." rendered starting from
     * "m at 5K…" and ending with "800 × 6" — a runner can misread the prescribed work structure,
     * so this is a safety issue, not a cosmetic one (DEV-R07). U+2068 lets the run's own first
     * strong character pick the direction, so English stays LTR and Arabic replies stay RTL.
     */
    fun isolate(value: String): String =
        if (value.isEmpty()) value else "\u2068$value\u2069"

    /** U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE. */
    private fun ltr(value: String): String = "\u2066$value\u2069"
}

/** The locale currently in effect for the composition. */
@Composable
fun currentLocale(): Locale {
    val configuration = LocalConfiguration.current
    val locale = configuration.locales[0] ?: Locale.getDefault()
    // The app's "ar" is Algerian Darija. A bare Locale("ar") formats numbers with Arabic-Indic
    // digits (٩٫٢), but Algeria — like the rest of the Maghreb — writes Western digits, and the
    // captured screens mixed both systems in one card (finding R5). Pinning the country makes
    // CLDR pick the latn numbering system while keeping Arabic month names and shaping.
    return if (locale.language == "ar" && locale.country.isEmpty()) Locale("ar", "DZ") else locale
}
