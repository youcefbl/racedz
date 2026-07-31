package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunSectionHeader
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RunSplitDto

/**
 * Run details (05-run-details.png): the route, the headline numbers, per-kilometre splits, and an
 * elevation profile.
 *
 * Splits and the elevation profile are derived here from the route the server returned, rather than
 * asked for separately — the points are already in hand, and a second round trip to recompute what
 * the client can see would only add latency. Anything the route cannot support (no GPS track) is
 * omitted rather than shown empty.
 */
@Composable
fun RunDetailScreen(
    viewModel: RunDetailViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    Column(modifier = modifier.fillMaxSize().background(colors.background)) {
        val run = state.run
        ZidRunTopBar(
            title = run?.title ?: stringResource(R.string.runs_detail_title),
            onBack = onBack,
            trailing = {
                if (run != null) {
                    ZidRunPill(
                        text = if (run.isPublic) {
                            stringResource(R.string.runs_public)
                        } else {
                            stringResource(R.string.runs_private)
                        },
                        color = if (run.isPublic) colors.primary else colors.textMuted,
                    )
                }
            },
        )

        when {
            state.loading -> Box(Modifier.fillMaxSize()) { ZidRunLoading(label = stringResource(R.string.common_loading)) }

            run == null -> ZidRunErrorView(
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
                    .navigationBarsPadding()
                    .padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
            ) {
                Text(
                    text = ZidRunFormat.dateTime(run.startedAt, locale),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )

                RunMap(
                    route = run.route,
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
                        HeadlineStat(
                            value = ZidRunFormat.decimal(run.distanceKm, locale),
                            label = stringResource(R.string.runs_unit_km),
                            modifier = Modifier.weight(1f),
                        )
                        StatDivider()
                        HeadlineStat(
                            value = ZidRunFormat.duration(run.durationSeconds),
                            label = stringResource(R.string.runs_stat_time),
                            modifier = Modifier.weight(1f),
                        )
                        StatDivider()
                        HeadlineStat(
                            value = ZidRunFormat.pace(run.averagePaceSecondsPerKm),
                            label = stringResource(R.string.runs_stat_pace),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                val splits = run.splits
                if (splits.isNotEmpty()) {
                    ZidRunSectionHeader(title = stringResource(R.string.runs_splits))
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            Row(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    stringResource(R.string.runs_split_km),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted,
                                    modifier = Modifier.width(40.dp),
                                )
                                Spacer(Modifier.weight(1f))
                                Text(
                                    stringResource(R.string.runs_split_pace),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted,
                                )
                            }
                            // The fastest split anchors the bar lengths, so the bars compare splits
                            // against each other rather than against an arbitrary maximum.
                            val fastest = splits.minOf { it.paceSecondsPerKm }.coerceAtLeast(1)
                            splits.forEach { split ->
                                SplitRow(split = split, fastestPace = fastest, locale = locale)
                            }
                        }
                    }
                }

                val elevations = run.elevationSeries
                if (elevations.size > 1) {
                    ZidRunSectionHeader(title = stringResource(R.string.runs_elevation))
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            run.elevationGainM?.let { gain ->
                                Text(
                                    // Server-recomputed from the track — phone GPS altitude
                                    // over-counts climb, so a client-reported gain is advisory.
                                    text = stringResource(R.string.runs_elevation_gain_value, gain),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                            }
                            ChartWithAxes(
                                values = elevations.map { it.value },
                                color = colors.primary,
                                yLabel = { "${it.toInt()} m" },
                                xMax = run.distanceKm,
                            )
                        }
                    }
                }

                val paces = run.paceSeries
                if (paces.size > 1) {
                    ZidRunSectionHeader(title = stringResource(R.string.runs_pace_chart))
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            Text(
                                text = "${stringResource(R.string.runs_avg)} ${ZidRunFormat.pace(run.averagePaceSecondsPerKm)}",
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.textStrong,
                            )
                            // Pace is inverted: a lower seconds-per-km is a faster kilometre, so the
                            // chart is flipped to put "faster" at the top where a runner expects it.
                            ChartWithAxes(
                                values = paces.map { it.value },
                                color = colors.accent,
                                invert = true,
                                yLabel = { ZidRunFormat.pace(it.toInt()) },
                                xMax = run.distanceKm,
                            )
                        }
                    }
                }

                val fastestFinish = run.splits.size > 1 &&
                    run.splits.last().paceSecondsPerKm < run.splits.first().paceSecondsPerKm
                InsightBanner(
                    icon = Icons.AutoMirrored.Filled.DirectionsRun,
                    text = stringResource(
                        if (fastestFinish) R.string.runs_insight_finish else R.string.runs_insight_steady,
                    ),
                    tint = colors.success,
                    container = colors.successSoft,
                )
                InsightBanner(
                    icon = Icons.Filled.WaterDrop,
                    text = stringResource(R.string.runs_recovery_body),
                    tint = colors.info,
                    container = colors.infoSoft,
                )

                ZidRunSectionHeader(title = stringResource(R.string.runs_highlights))
                ZidRunCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                    ) {
                        DetailMetric(
                            label = stringResource(R.string.runs_heart_rate),
                            value = run.averageHeartRate?.let { "$it bpm" } ?: "—",
                            modifier = Modifier.weight(1f),
                        )
                        DetailMetric(
                            label = stringResource(R.string.runs_cadence),
                            value = run.avgCadence?.let { "$it spm" } ?: "—",
                            modifier = Modifier.weight(1f),
                        )
                        DetailMetric(
                            label = stringResource(R.string.runs_effort),
                            value = "${run.perceivedEffort}/10",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                Spacer(Modifier.height(ZidRunDimens.spaceXxl))
            }
        }
    }
}

@Composable
private fun InsightBanner(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    tint: androidx.compose.ui.graphics.Color,
    container: androidx.compose.ui.graphics.Color,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(container)
            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(ZidRunDimens.cornerLg))
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
    ) {
        Box(
            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(ZidRunDimens.cornerPill)).background(tint),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = colors.onPrimary, modifier = Modifier.size(20.dp))
        }
        Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.textStrong)
    }
}

@Composable
private fun DetailMetric(label: String, value: String, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$label $value" },
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
    }
}

@Composable
private fun HeadlineStat(value: String, label: String, modifier: Modifier = Modifier) {
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
private fun StatDivider() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(ZidRunTheme.colors.border))
}

@Composable
private fun SplitRow(split: RunSplitDto, fastestPace: Int, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    // Proportional to how close this split is to the fastest one; floored so even the slowest
    // kilometre still reads as a bar rather than a sliver.
    val fraction = (fastestPace.toFloat() / split.paceSecondsPerKm.toFloat()).coerceIn(0.25f, 1f)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = "${split.index} ${ZidRunFormat.pace(split.paceSecondsPerKm)}"
            },
    ) {
        Text(
            // Whole kilometres by index; the final partial split is labelled by its real distance
            // so "5.35" is not mistaken for a sixth full kilometre.
            text = if (split.meters >= 995) split.index.toString()
                else String.format(locale, "%.2f", (split.index - 1) + split.meters / 1000.0),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.text,
            modifier = Modifier.width(40.dp),
        )
        Box(
            modifier = Modifier
                .weight(1f)
                .height(8.dp)
                .padding(end = ZidRunDimens.spaceSm),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(fraction)
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(colors.primary)
            )
        }
        Text(
            text = ZidRunFormat.pace(split.paceSecondsPerKm),
            style = MaterialTheme.typography.titleSmall,
            color = colors.textStrong,
        )
    }
}

/** A filled line chart. Used for the elevation profile; decorative, with the numbers stated above. */
@Composable
private fun LineChart(
    values: List<Double>,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    invert: Boolean = false,
) {
    Canvas(modifier = modifier.clearAndSetSemantics { }) {
        if (values.size < 2) return@Canvas
        val min = values.min()
        val max = values.max()
        val span = (max - min).takeIf { it > 0.5 } ?: 1.0
        val stepX = size.width / (values.size - 1)

        fun point(index: Int): Offset {
            val normalised = (values[index] - min) / span
            val fromTop = if (invert) normalised else 1.0 - normalised
            return Offset(index * stepX, (fromTop * size.height).toFloat())
        }

        val line = Path().apply {
            moveTo(point(0).x, point(0).y)
            for (i in 1 until values.size) lineTo(point(i).x, point(i).y)
        }
        val fill = Path().apply {
            addPath(line)
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }

        drawPath(fill, color = color.copy(alpha = 0.15f))
        drawPath(
            path = line,
            color = color,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

/** Compact axes keep the charts useful without turning the detail screen into a dashboard. */
@Composable
private fun ChartWithAxes(
    values: List<Double>,
    color: androidx.compose.ui.graphics.Color,
    yLabel: (Double) -> String,
    xMax: Double,
    invert: Boolean = false,
) {
    val colors = ZidRunTheme.colors
    if (values.size < 2) return
    val top = if (invert) values.min() else values.max()
    val bottom = if (invert) values.max() else values.min()

    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(
                modifier = Modifier.width(44.dp).height(120.dp),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(yLabel(top), style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
                Text(yLabel(bottom), style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
            }
            LineChart(
                values = values,
                color = color,
                invert = invert,
                modifier = Modifier.fillMaxWidth().height(120.dp),
            )
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(44.dp))
            Text("0 km", style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
            Spacer(Modifier.weight(1f))
            Text(
                "${ZidRunFormat.decimal(xMax, currentLocale())} km",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
        }
    }
}
