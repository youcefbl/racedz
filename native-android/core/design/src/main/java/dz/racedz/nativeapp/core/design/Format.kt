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
    private val dateTimeFormat = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm")

    fun date(iso: String, locale: Locale): String = runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(dateFormat.withLocale(locale))
    }.getOrDefault("")

    fun dateTime(iso: String, locale: Locale): String = runCatching {
        Instant.parse(iso).atZone(ZoneId.systemDefault()).format(dateTimeFormat.withLocale(locale))
    }.getOrDefault("")

    fun money(amount: Int, locale: Locale): String =
        NumberFormat.getIntegerInstance(locale).format(amount)

    fun distance(km: Double, locale: Locale): String {
        // Whole kilometres are by far the common case (5K, 10K, 21K) and "10 km" reads better
        // than "10.0 km"; fractional distances keep one decimal.
        val rounded = if (km % 1.0 == 0.0) km.toInt().toString() else String.format(locale, "%.1f", km)
        return "${rounded}K"
    }
}

/** The locale currently in effect for the composition. */
@Composable
fun currentLocale(): Locale {
    val configuration = LocalConfiguration.current
    return configuration.locales[0] ?: Locale.getDefault()
}
