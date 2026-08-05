package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunBrandBar
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RunDto
import dz.racedz.nativeapp.feature.runs.record.RecordingStatus
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.core.network.displayRoute

/**
 * Runs overview, Variant B of the 2026-08-04 redesign (docs/native-design/proposals/2026-08-04):
 * one merged week card (distance + count + streak), the latest run, personal bests — and the
 * page's primary action pinned in a stateful dock above the tab bar, so it is visible and
 * thumb-reachable at every scroll position instead of below the fold.
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
    /** Opens the save/discard summary for a finished recording that was never saved. */
    onOpenPendingSave: () -> Unit,
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
                useLocalizedBody = state.error?.isGeneric == true,
            )

            else -> Box(modifier = Modifier.fillMaxSize()) {
              Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
              ) {
                // The brand bar stays. The website's own header types the word "ZidRun" as an <h1>
                // instead of drawing the wordmark, which is a defect logged as RUNPAR-008 — matching
                // its Runs *page* is the point here, not importing its chrome.
                ZidRunBrandBar(
                    actionIcon = Icons.Filled.BarChart,
                    actionContentDescription = stringResource(R.string.runs_cd_history),
                    onAction = onOpenHistory,
                )

                // Header block, ported from the website's RunsOverview: teal eyebrow, the week
                // title, and the "what this screen is for" line, with the history link opposite.
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.runs_title).uppercase(locale),
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.primary,
                            letterSpacing = 1.8.sp,
                        )
                        Text(
                            text = stringResource(R.string.runs_overview_title),
                            style = MaterialTheme.typography.headlineLarge,
                            color = colors.textStrong,
                            modifier = Modifier.padding(top = ZidRunDimens.spaceXs),
                        )
                        Text(
                            text = stringResource(R.string.runs_overview_sub),
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.textMuted,
                            modifier = Modifier.padding(top = ZidRunDimens.spaceXs),
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                        modifier = Modifier
                            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                            .clickable(role = Role.Button, onClick = onOpenHistory)
                            .heightIn(min = ZidRunDimens.minTouchTarget)
                            .padding(horizontal = ZidRunDimens.spaceSm)
                            .semantics(mergeDescendants = true) { },
                    ) {
                        Text(
                            text = stringResource(R.string.runs_view_history),
                            style = MaterialTheme.typography.labelLarge,
                            color = colors.primary,
                        )
                        Icon(
                            painterResource(R.drawable.ic_arrow_up_right),
                            contentDescription = null,
                            tint = colors.primary,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }

                val latest = state.latestRun
                if (latest != null) {
                    // One merged week card: distance, count and streak together (the second
                    // "This week" card repeated the same fact and pushed the primary action
                    // below the fold — R2 in the 2026-08-04 diagnosis).
                    WeekHeroCard(
                        distanceKm = state.weekDistanceKm,
                        runCount = state.weekRunCount,
                        streakWeeks = state.streakWeeks,
                    )

                    LatestRunCard(run = latest, onClick = { onOpenRun(latest.id) })

                    if (state.runs.isNotEmpty()) {
                        PersonalBestsCard(
                            totalDistanceKm = state.totalDistanceKm,
                            longestRunKm = state.longestRunKm,
                            bestPaceSecondsPerKm = state.bestPaceSecondsPerKm,
                        )
                    }
                } else {
                    // The empty state is a brand moment (PRODUCT.md "earned energy"), not a grey
                    // shrug: the Z mark and one message, once. The dock below carries the single
                    // primary action, so this card deliberately has no button of its own.
                    EmptyWeekHero()
                }

                // Manual entry and GPX import are hidden until they exist (NATPAR-003): a
                // visible control is a promise, and both used to dead-end into run history. They
                // return here when the real screens ship.

                // Clearance so the last card scrolls out from under the pinned dock, including at
                // large font scale.
                Spacer(Modifier.height(96.dp))
              }

            }
        }

        // The dock is outside the remote-data `when` deliberately (RED-R05): the recorder is local
        // state, and a live or pending run must keep its way back — and Record must stay reachable —
        // even while the overview fetch is loading, failing, or offline.
        RecordDock(
            firstRun = !state.loading && state.error == null && state.latestRun == null,
            onRecordRun = onRecordRun,
            onResumeRecording = onResumeRecording,
            onOpenPendingSave = onOpenPendingSave,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

/**
 * The pinned primary action (Variant B). Stateful, and never destructive (NDP-R05): it offers
 * Record only while the recorder is idle; an active or paused recording turns it into the way
 * back to the live run, and a finished-but-unsaved one into the way to the save screen. Starting
 * over an existing recording is impossible from here — and [RunRecorder.start] refuses it too.
 */
@Composable
private fun RecordDock(
    firstRun: Boolean,
    onRecordRun: () -> Unit,
    onResumeRecording: () -> Unit,
    onOpenPendingSave: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val recording by RunRecorder.state.collectAsStateWithLifecycle()

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    0f to Color.Transparent,
                    0.55f to colors.background,
                )
            )
            .padding(
                start = ZidRunDimens.spaceLg,
                end = ZidRunDimens.spaceLg,
                top = ZidRunDimens.spaceXl,
                bottom = ZidRunDimens.spaceMd,
            ),
    ) {
        when (recording.status) {
            RecordingStatus.Idle -> DockButton(
                label = stringResource(if (firstRun) R.string.runs_record_first else R.string.runs_record),
                container = colors.primary,
                content = colors.onPrimary,
                onClick = onRecordRun,
            ) {
                Icon(
                    painterResource(R.drawable.ic_footprints),
                    contentDescription = null,
                    tint = colors.onPrimary,
                    modifier = Modifier.size(18.dp),
                )
            }

            RecordingStatus.Recording, RecordingStatus.Acquiring -> DockButton(
                label = stringResource(
                    R.string.runs_recording_banner,
                    ZidRunFormat.decimal(recording.distanceKm, locale),
                ) + " — " + stringResource(R.string.runs_open_recording),
                container = colors.primarySoft,
                content = colors.primary,
                border = colors.primary,
                onClick = onResumeRecording,
            ) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(colors.primary))
            }

            RecordingStatus.Paused -> DockButton(
                label = stringResource(
                    R.string.runs_dock_paused,
                    ZidRunFormat.decimal(recording.distanceKm, locale),
                ) + " — " + stringResource(R.string.runs_resume),
                container = colors.primarySoft,
                content = colors.primary,
                border = colors.primary,
                onClick = onResumeRecording,
            )

            RecordingStatus.Finished -> DockButton(
                label = stringResource(R.string.runs_save),
                container = colors.accentSoft,
                // Strong ink, not orange: accentStrong on accentSoft is below the 4.5:1 text bar
                // in the light theme. The border carries the accent.
                content = colors.textStrong,
                border = colors.accentStrong,
                onClick = onOpenPendingSave,
            )
        }
    }
}

@Composable
private fun DockButton(
    label: String,
    container: Color,
    content: Color,
    onClick: () -> Unit,
    border: Color? = null,
    leading: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(container)
            .then(if (border != null) Modifier.border(1.5.dp, border, RoundedCornerShape(14.dp)) else Modifier)
            .clickable(role = Role.Button, onClick = onClick)
            .heightIn(min = 56.dp)
            .padding(horizontal = ZidRunDimens.spaceLg),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        Text(
            text = label,
            style = MaterialTheme.typography.titleMedium,
            color = content,
            textAlign = TextAlign.Center,
            // Two lines before ellipsis: the dock is the page's action, and French/Arabic state
            // labels at 1.3× font must stay intelligible rather than truncate (RED-R07).
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** First-run hero on the dark surface: the Z mark, one message — and no fake progress bar. */
@Composable
private fun EmptyWeekHero() {
    val colors = ZidRunTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surfaceStrong)
            .padding(horizontal = ZidRunDimens.spaceXl, vertical = ZidRunDimens.spaceXxl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            painterResource(R.drawable.ic_zidrun_mark),
            contentDescription = null,
            tint = Color.Unspecified,
            modifier = Modifier.size(48.dp),
        )
        Text(
            text = stringResource(R.string.runs_empty_hero_title),
            style = MaterialTheme.typography.displaySmall,
            color = colors.heroAccent,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = ZidRunDimens.spaceLg),
        )
        Text(
            text = stringResource(R.string.runs_empty_hero_sub),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.65f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = ZidRunDimens.spaceSm),
        )
    }
}


/**
 * The one week card: distance, run count and streak on the dark surface, with the fill bar.
 *
 * The bar is a display device, not a goal: it fills at 4% per kilometre with an 8% floor so a
 * week with any distance reads as a bar rather than an empty groove — but at zero kilometres it
 * stays empty, because a bar showing progress that does not exist is a small lie (R4).
 */
@Composable
private fun WeekHeroCard(distanceKm: Double, runCount: Int, streakWeeks: Int) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val fill = if (distanceKm <= 0.0) 0f else ((distanceKm * 4).coerceIn(8.0, 100.0) / 100.0).toFloat()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surfaceStrong)
            .padding(20.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.runs_this_week),
                style = MaterialTheme.typography.titleSmall,
                color = Color.White.copy(alpha = 0.75f),
                modifier = Modifier.weight(1f),
            )
            Icon(
                painterResource(R.drawable.ic_flame),
                contentDescription = null,
                tint = colors.accent,
                modifier = Modifier.size(20.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.padding(top = ZidRunDimens.spaceMd),
        ) {
            Text(
                text = ZidRunFormat.decimal(distanceKm, locale, digits = 1),
                style = MaterialTheme.typography.displayMedium,
                color = Color.White,
            )
            Text(
                text = stringResource(R.string.runs_unit_km),
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.6f),
                modifier = Modifier.padding(start = ZidRunDimens.spaceXs, bottom = 4.dp),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            modifier = Modifier.padding(top = ZidRunDimens.spaceXs),
        ) {
            Text(
                text = pluralStringResource(R.plurals.runs_overview_count, runCount, runCount),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.65f),
            )
            if (streakWeeks > 0) {
                Text(
                    text = "·",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.65f),
                )
                Icon(
                    painterResource(R.drawable.ic_timer),
                    contentDescription = null,
                    tint = colors.accent,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    // A real plural resource, not "$n $noun" concatenation — that produced
                    // "1 semaines de série" in French and invalid singular Arabic (RED-R07).
                    text = pluralStringResource(R.plurals.runs_overview_streak_weeks, streakWeeks, streakWeeks),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.65f),
                )
            }
        }
        Box(
            modifier = Modifier
                .padding(top = 20.dp)
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                .background(Color.White.copy(alpha = 0.15f)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fill)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                    .background(colors.primary),
            )
        }
    }
}

/** The most recent run: route thumbnail beside the three headline metrics. */
@Composable
private fun LatestRunCard(run: RunDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.dateTime(run.startedAt, locale)
    val title = run.title ?: stringResource(R.string.runs_untitled)

    ZidRunCard(
        onClick = onClick,
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = "$title, ${ZidRunFormat.decimal(run.distanceKm, locale)} km"
        },
    ) {
      Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = ZidRunDimens.spaceMd),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.runs_latest).uppercase(locale),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    letterSpacing = 1.6.sp,
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textStrong,
                    modifier = Modifier.padding(top = ZidRunDimens.spaceXs),
                )
            }
            Text(
                text = dateLabel,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            RouteShape(
                route = run.displayRoute,
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerMd)),
            )
            Spacer(Modifier.width(ZidRunDimens.spaceMd))
            Row(modifier = Modifier.weight(1f).height(IntrinsicSize.Min)) {
                OverviewMetric(
                    label = stringResource(R.string.runs_stat_distance),
                    value = "${ZidRunFormat.decimal(run.distanceKm, locale)} ${stringResource(R.string.runs_unit_km)}",
                    modifier = Modifier.weight(1f),
                )
                MetricDivider()
                OverviewMetric(
                    label = stringResource(R.string.runs_stat_pace),
                    value = ZidRunFormat.pace(run.averagePaceSecondsPerKm),
                    modifier = Modifier.weight(1f),
                )
                MetricDivider()
                OverviewMetric(
                    label = stringResource(R.string.runs_stat_time),
                    value = ZidRunFormat.duration(run.durationSeconds),
                    modifier = Modifier.weight(1f),
                )
            }
        }
      }
    }
}

/** Lifetime bests across the runner's whole history. */
@Composable
private fun PersonalBestsCard(
    totalDistanceKm: Double,
    longestRunKm: Double,
    bestPaceSecondsPerKm: Int?,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    ZidRunCard {
      Column {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = ZidRunDimens.spaceMd),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.runs_overview_records),
                style = MaterialTheme.typography.titleMedium,
                color = colors.textStrong,
                modifier = Modifier.weight(1f),
            )
            Icon(
                painterResource(R.drawable.ic_award),
                contentDescription = null,
                tint = colors.accent,
                modifier = Modifier.size(20.dp),
            )
        }
        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            OverviewMetric(
                label = stringResource(R.string.runs_overview_total_distance),
                value = "${ZidRunFormat.decimal(totalDistanceKm, locale)} ${stringResource(R.string.runs_unit_km)}",
                modifier = Modifier.weight(1f),
            )
            MetricDivider()
            OverviewMetric(
                label = stringResource(R.string.runs_overview_longest),
                value = "${ZidRunFormat.decimal(longestRunKm, locale)} ${stringResource(R.string.runs_unit_km)}",
                modifier = Modifier.weight(1f),
            )
            MetricDivider()
            OverviewMetric(
                // Em dash rather than a zero: the runner has no rated pace yet, and "0:00/km" would
                // read as an impossibly fast one.
                label = stringResource(R.string.runs_overview_best_pace),
                value = bestPaceSecondsPerKm?.let { ZidRunFormat.pace(it) } ?: "—",
                modifier = Modifier.weight(1f),
            )
        }
      }
    }
}

/** One cell of a divided metric row: small caps label over a tabular value. */
@Composable
private fun OverviewMetric(label: String, value: String, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    // Three cells share ~180dp beside the thumbnail on a 320dp screen, so the type is a step
    // down from the website's. Labels may wrap to a second line rather than ellipsize — at 1.3×
    // font "TOTAL DISTANCE" was truncating to "TOTAL DISTAN…" (RED-R07); values stay one-line
    // tabular figures.
    Column(modifier = modifier.padding(horizontal = 2.dp)) {
        Text(
            text = label.uppercase(locale),
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelMedium,
            color = colors.textStrong,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
private fun MetricDivider() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(ZidRunTheme.colors.border),
    )
}

