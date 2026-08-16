package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
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
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.network.resolveMediaUrl
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
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material.icons.filled.Edit
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import dz.racedz.nativeapp.core.design.ZidRunEffortSlider
import dz.racedz.nativeapp.core.design.ZidRunTextField

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
    /** Called after the server has accepted the delete, so the list never shows a ghost row. */
    onDeleted: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val exportShareTitle = stringResource(R.string.runs_export_share)
    val exportFailed = stringResource(R.string.runs_export_failed)
    val editLabel = stringResource(R.string.runs_edit_details)
    var confirmingDelete by remember { mutableStateOf(false) }
    // Survives rotation and process recreation, so a half-written note is not lost to either.
    var editing by rememberSaveable { mutableStateOf(false) }
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    Column(modifier = modifier.fillMaxSize().background(colors.background)) {
        val run = state.run
        ZidRunTopBar(
            title = run?.title ?: stringResource(R.string.runs_detail_title),
            onBack = onBack,
            trailing = {
                if (run != null) {
                    // Title, notes and effort were write-once until NATRUN-06.2: the server has
                    // accepted PATCH all along, this is the surface over it. A labelled 48 dp icon
                    // rather than a fourth button in the actions row, which was already two wide.
                    IconButton(
                        onClick = { editing = true },
                        enabled = !state.mutating,
                        modifier = Modifier.semantics { contentDescription = editLabel },
                    ) {
                        Icon(Icons.Filled.Edit, contentDescription = null, tint = colors.textStrong)
                    }
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

                /*
                 * "This wasn't run on foot."
                 *
                 * The server already decides this at save time (detectNonFootActivity: a step rate
                 * too low for the ground covered, or a pace no human sustains) and quietly keeps
                 * the activity out of records, streaks, plan adherence and the coach's context.
                 * None of that was visible here, so a bike ride or a drive looked like an ordinary
                 * run with an oddly good pace — and the runner had no way to know why their
                 * personal bests never moved. Said plainly, at the top, before the numbers that
                 * are not being counted.
                 */
                if (run.validity != "VALID") {
                    NonFootNotice(reason = run.validityReason)
                }

                /*
                 * "Was this your Tuesday tempo?"
                 *
                 * The matcher has always run on save, and has always stored either a link or a
                 * suggestion — but the suggestion appeared once, in the create response, and the
                 * phone had no way to act on it and no way to undo a wrong automatic link. Plan
                 * adherence on mobile therefore depended entirely on the matcher being right, with
                 * no correction available to the one person who knows the answer (NATGAP-07).
                 *
                 * An automatic link is stated and offered for undo; a link the runner made
                 * deliberately is stated without one, because there is nothing to second-guess.
                 */
                run.suggestedMatch?.let { suggestion ->
                    WorkoutMatchPrompt(
                        title = suggestion.title,
                        busy = state.mutating,
                        onConfirm = { viewModel.confirmWorkoutMatch(suggestion.workoutId) },
                        onFreeRun = viewModel::unlinkWorkoutMatch,
                    )
                }
                if (run.suggestedMatch == null && run.workoutId != null && run.workoutTitle != null) {
                    WorkoutLinkedNotice(
                        title = run.workoutTitle!!,
                        automatic = run.workoutMatchSource == "AUTO",
                        busy = state.mutating,
                        onUndo = viewModel::unlinkWorkoutMatch,
                    )
                }

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

                // Photos attached when the run was saved. Above the analysis, below the numbers:
                // they are what the runner will actually come back to this screen for.
                if (run.photos.isNotEmpty()) {
                    ZidRunSectionHeader(title = stringResource(R.string.runs_photos))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                    ) {
                        run.photos.forEach { url ->
                            AsyncImage(
                                model = resolveMediaUrl(url),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .size(140.dp)
                                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                                    .background(colors.surfaceMuted),
                            )
                        }
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

                // Best efforts (NATRUN-06.3): the three fixed distances, each either measured or
                // explained. Only for runs with a measured route — a manual entry can never have
                // one, and a card of three "unavailable" rows would be noise. PR is the server's
                // verdict; nothing is inferred here.
                if (run.source != "MANUAL" && run.validity == "VALID" && (run.route?.size ?: 0) > 1) {
                    BestEffortsCard(run = run, locale = locale)
                }

                // Availability is answered per metric (P234-R03): one chart rendering must not
                // suppress another's explanation, and the reason must match the actual cause —
                // no route at all, a route without timing, or a route too short for the server's
                // windows (splits drop a sub-150 m remainder; pace needs 250 m).
                val routePoints = run.route.orEmpty()
                val timedPoints = routePoints.count { it.t != null }
                val elevatedPoints = routePoints.count { it.ele != null }
                val hasRoute = routePoints.size > 1

                val missing = buildList {
                    if (run.splits.isEmpty()) {
                        add(
                            stringResource(R.string.runs_splits) to stringResource(
                                when {
                                    !hasRoute -> R.string.runs_series_no_route
                                    timedPoints < 2 -> R.string.runs_series_unavailable
                                    else -> R.string.runs_series_too_short
                                }
                            )
                        )
                    }
                    if (run.paceSeries.size <= 1) {
                        add(
                            stringResource(R.string.runs_pace_chart) to stringResource(
                                when {
                                    !hasRoute -> R.string.runs_series_no_route
                                    timedPoints < 2 -> R.string.runs_series_unavailable
                                    else -> R.string.runs_series_too_short
                                }
                            )
                        )
                    }
                    if (run.elevationSeries.size <= 1) {
                        add(
                            stringResource(R.string.runs_elevation) to stringResource(
                                when {
                                    !hasRoute -> R.string.runs_series_no_route
                                    elevatedPoints < 2 -> R.string.runs_elevation_no_data
                                    else -> R.string.runs_series_too_short
                                }
                            )
                        )
                    }
                }
                if (missing.isNotEmpty()) {
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            missing.forEach { (metric, reason) ->
                                Column {
                                    Text(
                                        text = metric,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.textStrong,
                                    )
                                    Text(
                                        text = reason,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                    )
                                }
                            }
                        }
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

                /*
                 * One banner, and only when this run actually earned it.
                 *
                 * There used to be two, unconditionally: a "steady effort" line that appeared
                 * whenever the negative-split test failed — which is most runs — and a fixed
                 * "easy day next, hydrate" line with no input from the run at all. Advice that
                 * cannot be wrong is advice that says nothing, and after two or three runs the
                 * runner learns to skip the whole strip, taking any real insight with it. A
                 * negative split is a genuine, checkable fact about this run, so it keeps its
                 * banner; everything else belongs to the coach, which has the context to say
                 * something true. Silence is the honest default here.
                 */
                val fastestFinish = run.splits.size > 1 &&
                    run.splits.last().paceSecondsPerKm < run.splits.first().paceSecondsPerKm
                if (fastestFinish) {
                    InsightBanner(
                        icon = Icons.AutoMirrored.Filled.DirectionsRun,
                        text = stringResource(R.string.runs_insight_finish),
                        tint = colors.success,
                        container = colors.successSoft,
                    )
                }

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
                            // Fetched and shared on-device rather than handed to a browser: the old
                            // route opened a signed web link, so the runner left the app to receive
                            // a download they then had to go and find. Same share sheet the account
                            // export uses, so the file reaches mail/Drive/Files in one step.
                            onClick = {
                                viewModel.exportGpx(context.cacheDir, exportFailed) { file ->
                                    shareRunFile(context, file, exportShareTitle, "application/gpx+xml", exportFailed)
                                }
                            },
                            enabled = !state.mutating,
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
                                // The server refuses to publish a non-foot activity, so the switch
                                // is disabled rather than left to fail: offering a control that
                                // always errors is worse than not offering it.
                                enabled = !state.mutating && run.validity == "VALID",
                            )
                        }

                        if (run.validity != "VALID") {
                            Text(
                                stringResource(R.string.runs_visibility_blocked),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
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

    if (editing && state.run != null) {
        EditRunSheet(
            run = state.run!!,
            state = state,
            onSave = { title, notes, effort ->
                viewModel.editDetails(title, notes, effort) { editing = false }
            },
            onDismiss = {
                viewModel.clearEditError()
                editing = false
            },
        )
    }
}

/**
 * Asks whether this run was the planned session, with both answers given equal weight.
 *
 * Neither button is styled as the "right" one. The matcher is guessing from a distance and a date,
 * and a runner who did an unplanned easy 5k on the day a tempo was scheduled must find "it was a
 * free run" exactly as easy to reach — a leading design here quietly corrupts adherence with
 * confirmations nobody meant to give.
 */
@Composable
private fun WorkoutMatchPrompt(
    title: String,
    busy: Boolean,
    onConfirm: () -> Unit,
    onFreeRun: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    ZidRunCard {
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            Text(
                text = stringResource(R.string.runs_match_suggest, title),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textStrong,
            )
            Text(
                text = stringResource(R.string.runs_match_suggest_body),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                ZidRunButton(
                    text = stringResource(R.string.runs_match_yes),
                    onClick = onConfirm,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                )
                ZidRunOutlinedButton(
                    text = stringResource(R.string.runs_match_free),
                    onClick = onFreeRun,
                    enabled = !busy,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

/**
 * States an existing link, with an undo only when the app made it.
 *
 * A link the runner chose ("Log this run" from the plan) or confirmed needs no undo offered beside
 * it — it would invite them to second-guess a decision they already made. An automatic one does,
 * because nobody agreed to it.
 */
@Composable
private fun WorkoutLinkedNotice(title: String, automatic: Boolean, busy: Boolean, onUndo: () -> Unit) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.primarySoft)
            .padding(ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
    ) {
        Icon(
            Icons.Filled.EventAvailable,
            contentDescription = null,
            tint = colors.primary,
            modifier = Modifier.size(20.dp),
        )
        Text(
            text = stringResource(
                if (automatic) R.string.runs_match_linked_auto else R.string.runs_match_linked,
                title,
            ),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textStrong,
            modifier = Modifier.weight(1f),
        )
        if (automatic) {
            ZidRunTextButton(
                text = stringResource(R.string.runs_match_undo),
                // Guarded here rather than by a disabled state: ZidRunTextButton has no `enabled`,
                // and inside a Row it must not fill the width or it collapses the label beside it.
                onClick = { if (!busy) onUndo() },
                fillWidth = false,
            )
        }
    }
}

/**
 * The non-foot warning: what the server concluded, why, and what it means for the runner's numbers.
 *
 * Deliberately a warning tone rather than an error — the activity is not rejected, and the runner
 * may well have meant to record a ride. What matters is that it will not count, and why.
 */
@Composable
private fun NonFootNotice(reason: String?) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.accentSoft)
            .border(1.dp, colors.accent.copy(alpha = 0.35f), RoundedCornerShape(ZidRunDimens.cornerLg))
            .padding(ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
    ) {
        Icon(
            Icons.Filled.DirectionsBike,
            contentDescription = null,
            tint = colors.accent,
            modifier = Modifier.size(24.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
            Text(
                text = stringResource(R.string.runs_validity_title),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textStrong,
            )
            Text(
                text = stringResource(
                    when (reason) {
                        "LOW_CADENCE_AT_SPEED" -> R.string.runs_validity_cadence
                        "IMPOSSIBLE_PACE" -> R.string.runs_validity_pace
                        else -> R.string.runs_validity_generic
                    }
                ),
                style = MaterialTheme.typography.bodySmall,
                color = colors.text,
            )
        }
    }
}

/**
 * The after-the-fact edit sheet (NATRUN-06.2): the same three fields the summary screen collected,
 * in the same components, over the same PATCH the visibility switch uses.
 *
 * Fields are seeded from the run once per opening and then owned by the sheet, so a refresh
 * underneath (a 409 reloads the run) never wipes what the runner typed — the conflict copy asks
 * them to look at the newer version and decide. Save closes only after the server accepted it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditRunSheet(
    run: dz.racedz.nativeapp.core.network.RunDetailDto,
    state: RunDetailUiState,
    onSave: (title: String, notes: String, effort: Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    var title by rememberSaveable(run.id) { mutableStateOf(run.title.orEmpty()) }
    var notes by rememberSaveable(run.id) { mutableStateOf(run.notes.orEmpty()) }
    var effort by rememberSaveable(run.id) { mutableStateOf(run.perceivedEffort) }
    val dirty = title != run.title.orEmpty() || notes != run.notes.orEmpty() || effort != run.perceivedEffort

    ModalBottomSheet(
        onDismissRequest = { if (!state.mutating) onDismiss() },
        // Fully open at once: half-expanded hid Save below the fold on the M21 and 1.3x text.
        sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = colors.borderStrong) },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = ZidRunDimens.spaceLg)
                .padding(bottom = ZidRunDimens.spaceXl),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                stringResource(R.string.runs_edit_details),
                style = MaterialTheme.typography.titleLarge,
                color = colors.textStrong,
            )
            ZidRunTextField(
                value = title,
                onValueChange = { title = it.take(120) },
                label = stringResource(R.string.runs_title_label),
                enabled = !state.mutating,
                errorText = state.editFieldErrors["title"],
            )
            ZidRunTextField(
                value = notes,
                onValueChange = { notes = it.take(2000) },
                label = stringResource(R.string.runs_notes_label),
                enabled = !state.mutating,
                singleLine = false,
                errorText = state.editFieldErrors["notes"],
            )
            ZidRunEffortSlider(
                value = effort,
                onValueChange = { effort = it },
                label = stringResource(R.string.runs_effort_label, ZidRunFormat.count(effort, currentLocale())),
                enabled = !state.mutating,
            )
            if (state.editConflict) {
                ZidRunInlineError(stringResource(R.string.runs_edit_conflict))
            } else {
                state.editError?.let { ZidRunInlineError(it) }
            }
            ZidRunButton(
                text = stringResource(R.string.common_save),
                onClick = { onSave(title, notes, effort) },
                loading = state.mutating,
                enabled = dirty && !state.mutating,
            )
            ZidRunOutlinedButton(
                text = stringResource(R.string.common_cancel),
                onClick = onDismiss,
                enabled = !state.mutating,
            )
        }
    }
}

/** Distances the card always lists, in metres. Mirrors BEST_EFFORT_DISTANCES_M on the server. */
private val BEST_EFFORT_DISTANCES_M = listOf(1_000, 5_000, 10_000)

@Composable
private fun BestEffortsCard(run: dz.racedz.nativeapp.core.network.RunDetailDto, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    val prLabel = stringResource(R.string.runs_best_effort_pr)
    val prA11y = stringResource(R.string.runs_best_effort_pr_a11y)
    ZidRunSectionHeader(title = stringResource(R.string.runs_best_efforts))
    ZidRunCard {
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.runs_best_effort_distance).uppercase(locale),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    modifier = Modifier.width(64.dp),
                )
                Text(
                    stringResource(R.string.runs_best_effort_time).uppercase(locale),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                    modifier = Modifier.width(72.dp),
                )
                Text(
                    stringResource(R.string.runs_split_pace),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.textMuted,
                )
            }
            BEST_EFFORT_DISTANCES_M.forEach { distanceM ->
                val effort = run.bestEfforts.firstOrNull { it.distanceM == distanceM }
                val distanceLabel = ZidRunFormat.distance(distanceM / 1000.0, locale)
                val a11y = if (effort != null) {
                    "$distanceLabel ${ZidRunFormat.duration(effort.seconds)}" +
                        (if (effort.isPersonalBest) ", $prA11y" else "")
                } else {
                    stringResource(R.string.runs_best_effort_short, distanceLabel)
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 32.dp)
                        .semantics(mergeDescendants = true) { contentDescription = a11y },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        distanceLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (effort != null) colors.text else colors.textMuted,
                        modifier = Modifier.width(64.dp),
                    )
                    if (effort != null) {
                        Text(
                            ZidRunFormat.duration(effort.seconds),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                            modifier = Modifier.width(72.dp),
                        )
                        Text(
                            ZidRunFormat.pace((effort.seconds * 1000.0 / distanceM).toInt()),
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.text,
                        )
                        if (effort.isPersonalBest) {
                            Spacer(Modifier.weight(1f))
                            // Same pill as the top-bar visibility state; primary on primarySoft.
                            ZidRunPill(text = prLabel, color = colors.primary)
                        }
                    } else {
                        Text(
                            "—",
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textMuted,
                            modifier = Modifier.width(72.dp),
                        )
                        Text(
                            stringResource(R.string.runs_best_effort_short, distanceLabel),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                }
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

/**
 * Hands a generated file to a share target.
 *
 * A content:// URI from the app's own FileProvider with a one-shot read grant — never a file://
 * path, which Android has refused between apps since N.
 */
internal fun shareRunFile(
    context: android.content.Context,
    file: java.io.File,
    chooserTitle: String,
    mimeType: String,
    failedMessage: String,
) {
    val uri = runCatching {
        androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    }.getOrNull()
    if (uri == null) {
        android.widget.Toast.makeText(context, failedMessage, android.widget.Toast.LENGTH_LONG).show()
        return
    }
    val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(android.content.Intent.EXTRA_STREAM, uri)
        putExtra(android.content.Intent.EXTRA_TITLE, file.name)
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    runCatching { context.startActivity(android.content.Intent.createChooser(send, chooserTitle)) }
        .onFailure { android.widget.Toast.makeText(context, failedMessage, android.widget.Toast.LENGTH_LONG).show() }
}
