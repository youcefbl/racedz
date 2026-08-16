package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.distanceUnitLabel
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunSearchField
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RunDto
import dz.racedz.nativeapp.core.network.displayRoute

/**
 * Run history (04-runs-list.png): search, source filters, a total, and one row per run.
 *
 * Filtering happens over the page already in memory, so typing stays instant — see the note on
 * `visibleRuns` in RunsViewModel.
 */
@Composable
fun RunHistoryScreen(
    viewModel: RunsViewModel,
    onBack: () -> Unit,
    onOpenRun: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val visible = state.visibleRuns

    /*
     * Refetch whenever this screen comes back to the foreground.
     *
     * Without it a run deleted from its detail screen stayed in this list: deleting pops back
     * here, the list still holds the row it was rendered from, and tapping it opens a detail
     * screen for a run the server has tombstoned — a 404 for something the app is still showing.
     * The overview already does exactly this for the same reason; history was simply missed.
     */
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.load()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(modifier = modifier.fillMaxSize().background(colors.background)) {
        ZidRunTopBar(title = "", onBack = onBack)

        when {
            state.loading -> Box(Modifier.fillMaxSize()) { ZidRunLoading(label = stringResource(R.string.common_loading)) }

            state.error != null && state.runs.isEmpty() -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = ZidRunDimens.spaceLg,
                    end = ZidRunDimens.spaceLg,
                    bottom = ZidRunDimens.spaceXxl,
                ),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
            ) {
                item(key = "header") {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        ZidRunDisplayTitle(text = stringResource(R.string.runs_history_title))
                        ZidRunSearchField(
                            value = state.query,
                            onValueChange = viewModel::onQueryChange,
                            placeholder = stringResource(R.string.runs_search_hint),
                            contentDescription = stringResource(R.string.runs_search_hint),
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                        ) {
                            ZidRunChoiceChip(
                                label = stringResource(R.string.runs_filter_all),
                                selected = state.sourceFilter == RunSourceFilter.All,
                                onClick = { viewModel.onSourceFilterChange(RunSourceFilter.All) },
                            )
                            ZidRunChoiceChip(
                                label = stringResource(R.string.runs_filter_gps),
                                selected = state.sourceFilter == RunSourceFilter.Gps,
                                onClick = { viewModel.onSourceFilterChange(RunSourceFilter.Gps) },
                            )
                            ZidRunChoiceChip(
                                label = stringResource(R.string.runs_filter_manual),
                                selected = state.sourceFilter == RunSourceFilter.Manual,
                                onClick = { viewModel.onSourceFilterChange(RunSourceFilter.Manual) },
                            )
                            ZidRunChoiceChip(
                                label = stringResource(R.string.runs_filter_this_month),
                                selected = state.thisMonthOnly,
                                onClick = viewModel::toggleThisMonth,
                            )
                        }
                        Text(
                            text = stringResource(
                                R.string.runs_summary,
                                visible.size,
                                ZidRunFormat.distanceValue(state.visibleDistanceKm, locale),
                            ),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textMuted,
                        )
                    }
                }

                if (visible.isEmpty()) {
                    item(key = "empty") {
                        Box(Modifier.fillMaxWidth().height(320.dp)) {
                            ZidRunStatusView(
                                icon = Icons.AutoMirrored.Filled.DirectionsRun,
                                title = stringResource(R.string.runs_empty_title),
                                body = stringResource(R.string.runs_empty_body),
                                actionLabel = if (state.hasFilters) stringResource(R.string.races_clear_filters) else null,
                                onAction = if (state.hasFilters) viewModel::clearFilters else null,
                            )
                        }
                    }
                } else {
                    items(visible, key = { it.id }) { run ->
                        RunRow(run = run, onClick = { onOpenRun(run.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun RunRow(run: RunDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.date(run.startedAt, locale)
    val unitLabel = distanceUnitLabel()

    ZidRunCard(
        onClick = onClick,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = "${run.title ?: dateLabel}, ${ZidRunFormat.distanceValue(run.distanceKm, locale)} $unitLabel"
        },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RouteShape(
                route = run.displayRoute,
                modifier = Modifier.size(72.dp).clip(RoundedCornerShape(ZidRunDimens.cornerMd)),
            )
            Spacer(Modifier.width(ZidRunDimens.spaceMd))
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                ) {
                    Text(dateLabel, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                    // A ride logged as a run is worth marking in the list too: its pace sits next
                    // to real runs in the same column, and without the pill the fastest row in the
                    // history is the one that never counted.
                    if (run.validity != "VALID") {
                        ZidRunPill(
                            text = stringResource(R.string.runs_validity_pill),
                            color = colors.accent,
                        )
                    }
                }
                Text(
                    text = run.title ?: stringResource(R.string.runs_untitled),
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textStrong,
                )
                // No inter-item spacing: the three weighted stats plus two hairlines already fill
                // the row, and on a 320dp screen the extra gaps were enough to clip "5:38/km".
                Row(
                    modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                ) {
                    RowStat(
                        Icons.Filled.Straighten,
                        "${ZidRunFormat.distanceValue(run.distanceKm, locale)} $unitLabel",
                        Modifier.weight(1f),
                    )
                    RowDivider()
                    RowStat(Icons.Filled.Speed, ZidRunFormat.pace(run.averagePaceSecondsPerKm), Modifier.weight(1f))
                    RowDivider()
                    RowStat(Icons.Filled.Schedule, ZidRunFormat.duration(run.durationSeconds), Modifier.weight(1f))
                }
            }
            Icon(
                // AutoMirrored so the chevron points left in Arabic.
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = colors.textMuted,
            )
        }
    }
}

@Composable
private fun RowStat(icon: ImageVector, value: String, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(16.dp))
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.labelMedium, color = colors.textStrong, maxLines = 1)
    }
}

@Composable
private fun RowDivider() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(ZidRunTheme.colors.border))
}
