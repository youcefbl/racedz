package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import kotlin.math.roundToInt

/**
 * The Start screen's GPS status: phone-network-style bars, a word, and the one number that backs
 * it — the fix accuracy when there is a fresh fix, else how many satellites are in view.
 * See [GpsSignalLevel] for where the bars come from.
 */
@Composable
internal fun GpsSignalChip(warmup: GpsWarmupState, modifier: Modifier = Modifier) {
    val colors = zidRunOnDarkColors()
    val locale = currentLocale()
    val level = if (warmup.permitted) warmup.signal else GpsSignalLevel.None
    // Before the first satellite report there is nothing to judge: "Searching", not "No signal".
    val justStarted = warmup.gnss == null && !warmup.fixFresh
    val word = when {
        // Never "GPS ready" before there is any permission to read GPS with.
        !warmup.permitted -> stringResource(R.string.runs_gps_permission_needed)
        justStarted -> stringResource(R.string.runs_gps_searching)
        else -> stringResource(level.labelRes())
    }
    val detail = when {
        !warmup.permitted -> null
        warmup.fixFresh && warmup.accuracyM != null ->
            stringResource(R.string.runs_gps_accuracy, ZidRunFormat.count(warmup.accuracyM.roundToInt().coerceAtLeast(1), locale))
        warmup.gnss != null ->
            pluralStringResource(
                R.plurals.runs_gps_satellites,
                warmup.gnss.satellitesInView,
                ZidRunFormat.count(warmup.gnss.satellitesInView, locale),
            )
        else -> null
    }
    val lit = when {
        level.bars >= GpsSignalLevel.Good.bars -> colors.primary
        level == GpsSignalLevel.Fair -> colors.accent
        else -> colors.danger
    }
    val textColor = if (level.recordable) colors.textStrong else colors.textMuted
    val spoken = stringResource(
        R.string.runs_gps_signal_a11y,
        word,
        ZidRunFormat.count(level.bars, locale),
        ZidRunFormat.count(GpsSignalLevel.MAX_BARS, locale),
    ) + (detail?.let { ", $it" } ?: "")

    Row(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        SignalBars(bars = level.bars, lit = lit, unlit = colors.borderStrong)
        Text(
            text = listOfNotNull("GPS", word, detail).joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium,
            color = textColor,
            // One line whatever the state, so the signal changing never moves the screen below it.
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/**
 * The line under the GPS chip, always the same height so nothing below it moves when location is
 * granted or the signal changes: the Enable GPS action before permission (a second refusal sends
 * the runner to Settings, where Android requires it), then what the warm-up is doing.
 */
@Composable
internal fun GpsActionSlot(
    warmup: GpsWarmupState,
    deniedOnce: Boolean,
    onEnable: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = zidRunOnDarkColors()
    // Exactly one height in every state: ZidRunButton's own minimum (52 dp), which two lines of the
    // hint also fit inside. A min height let the button state run 11 px taller (measured on the M21).
    Box(modifier = modifier.fillMaxWidth().height(GPS_ACTION_SLOT_HEIGHT), contentAlignment = Alignment.Center) {
        if (!warmup.permitted) {
            dz.racedz.nativeapp.core.design.ZidRunButton(
                text = stringResource(if (deniedOnce) R.string.runs_gps_open_settings else R.string.runs_gps_enable),
                onClick = if (deniedOnce) onOpenSettings else onEnable,
                containerColor = colors.primary,
                contentColor = colors.onPrimary,
            )
        } else {
            Text(
                text = stringResource(if (warmup.signal.recordable) R.string.runs_gps_ready_hint else R.string.runs_gps_warming_hint),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/**
 * Four rising bars, bottom-aligned, like a phone's network icon; the first [bars] are lit. Always
 * rising left to right, in Arabic too — it is an icon, not text, and the system's own signal icon
 * does not mirror.
 */
@Composable
private fun SignalBars(bars: Int, lit: Color, unlit: Color) = CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
    Row(
        modifier = Modifier.height(BAR_MAX_HEIGHT),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        for (i in 1..GpsSignalLevel.MAX_BARS) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(BAR_MAX_HEIGHT * i / GpsSignalLevel.MAX_BARS)
                    .clip(RoundedCornerShape(1.dp))
                    .background(if (i <= bars) lit else unlit),
            )
        }
    }
}

private val BAR_MAX_HEIGHT = 16.dp

/** ZidRunButton's minimum height; see [GpsActionSlot]. */
private val GPS_ACTION_SLOT_HEIGHT = 52.dp

/**
 * What a runner can actually do about a weak fix, shown on the Start screen only after the search
 * has dragged on (see [shouldShowGpsTips]). Ends with the reassurance that starting anyway is fine:
 * the clock runs and distance starts when the signal is good, and a run with no fix at all can
 * still be saved with a step estimate.
 */
@Composable
internal fun GpsTipsCard(modifier: Modifier = Modifier) {
    val colors = zidRunOnDarkColors()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Text(
            text = stringResource(R.string.runs_gps_tips_title),
            style = MaterialTheme.typography.titleSmall,
            color = colors.textStrong,
        )
        listOf(
            R.string.runs_gps_tip_outside,
            R.string.runs_gps_tip_still,
            R.string.runs_gps_tip_battery,
        ).forEach { tip ->
            // Bullet in its own column so a wrapped line hangs under the text, not the bullet.
            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                Text(text = "•", style = MaterialTheme.typography.bodySmall, color = colors.text)
                Text(
                    text = stringResource(tip),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.text,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Text(
            text = stringResource(R.string.runs_gps_tip_start_anyway),
            style = MaterialTheme.typography.bodySmall,
            color = colors.textMuted,
        )
    }
}

private fun GpsSignalLevel.labelRes(): Int = when (this) {
    GpsSignalLevel.None -> R.string.runs_gps_level_none
    GpsSignalLevel.Weak -> R.string.runs_gps_level_weak
    GpsSignalLevel.Fair -> R.string.runs_gps_level_fair
    GpsSignalLevel.Good -> R.string.runs_gps_level_good
    GpsSignalLevel.Excellent -> R.string.runs_gps_level_excellent
}
