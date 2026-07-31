package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.feature.runs.RunMap

/**
 * What the runner sees after Finish and before the run is stored.
 *
 * Nothing has been saved at this point, so the numbers shown are the recorder's own. Title, notes
 * and effort are collected here rather than defaulted, because they are the parts only the runner
 * knows — and asking afterwards, once the run is in a list, is asking a question nobody goes back
 * to answer.
 *
 * Discard is offered but requires a deliberate second tap, and the run stays in memory until the
 * save succeeds, so a failed request never loses it.
 */
@Composable
fun RunSummaryScreen(
    viewModel: RecordRunViewModel,
    onSaved: (String) -> Unit,
    onDiscarded: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by RunRecorder.state.collectAsStateWithLifecycle()
    val saveState by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    var title by rememberSaveable { mutableStateOf("") }
    var notes by rememberSaveable { mutableStateOf("") }
    var effort by rememberSaveable { mutableStateOf(5) }
    var confirmDiscard by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.runs_summary_title), onBack = { })

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            RunMap(
                route = state.route,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1.5f)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg)),
            )

            ZidRunCard {
                Row(
                    modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SummaryStat(
                        value = ZidRunFormat.decimal(state.distanceKm, locale),
                        label = stringResource(R.string.runs_unit_km),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        value = ZidRunFormat.duration(state.elapsedSeconds),
                        label = stringResource(R.string.runs_stat_time),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        value = state.averagePaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                        label = stringResource(R.string.runs_stat_pace),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            ZidRunTextField(
                value = title,
                onValueChange = { title = it.take(120) },
                label = stringResource(R.string.runs_title_label),
                enabled = !saveState.saving,
            )
            ZidRunTextField(
                value = notes,
                onValueChange = { notes = it.take(2000) },
                label = stringResource(R.string.runs_notes_label),
                enabled = !saveState.saving,
            )

            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                Text(
                    text = stringResource(R.string.runs_effort_label, effort),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.textStrong,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    (1..10).forEach { level ->
                        val selected = level <= effort
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                // 44dp tall so each step is a real target even though it reads as a bar.
                                .height(ZidRunDimens.minTouchTarget)
                                .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                                .background(if (selected) colors.primary else colors.surfaceMuted)
                                .semantics { contentDescription = "$level" },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = level.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) colors.onPrimary else colors.textMuted,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clickable { effort = level }
                                    .padding(top = 12.dp),
                            )
                        }
                    }
                }
            }

            saveState.error?.let { ZidRunInlineError(it) }

            ZidRunButton(
                text = stringResource(R.string.runs_save),
                onClick = {
                    viewModel.save(
                        title = title.trim().takeIf { it.isNotEmpty() },
                        notes = notes.trim().takeIf { it.isNotEmpty() },
                        perceivedEffort = effort,
                        onSaved = onSaved,
                    )
                },
                loading = saveState.saving,
                enabled = !saveState.saving,
            )

            ZidRunOutlinedButton(
                text = if (confirmDiscard) {
                    stringResource(R.string.runs_discard_confirm)
                } else {
                    stringResource(R.string.runs_discard)
                },
                onClick = {
                    // Two taps: the run is not saved yet, so discarding here destroys it outright.
                    if (confirmDiscard) {
                        RunRecorder.reset()
                        GuidedSessionController.clear()
                        onDiscarded()
                    } else {
                        confirmDiscard = true
                    }
                },
                enabled = !saveState.saving,
            )

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

@Composable
private fun SummaryStat(value: String, label: String, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$value $label" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.headlineMedium, color = colors.textStrong)
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
    }
}

@Composable
private fun Hairline() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(ZidRunTheme.colors.border))
}
