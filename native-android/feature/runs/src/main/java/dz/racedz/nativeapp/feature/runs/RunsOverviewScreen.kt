package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunBrandBar
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunSectionHeader
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RunDto
import dz.racedz.nativeapp.feature.runs.record.RecordingStatus
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.core.network.displayRoute
import kotlin.math.min

/**
 * Runs overview (01-runs-overview.png): this week's volume as a ring, the supporting counts, the
 * latest run, and the ways to add one.
 *
 * Everything shown is derived from runs the server returned. Nothing is stored or computed locally
 * that the server does not already agree with, so two devices cannot disagree about the week.
 */
@Composable
fun RunsOverviewScreen(
    viewModel: RunsViewModel,
    onOpenHistory: () -> Unit,
    onResumeRecording: () -> Unit,
    onOpenRun: (String) -> Unit,
    onRecordRun: () -> Unit,
    onLogManually: () -> Unit,
    onImportGpx: () -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    // The view model is scoped to the shell and survives navigating away, so after saving a run the
    // overview kept showing the list it fetched at startup — with an older run as "latest". Reload
    // whenever this screen comes back to the foreground.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.load()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Box(modifier = modifier.fillMaxSize().background(colors.background).padding(contentPadding)) {
        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

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
            )

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
            ) {
                ZidRunBrandBar(
                    actionIcon = Icons.Filled.BarChart,
                    actionContentDescription = stringResource(R.string.runs_cd_history),
                    onAction = onOpenHistory,
                )
                ZidRunDisplayTitle(text = stringResource(R.string.runs_title))

                // A run left recording in the background needs an obvious way back — otherwise the
                // runner's only clue that it is still going is the system notification.
                val recording by RunRecorder.state.collectAsStateWithLifecycle()
                if (recording.status == RecordingStatus.Recording ||
                    recording.status == RecordingStatus.Acquiring ||
                    recording.status == RecordingStatus.Paused
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                            .background(colors.primarySoft)
                            .clickable(role = Role.Button, onClick = onResumeRecording)
                            .padding(ZidRunDimens.spaceMd)
                            .semantics(mergeDescendants = true) { },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(10.dp).clip(CircleShape).background(colors.primary))
                        Spacer(Modifier.width(ZidRunDimens.spaceSm))
                        Text(
                            text = stringResource(
                                R.string.runs_recording_banner,
                                ZidRunFormat.decimal(recording.distanceKm, locale),
                            ),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.primary,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = stringResource(R.string.runs_open_recording),
                            style = MaterialTheme.typography.labelLarge,
                            color = colors.primary,
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                ) {
                    WeekRingCard(
                        distanceKm = state.weekDistanceKm,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                    )
                    Column(
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                    ) {
                        WeekStatCard(
                            icon = Icons.AutoMirrored.Filled.DirectionsRun,
                            value = state.weekRunCount.toString(),
                            unit = stringResource(R.string.runs_unit_runs),
                            tint = colors.primary,
                            modifier = Modifier.weight(1f),
                        )
                        WeekStatCard(
                            icon = Icons.Filled.Schedule,
                            value = ZidRunFormat.durationShort(state.weekDurationSeconds),
                            unit = "",
                            tint = colors.accent,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                val latest = state.latestRun
                if (latest != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        ZidRunSectionHeader(title = stringResource(R.string.runs_latest))
                        Spacer(Modifier.weight(1f))
                        val historyLabel = stringResource(R.string.runs_cd_history)
                        // A labelled, chip-sized target. The icon in the brand bar alone was not
                        // discoverable — a tester looking for their run list did not find it.
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                            modifier = Modifier
                                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                                .background(colors.primarySoft)
                                .clickable(role = Role.Button, onClick = onOpenHistory)
                                .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm)
                                .semantics { contentDescription = historyLabel },
                        ) {
                            Text(
                                text = stringResource(R.string.runs_view_history),
                                style = MaterialTheme.typography.labelLarge,
                                color = colors.primary,
                            )
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = null,
                                tint = colors.primary,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                    LatestRunCard(run = latest, onClick = { onOpenRun(latest.id) })

                    // A real, server-backed highlight gives the overview the motivational beat from
                    // the mockup without inventing an achievement system that the API does not yet
                    // expose.
                    state.runs.maxByOrNull { it.distanceKm }?.let { longest ->
                        ZidRunCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .background(colors.primarySoft),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        Icons.AutoMirrored.Filled.DirectionsRun,
                                        contentDescription = null,
                                        tint = colors.primary,
                                        modifier = Modifier.size(24.dp),
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = stringResource(R.string.runs_highlights),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.textMuted,
                                    )
                                    Text(
                                        text = stringResource(R.string.runs_longest_run),
                                        style = MaterialTheme.typography.titleMedium,
                                        color = colors.textStrong,
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = ZidRunFormat.decimal(longest.distanceKm, locale),
                                        style = MaterialTheme.typography.headlineSmall,
                                        color = colors.primary,
                                    )
                                    Text(
                                        text = stringResource(R.string.runs_unit_km),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                    )
                                }
                            }
                        }
                    }
                } else {
                    ZidRunStatusView(
                        icon = Icons.AutoMirrored.Filled.DirectionsRun,
                        title = stringResource(R.string.runs_empty_title),
                        body = stringResource(R.string.runs_empty_body),
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                ) {
                    QuickAction(
                        icon = Icons.AutoMirrored.Filled.DirectionsRun,
                        label = stringResource(R.string.runs_record),
                        onClick = onRecordRun,
                        emphasized = true,
                        modifier = Modifier.weight(1f),
                    )
                    QuickAction(
                        icon = Icons.Filled.Edit,
                        label = stringResource(R.string.runs_log_manually),
                        onClick = onLogManually,
                        modifier = Modifier.weight(1f),
                    )
                    QuickAction(
                        icon = Icons.Filled.BarChart,
                        label = stringResource(R.string.runs_import_gpx),
                        onClick = onImportGpx,
                        modifier = Modifier.weight(1f),
                    )
                }

                Spacer(Modifier.height(ZidRunDimens.spaceXxl))
            }
        }
    }
}

/** This week's distance as a progress ring. */
@Composable
private fun WeekRingCard(distanceKm: Double, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    // A weekly target the ring can fill. Deliberately a display device only — nothing depends on
    // it, and it is not presented as a goal the runner set, because they have not set one.
    val ringTargetKm = 30.0
    val progress = min(1f, (distanceKm / ringTargetKm).toFloat())

    ZidRunCard(modifier = modifier) {
        Column(
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = stringResource(R.string.runs_this_week),
                style = MaterialTheme.typography.titleMedium,
                color = colors.primary,
                modifier = Modifier.fillMaxWidth(),
            )
            Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(vertical = ZidRunDimens.spaceSm)) {
                Canvas(modifier = Modifier.size(112.dp)) {
                    val strokePx = 10.dp.toPx()
                    val inset = strokePx / 2
                    val arcSize = Size(size.width - strokePx, size.height - strokePx)
                    drawArc(
                        color = colors.border,
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                        size = arcSize,
                        style = Stroke(width = strokePx, cap = StrokeCap.Round),
                    )
                    if (progress > 0f) {
                        drawArc(
                            color = colors.primary,
                            startAngle = -90f,
                            sweepAngle = 360f * progress,
                            useCenter = false,
                            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                            size = arcSize,
                            style = Stroke(width = strokePx, cap = StrokeCap.Round),
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = ZidRunFormat.decimal(distanceKm, locale),
                        style = MaterialTheme.typography.displaySmall,
                        color = colors.textStrong,
                    )
                    Text(
                        text = stringResource(R.string.runs_unit_km),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun WeekStatCard(
    icon: ImageVector,
    value: String,
    unit: String,
    tint: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    ZidRunCard(modifier = modifier, contentPadding = PaddingValues(ZidRunDimens.spaceMd)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {
                contentDescription = "$value $unit"
            },
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(tint.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            }
            Column {
                Text(value, style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
                if (unit.isNotEmpty()) {
                    Text(unit, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                }
            }
        }
    }
}

@Composable
private fun LatestRunCard(run: RunDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    ZidRunCard(
        onClick = onClick,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = "${run.title ?: ""} ${ZidRunFormat.decimal(run.distanceKm, locale)} km"
        },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RouteShape(
                route = run.displayRoute,
                modifier = Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerMd)),
            )
            Spacer(Modifier.width(ZidRunDimens.spaceMd))
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
            ) {
                Text(
                    text = run.title ?: ZidRunFormat.dateTime(run.startedAt, locale),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = ZidRunFormat.decimal(run.distanceKm, locale),
                        style = MaterialTheme.typography.displaySmall,
                        color = colors.textStrong,
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceXs))
                    Text(
                        text = stringResource(R.string.runs_unit_km),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                        modifier = Modifier.padding(bottom = 4.dp),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg)) {
                    MiniStat(
                        value = ZidRunFormat.duration(run.durationSeconds),
                        label = stringResource(R.string.runs_stat_time),
                    )
                    MiniStat(
                        value = ZidRunFormat.pace(run.averagePaceSecondsPerKm),
                        label = stringResource(R.string.runs_stat_pace),
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniStat(value: String, label: String) {
    val colors = ZidRunTheme.colors
    Column {
        Text(value, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
    }
}

@Composable
private fun QuickAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    emphasized: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(if (emphasized) colors.primarySoft else colors.surface)
            .clickable(role = Role.Button, onClick = onClick)
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .padding(vertical = ZidRunDimens.spaceMd, horizontal = ZidRunDimens.spaceSm)
            .semantics(mergeDescendants = true) { },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(if (emphasized) colors.primary else colors.primarySoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (emphasized) colors.onPrimary else colors.primary,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = colors.textStrong,
            textAlign = TextAlign.Center,
        )
    }
}
