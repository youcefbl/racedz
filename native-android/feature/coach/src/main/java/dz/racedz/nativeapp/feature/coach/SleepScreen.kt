package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunSectionHeader
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.SleepEntryDto
import kotlin.math.min

/** The longest night the bars are scaled against. Beyond this the bar is simply full. */
private const val BAR_SCALE_MINUTES = 9 * 60f

/**
 * Sleep & recovery (05-sleep-recovery-v2.png): log last night, and see recent nights as a bar chart.
 *
 * Sleep is health data. It is only ever sent when the runner types it — nothing is read from the
 * device, no sensors, no Health Connect — and the plan's rule against syncing health text without
 * explicit consent is what keeps it that way.
 */
@Composable
fun SleepScreen(
    viewModel: SleepViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    var hours by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onBack)

        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.error != null && state.entries.isEmpty() -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
            )

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
            ) {
                ZidRunDisplayTitle(text = stringResource(R.string.coach_sleep_title))

                ZidRunCard {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        Text(
                            stringResource(R.string.coach_sleep_log),
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.textStrong,
                        )
                        ZidRunTextField(
                            value = hours,
                            onValueChange = { hours = it.filter { c -> c.isDigit() || c == '.' }.take(4) },
                            label = stringResource(R.string.coach_sleep_hours),
                            keyboardType = KeyboardType.Decimal,
                            enabled = !state.saving,
                        )
                        ZidRunTextField(
                            value = note,
                            onValueChange = { note = it.take(300) },
                            label = stringResource(R.string.coach_sleep_note),
                            enabled = !state.saving,
                        )
                        state.saveError?.let { ZidRunInlineError(it) }
                        if (state.savedAt != null) {
                            Text(
                                stringResource(R.string.coach_sleep_saved),
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.success,
                            )
                        }
                        ZidRunButton(
                            text = stringResource(R.string.coach_sleep_log),
                            onClick = {
                                viewModel.log(hours.toDoubleOrNull(), note.trim().takeIf { it.isNotEmpty() }) {
                                    hours = ""
                                    note = ""
                                }
                            },
                            enabled = hours.toDoubleOrNull() != null && !state.saving,
                            loading = state.saving,
                        )
                    }
                }

                if (state.entries.isEmpty()) {
                    ZidRunStatusView(
                        icon = Icons.Filled.Bedtime,
                        title = stringResource(R.string.coach_sleep_empty_title),
                        body = stringResource(R.string.coach_sleep_empty_body),
                    )
                } else {
                    ZidRunSectionHeader(title = stringResource(R.string.coach_sleep_history))
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            state.entries.forEach { entry -> SleepRow(entry, locale) }
                        }
                    }
                }

                Spacer(Modifier.height(ZidRunDimens.spaceXxl))
            }
        }
    }
}

@Composable
private fun SleepRow(entry: SleepEntryDto, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    val hours = entry.durationMinutes / 60
    val minutes = entry.durationMinutes % 60
    val label = if (minutes == 0) "${hours}h" else "${hours}h ${minutes}m"
    val fraction = min(1f, entry.durationMinutes / BAR_SCALE_MINUTES)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = "${ZidRunFormat.dateCompact(entry.night, locale)} $label"
            },
    ) {
        Text(
            text = ZidRunFormat.dateCompact(entry.night, locale),
            style = MaterialTheme.typography.bodySmall,
            color = colors.textMuted,
            modifier = Modifier.width(96.dp),
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(colors.surfaceMuted),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(fraction)
                    .height(10.dp)
                    .clip(RoundedCornerShape(5.dp))
                    // Under seven hours reads as a short night; the colour says so without
                    // pronouncing on whether it was "bad", which is the coach's call, not the UI's.
                    .background(if (entry.durationMinutes >= 7 * 60) colors.primary else colors.accent),
            )
        }
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Text(label, style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
    }
}
