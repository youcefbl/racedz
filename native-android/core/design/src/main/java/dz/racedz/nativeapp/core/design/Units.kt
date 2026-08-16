package dz.racedz.nativeapp.core.design

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.stringResource

/**
 * The runner's distance unit (NATRUN-06.8). Kilometres unless the account says miles.
 *
 * Everything is stored and transmitted in metric; this only decides how numbers are *shown*, said,
 * and typed. It is an account preference synced through `/api/v1/me` like the theme — set when the
 * profile loads, changed from Account → Settings, and reset to KM on sign-out so a shared phone
 * never shows the previous runner's choice.
 */
enum class DistanceUnit(val code: String, val meters: Double) {
    KM("km", 1000.0),
    MI("mi", 1609.344);

    companion object {
        fun fromCode(code: String?): DistanceUnit = if (code == "mi") MI else KM
    }
}

object ZidRunUnits {
    /** Observed by every composable that formats a distance or pace, so a change re-renders them. */
    var current: DistanceUnit by mutableStateOf(DistanceUnit.KM)

    fun reset() {
        current = DistanceUnit.KM
    }

    /** Kilometres → the current unit's value. */
    fun fromKm(km: Double, unit: DistanceUnit = current): Double = km * 1000.0 / unit.meters

    /** A value typed in the current unit → kilometres, for anything sent to the server. */
    fun toKm(value: Double, unit: DistanceUnit = current): Double = value * unit.meters / 1000.0

    /** Seconds per kilometre → seconds per current unit. */
    fun paceFromPerKm(secondsPerKm: Int, unit: DistanceUnit = current): Int =
        Math.round(secondsPerKm * unit.meters / 1000.0).toInt()

    /** The localized short unit label ("km" / "mi", "كم" / "ميل"). */
    fun label(context: Context, unit: DistanceUnit = current): String =
        context.getString(if (unit == DistanceUnit.MI) R.string.runs_unit_mi else R.string.runs_unit_km)

    /** The localized long unit word for speech ("kilometres" / "miles"). */
    fun spokenLabel(context: Context, unit: DistanceUnit = current): String =
        context.getString(if (unit == DistanceUnit.MI) R.string.runs_unit_mi_spoken else R.string.runs_unit_km_spoken)
}

@Composable
fun distanceUnitLabel(unit: DistanceUnit = ZidRunUnits.current): String =
    stringResource(if (unit == DistanceUnit.MI) R.string.runs_unit_mi else R.string.runs_unit_km)
