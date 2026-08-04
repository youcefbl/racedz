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
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
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
import dz.racedz.nativeapp.core.design.ZidRunDivider
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.mutableStateOf
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import androidx.compose.material3.Switch

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
    /** Opens the coach with this run selected. Null when the runner has no coaching. */
    onAnalyse: ((String) -> Unit)? = null,
    onExportGpx: (String) -> Unit = {},
    /** Called after the server has accepted the delete, so the list never shows a ghost row. */
    onDeleted: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmingDelete by remember { mutableStateOf(false) }
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
                useLocalizedBody = state.error?.isGeneric == true,
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
                                Text(
                                    "\u0394",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted,
                                    textAlign = TextAlign.End,
                                    modifier = Modifier.width(46.dp),
                                )
                            }
                            // The fastest split anchors the bar lengths, so the bars compare splits
                            // against each other rather than against an arbitrary maximum.
                            val fastest = splits.minOf { it.paceSecondsPerKm }.coerceAtLeast(1)
                            splits.forEach { split ->
                                SplitRow(
                                    split = split,
                                    fastestPace = fastest,
                                    averagePace = run.averagePaceSecondsPerKm,
                                    locale = locale,
                                )
                            }
                        }
                    }
                }

                if (run.splits.isEmpty() && run.paceSeries.size <= 1 &&
                    (run.route?.size ?: 0) > 1
                ) {
                    ZidRunCard {
                        Text(
                            text = stringResource(R.string.runs_series_unavailable),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                }

                val elevations = run.elevationSeries
                if (elevations.size > 1) {
                    ZidRunSectionHeader(title = stringResource(R.string.runs_elevation))
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            // Gain and loss on one line above the profile, as in the mockup.
                            //
                            // Both are summed from the series being plotted, deliberately, rather
                            // than taking gain from `elevationGainM`: the server's figure is
                            // noise-filtered and the DTO carries no matching loss, so pairing them
                            // printed "Gain 0 m  Loss 27 m" for a flat run — two numbers measured
                            // different ways, side by side, inviting the reader to compare them.
                            // Derived together they at least agree with each other and with the
                            // line directly beneath them. Both stay advisory: phone altitude
                            // over-counts, which is why `runs_highlights` still quotes the server.
                            val gain = elevations.zipWithNext()
                                .sumOf { (a, b) -> (b.value - a.value).coerceAtLeast(0.0) }
                            val loss = elevations.zipWithNext()
                                .sumOf { (a, b) -> (a.value - b.value).coerceAtLeast(0.0) }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                            ) {
                                Text(
                                    text = stringResource(R.string.runs_elevation_gain_value, gain.toInt()),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                                Text(
                                    text = "${stringResource(R.string.runs_elevation_loss)} ${loss.toInt()} m",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                            }
                            ChartWithAxes(
                                values = elevations.map { it.value },
                                // Info hue: one hue per metric — pace owns primary, and the card
                                // title names the series, so colour never carries identity alone.
                                color = colors.info,
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
                                // Primary, not accent: orange is 2.74:1 on the light surface (R3).
                                color = colors.primary,
                                invert = true,
                                yLabel = { ZidRunFormat.pace(it.toInt()) },
                                xMax = run.distanceKm,
                                averageValue = run.averagePaceSecondsPerKm.toDouble(),
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

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                ) {
                    // Export is offered only when there is a track to export; a GPX with no points
                    // is a file that fails to import everywhere it is taken.
                    if ((run.route?.size ?: 0) >= 2) {
                        ZidRunOutlinedButton(
                            text = stringResource(R.string.runs_export_gpx),
                            onClick = { onExportGpx(run.id) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    onAnalyse?.let { analyse ->
                        ZidRunButton(
                            text = stringResource(R.string.runs_analyze),
                            onClick = { analyse(run.id) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                state.actionError?.let { ZidRunInlineError(it) }

                /*
                 * Privacy and deletion.
                 *
                 * Both were missing, and both are controls over data the runner already owns: a run
                 * records where they were, and until this existed the only way to unpublish one — or
                 * remove a route recorded by mistake — was the website. The repository has exposed
                 * `update` and `delete` the whole time; this is the surface over them.
                 */
                ZidRunCard {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    stringResource(R.string.runs_visibility_title),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                                Text(
                                    stringResource(
                                        if (run.isPublic) R.string.runs_visibility_public_body
                                        else R.string.runs_visibility_private_body
                                    ),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.textMuted,
                                )
                            }
                            Spacer(Modifier.width(ZidRunDimens.spaceMd))
                            Switch(
                                checked = run.isPublic,
                                onCheckedChange = { viewModel.setPublic(it) },
                                enabled = !state.mutating,
                            )
                        }

                        ZidRunDivider()

                        if (confirmingDelete) {
                            Text(
                                stringResource(R.string.runs_delete_confirm_body),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                                ZidRunOutlinedButton(
                                    text = stringResource(R.string.common_cancel),
                                    onClick = { confirmingDelete = false },
                                    enabled = !state.mutating,
                                    modifier = Modifier.weight(1f),
                                )
                                ZidRunButton(
                                    text = stringResource(R.string.runs_delete_confirm),
                                    onClick = { viewModel.delete(onDeleted) },
                                    enabled = !state.mutating,
                                    loading = state.mutating,
                                    containerColor = colors.danger,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        } else {
                            // Deliberately a second tap away. Deleting a run is not recoverable from
                            // the app, and it sits directly under a switch people do tap.
                            ZidRunTextButton(
                                text = stringResource(R.string.runs_delete),
                                onClick = { confirmingDelete = true },
                            )
                        }
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
private fun SplitRow(
    split: RunSplitDto,
    fastestPace: Int,
    averagePace: Int,
    locale: java.util.Locale,
) {
    val colors = ZidRunTheme.colors
    // Proportional to how close this split is to the fastest one; floored so even the slowest
    // kilometre still reads as a bar rather than a sliver.
    val fraction = (fastestPace.toFloat() / split.paceSecondsPerKm.toFloat()).coerceIn(0.25f, 1f)
    // The fastest full kilometre wears the accent; its delta column carries the same fact in
    // text, so the colour is emphasis, never the only signal.
    val isFastest = split.paceSecondsPerKm == fastestPace && split.meters >= 995

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
                    .background(if (isFastest) colors.accentStrong else colors.primary)
            )
        }
        Text(
            text = ZidRunFormat.pace(split.paceSecondsPerKm),
            style = MaterialTheme.typography.titleSmall,
            color = colors.textStrong,
        )
        // Delta against the run's own average, as in 05-run-details.png. Slower reads as danger and
        // faster as success, but the sign carries the same meaning on its own — colour is never the
        // only signal.
        val deltaSeconds = split.paceSecondsPerKm - averagePace
        Text(
            text = if (deltaSeconds == 0) "—" else buildString {
                append(if (deltaSeconds > 0) "+" else "-")
                val abs = kotlin.math.abs(deltaSeconds)
                append(String.format(locale, "%d:%02d", abs / 60, abs % 60))
            },
            style = MaterialTheme.typography.labelMedium,
            color = when {
                deltaSeconds > 0 -> colors.danger
                deltaSeconds < 0 -> colors.success
                else -> colors.textMuted
            },
            textAlign = TextAlign.End,
            maxLines = 1,
            modifier = Modifier.width(46.dp),
        )
    }
}

/**
 * The elevation and pace profiles from 05-run-details.png: a filled line over horizontal gridlines,
 * five y-ticks, kilometre x-ticks, and — for pace — a dashed average reference.
 *
 * [invert] flips the y-axis for pace, where a lower seconds-per-km is a *better* value and belongs at
 * the top; without it a negative split would read as a decline.
 */
@Composable
private fun ChartWithAxes(
    values: List<Double>,
    color: androidx.compose.ui.graphics.Color,
    yLabel: (Double) -> String,
    xMax: Double,
    invert: Boolean = false,
    averageValue: Double? = null,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    if (values.size < 2) return

    val min = values.min()
    val max = values.max()
    val span = (max - min).takeIf { it > 0.0001 } ?: 1.0
    // Five evenly spaced ticks, top row first. Inverted charts count the other way so the label
    // column still reads top-to-bottom.
    val ticks = (0..4).map { i ->
        val fraction = i / 4.0
        if (invert) min + span * fraction else max - span * fraction
    }
    val chartHeight = 132.dp
    val textMeasurer = rememberTextMeasurer()
    val tickStyle = MaterialTheme.typography.labelSmall.copy(color = colors.textMuted)

    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(
                modifier = Modifier.width(52.dp).height(chartHeight),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.End,
            ) {
                ticks.forEach { tick ->
                    Text(
                        text = yLabel(tick),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                        maxLines = 1,
                    )
                }
            }
            Spacer(Modifier.width(ZidRunDimens.spaceXs))
            Canvas(
                modifier = Modifier
                    .weight(1f)
                    .height(chartHeight)
                    .clearAndSetSemantics { },
            ) {
                val stepX = size.width / (values.size - 1)

                // Gridlines line up with the five y-ticks so a label can be read straight across.
                repeat(5) { i ->
                    val y = size.height * (i / 4f)
                    drawLine(
                        color = colors.border,
                        start = Offset(0f, y),
                        end = Offset(size.width, y),
                        strokeWidth = 1.dp.toPx(),
                    )
                }

                fun yFor(value: Double): Float {
                    val normalised = (value - min) / span
                    val fromTop = if (invert) normalised else 1.0 - normalised
                    return (fromTop * size.height).toFloat()
                }

                val line = Path().apply {
                    moveTo(0f, yFor(values[0]))
                    for (i in 1 until values.size) lineTo(i * stepX, yFor(values[i]))
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

                // The average, dashed so it reads as a reference rather than a second series.
                averageValue?.let { average ->
                    if (average in min..max) {
                        val y = yFor(average)
                        drawLine(
                            color = colors.textMuted,
                            start = Offset(0f, y),
                            end = Offset(size.width, y),
                            strokeWidth = 1.dp.toPx(),
                            pathEffect = PathEffect.dashPathEffect(
                                floatArrayOf(6.dp.toPx(), 4.dp.toPx()),
                            ),
                        )
                    }
                }
            }
        }
        // Kilometre marks along the bottom: every whole km the run reached, plus its real end
        // distance, dropped when they would collide on a narrow screen.
        Row(modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(52.dp + ZidRunDimens.spaceXs))
            Canvas(modifier = Modifier.weight(1f).height(14.dp).clearAndSetSemantics { }) {
                if (xMax <= 0) return@Canvas
                val marks = buildList {
                    var km = 0
                    while (km <= xMax.toInt()) { add(km.toDouble()); km++ }
                    if (xMax - xMax.toInt() > 0.05) add(xMax)
                }
                var lastEnd = -Float.MAX_VALUE
                marks.forEach { mark ->
                    val label = if (mark == 0.0) {
                        "0 km"
                    } else if (mark == xMax && xMax != xMax.toInt().toDouble()) {
                        ZidRunFormat.decimal(mark, locale)
                    } else {
                        mark.toInt().toString()
                    }
                    val measured = textMeasurer.measure(label, tickStyle)
                    val centre = (mark / xMax * size.width).toFloat()
                    val x = (centre - measured.size.width / 2f)
                        .coerceIn(0f, size.width - measured.size.width)
                    if (x > lastEnd + 4.dp.toPx()) {
                        drawText(textMeasurer, label, topLeft = Offset(x, 0f), style = tickStyle)
                        lastEnd = x + measured.size.width
                    }
                }
            }
        }
    }
}
