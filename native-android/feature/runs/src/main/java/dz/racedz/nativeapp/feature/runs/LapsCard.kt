package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.distanceUnitLabel
import dz.racedz.nativeapp.core.design.ZidRunSectionHeader
import dz.racedz.nativeapp.core.design.ZidRunTheme
import java.util.Locale

/** One row of the manual-laps table; the summary derives these on device, Run Details gets them from the server. */
data class LapRow(val index: Int, val meters: Double, val seconds: Int, val paceSecondsPerKm: Int?)

/**
 * The manual laps table (NATRUN-06.5), same card treatment as Splits, which stays separate: laps
 * are what the runner pressed, splits are every kilometre.
 */
@Composable
fun LapsCard(laps: List<LapRow>, locale: Locale, modifier: Modifier = Modifier) {
    if (laps.isEmpty()) return
    val colors = ZidRunTheme.colors
    val unit = distanceUnitLabel()
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        ZidRunSectionHeader(title = stringResource(R.string.runs_laps) + " · " + stringResource(R.string.runs_laps_manual))
        ZidRunCard {
            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Header(stringResource(R.string.runs_lap_index), 32.dp)
                    Header(stringResource(R.string.runs_best_effort_distance).uppercase(locale), 88.dp)
                    Header(stringResource(R.string.runs_best_effort_time).uppercase(locale), 72.dp)
                    Spacer(Modifier.weight(1f))
                    Header(stringResource(R.string.runs_split_pace), null)
                }
                laps.forEach { lap ->
                    val distance = ZidRunFormat.isolate(ZidRunFormat.decimal(lap.meters / 1000.0, locale)) + "\u00A0" + unit
                    val time = ZidRunFormat.duration(lap.seconds)
                    val pace = lap.paceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 32.dp)
                            .semantics(mergeDescendants = true) {
                                contentDescription = "${ZidRunFormat.count(lap.index, locale)}. $distance, $time, $pace"
                            },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(ZidRunFormat.count(lap.index, locale), style = MaterialTheme.typography.bodyMedium, color = colors.textMuted, modifier = Modifier.width(32.dp))
                        Text(distance, style = MaterialTheme.typography.bodyMedium, color = colors.text, modifier = Modifier.width(88.dp))
                        Text(time, style = MaterialTheme.typography.bodyMedium, color = colors.text, modifier = Modifier.width(72.dp))
                        Spacer(Modifier.weight(1f))
                        Text(pace, style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(text: String, width: androidx.compose.ui.unit.Dp?) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = ZidRunTheme.colors.textMuted,
        modifier = if (width != null) Modifier.width(width) else Modifier,
    )
}
