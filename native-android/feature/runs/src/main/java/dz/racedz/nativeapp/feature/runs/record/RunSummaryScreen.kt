package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.material3.Icon
import androidx.compose.foundation.layout.size
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
import androidx.compose.material3.Switch
import androidx.compose.runtime.Composable
import kotlinx.coroutines.flow.map
import androidx.compose.runtime.LaunchedEffect
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
import dz.racedz.nativeapp.core.design.ZidRunEffortSlider
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.distanceUnitLabel
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.feature.runs.ExpandableRunMap

/** The server's minimum duration for any run (createRunnerRunSchema.durationSeconds). */
private const val MIN_SAVABLE_SECONDS = 60

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
    val context = androidx.compose.ui.platform.LocalContext.current

    // No GPS distance at all — the receiver never got a fix. The run is still saveable: the distance
    // is pre-filled from the step counter, in the runner's unit, and they can correct it (or type it
    // when there were no steps either). See NoGpsDistance.
    val noGpsDistance = state.distanceKm <= 0.0
    val stepEstimateKm = remember(state.stepCount, state.avgCadenceSpm) {
        NoGpsDistance.estimateKm(state.stepCount, state.avgCadenceSpm)
    }
    val stepEstimateText = remember(stepEstimateKm) {
        stepEstimateKm?.let {
            String.format(java.util.Locale.ROOT, "%.2f", dz.racedz.nativeapp.core.design.ZidRunUnits.fromKm(it))
        }.orEmpty()
    }
    var noGpsDistanceText by rememberSaveable { mutableStateOf(stepEstimateText) }
    val noGpsDistanceKm = NoGpsDistance.parseInput(noGpsDistanceText)
        ?.let { dz.racedz.nativeapp.core.design.ZidRunUnits.toKm(it) }
    val noGpsDistanceValid = NoGpsDistance.isValid(noGpsDistanceKm)

    // The headline numbers are the ones that will be saved. For a no-GPS run that is the runner's
    // distance (the GPS one is 0), with pace and moving time derived the way the server will
    // derive them — otherwise the summary said 0.00 km and no pace while the saved run said 0.31.
    // An invalid entry shows a dash, never the 0 it would replace.
    val noGpsMovingSeconds = NoGpsDistance.movingSeconds(state.steppingSeconds, state.elapsedSeconds)
    val shownDistanceKm: Double? = if (noGpsDistance) noGpsDistanceKm.takeIf { noGpsDistanceValid } else state.distanceKm
    // Null = unknown (no step counter either): shown as a dash, and pace/calories fall back to the
    // whole duration exactly as the server does, rather than a "0:00 moving" beside a real pace.
    val shownMovingSeconds: Int? = if (noGpsDistance) noGpsMovingSeconds else state.movingSeconds
    val shownPace = if (noGpsDistance) {
        NoGpsDistance.paceSecondsPerKm(shownDistanceKm, noGpsMovingSeconds, state.elapsedSeconds)
    } else {
        state.averagePaceSecondsPerKm
    }
    val shownCalories = if (noGpsDistance) {
        shownDistanceKm?.let { GpsQuality.estimateCalories(it, noGpsMovingSeconds ?: state.elapsedSeconds) }
    } else {
        state.calories
    }
    // Say where a no-GPS distance came from: the untouched step estimate, or the runner's own number.
    val shownDistanceLabel = when {
        !noGpsDistance -> distanceUnitLabel()
        stepEstimateText.isNotEmpty() && noGpsDistanceText == stepEstimateText ->
            stringResource(R.string.runs_distance_estimated, distanceUnitLabel())
        else -> stringResource(R.string.runs_distance_entered, distanceUnitLabel())
    }

    // The background worker may finish this save while the screen is open (NATRUN-07.2): leave the
    // way a foreground save leaves, to the saved run.
    // Captured once: a background success resets the recorder (clientId becomes empty) before
    // the screen leaves, and the match must still be made against the run this screen showed.
    val summaryClientId = rememberSaveable { state.clientId }
    val synced by RunRecorder.syncedRunIds.collectAsStateWithLifecycle()
    LaunchedEffect(synced) {
        if (summaryClientId.isNotEmpty()) synced[summaryClientId]?.let { runId -> onSaved(runId) }
    }
    // While the worker is actually posting this run, a second foreground Save would race it; the
    // server would dedupe by clientId, but the button should not pretend to be needed.
    val owner = RunRecorder.currentOwnerUserId()
    val backgroundSaving by remember(owner, summaryClientId) {
        if (owner == null || summaryClientId.isEmpty()) kotlinx.coroutines.flow.flowOf(false)
        else androidx.work.WorkManager.getInstance(context)
            .getWorkInfosForUniqueWorkFlow(RunSyncWorker.uniqueName(owner, summaryClientId))
            .map { infos -> infos.any { it.state == androidx.work.WorkInfo.State.RUNNING } }
    }.collectAsStateWithLifecycle(initialValue = false)

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
            // A failed-fix run has nothing to draw, and a full 1.5:1 empty panel pushed Save and
            // Discard two screens down — exactly when the runner most wants to discard (DEV-R08).
            if (state.route.orEmpty().size > 1) {
                ExpandableRunMap(
                    route = state.route,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1.5f)
                        .clip(RoundedCornerShape(ZidRunDimens.cornerLg)),
                )
            } else {
                Text(
                    text = stringResource(R.string.runs_no_route_captured),
                    style = MaterialTheme.typography.bodySmall,
                    color = ZidRunTheme.colors.textMuted,
                )
            }

            // The recording stopped unexpectedly and could not be continued (RecordingRecovery): say
            // when, so the runner knows the run ends there and why, with Save and Discard below.
            state.interruptedAtEpochMs?.let { stoppedAt ->
                Text(
                    text = stringResource(R.string.runs_interrupted_summary, ZidRunFormat.clockTime(stoppedAt, currentLocale())),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textStrong,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                        .background(colors.accentSoft)
                        .padding(ZidRunDimens.spaceMd),
                )
            }

            // Which activity this is saved as. Repeated here because the Start screen remembers the
            // last one, and changeable because the sport cannot be edited once saved.
            SummarySportPicker(selected = state.sport, onSelect = RunRecorder::setSport)

            // The same sport-specific test the server will apply the moment this is saved. Said
            // here, where the sport can still be changed and Discard is one tap away, rather than
            // only on the saved run's detail screen. Never a block: "Keep" saves it as recorded,
            // and it is then kept but not counted (and never published).
            state.activityMismatch?.let { mismatch ->
                ActivityMismatchCard(mismatch = mismatch, sport = state.sport, onChangeSport = RunRecorder::setSport)
            }

            ZidRunCard {
                Row(
                    modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SummaryStat(
                        value = shownDistanceKm?.let { ZidRunFormat.distanceValue(it, locale) } ?: "—",
                        label = shownDistanceLabel,
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        value = ZidRunFormat.duration(state.elapsedSeconds),
                        label = stringResource(R.string.runs_stat_time),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    // A ride reads speed, not minutes per kilometre.
                    val ride = state.sport == "RIDE"
                    SummaryStat(
                        value = shownPace?.let { if (ride) ZidRunFormat.speed(it) else ZidRunFormat.pace(it) } ?: "—",
                        label = stringResource(if (ride) R.string.runs_avg_speed else R.string.runs_stat_pace),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            /*
             * Everything else the recorder measured.
             *
             * This screen used to show distance, time and pace and nothing more — moving time,
             * climb, calories and cadence were all live on the during-run screen, then vanished at
             * Finish and only reappeared on the run's detail page after saving. The runner was
             * asked to title and rate a run whose numbers they could no longer see. All four come
             * straight off the recorder; none of them costs a request.
             */
            ZidRunCard {
                Row(
                    modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SummaryStat(
                        value = shownMovingSeconds?.let { ZidRunFormat.duration(it) } ?: "—",
                        label = stringResource(R.string.runs_moving_time),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        value = ZidRunFormat.elevationGain(state.elevationGainM.toInt()),
                        label = stringResource(R.string.runs_elevation),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        value = shownCalories?.toString() ?: "—",
                        label = stringResource(R.string.runs_stat_calories),
                        modifier = Modifier.weight(1f),
                    )
                    Hairline()
                    SummaryStat(
                        // Null on a phone with no step counter, and until the run is long enough
                        // for a step rate to mean anything — an em dash, never a fabricated 0.
                        value = state.avgCadenceSpm?.let { "$it spm" } ?: "—",
                        label = stringResource(R.string.runs_cadence),
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            // Completed kilometres, in the order they were run. The server recomputes these from
            // the route on save (interpolating the boundary crossing, which is why the saved run's
            // splits can differ by a second); these are the recorder's own, shown so the runner can
            // rate their effort against the kilometres they actually felt.
            val splits = state.splits
            if (splits.isNotEmpty()) {
                ZidRunCard {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        Text(
                            text = stringResource(R.string.runs_splits),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                        )
                        val fastest = splits.minOf { it.paceSecondsPerKm }.coerceAtLeast(1)
                        splits.forEach { split ->
                            val isFastest = split.paceSecondsPerKm == fastest && splits.size > 1
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .semantics(mergeDescendants = true) {
                                        contentDescription =
                                            "${split.km} ${ZidRunFormat.pace(split.paceSecondsPerKm)}"
                                    },
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = "${stringResource(R.string.runs_split_km)} ${split.km}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = colors.textMuted,
                                    modifier = Modifier.width(64.dp),
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(end = ZidRunDimens.spaceSm),
                                ) {
                                    Box(
                                        Modifier
                                            // Proportional to the fastest kilometre, floored so the
                                            // slowest still reads as a bar rather than a sliver.
                                            .fillMaxWidth(
                                                (fastest.toFloat() / split.paceSecondsPerKm)
                                                    .coerceIn(0.25f, 1f)
                                            )
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
                            }
                        }
                    }
                }
            }

            // Manual laps pressed during the run (NATRUN-06.5), derived on device with the same rules
            // the server applies, so this table and Run Details agree.
            if (state.laps.isNotEmpty()) {
                dz.racedz.nativeapp.feature.runs.LapsCard(
                    laps = LapMath.derive(state.laps, state.distanceMeters, state.elapsedSeconds).map {
                        dz.racedz.nativeapp.feature.runs.LapRow(it.index, it.meters, it.seconds, it.paceSecondsPerKm)
                    },
                    locale = locale,
                )
            }

            if (noGpsDistance) {
                ZidRunCard {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        Text(
                            text = stringResource(R.string.runs_no_gps_title),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                        )
                        Text(
                            text = stringResource(
                                if (stepEstimateKm != null) R.string.runs_no_gps_estimated else R.string.runs_no_gps_enter,
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        ZidRunTextField(
                            value = noGpsDistanceText,
                            onValueChange = { noGpsDistanceText = it.take(10) },
                            label = stringResource(R.string.runs_manual_distance_label, distanceUnitLabel()),
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal,
                            errorText = if (noGpsDistanceText.isNotBlank() && !noGpsDistanceValid) {
                                stringResource(R.string.runs_manual_error_distance)
                            } else {
                                null
                            },
                            required = true,
                            enabled = !saveState.saving,
                        )
                    }
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

            /*
             * Photos, attached before the run is stored.
             *
             * Here rather than on the saved run's detail screen because this is the one moment the
             * runner is still holding the phone with the finish line behind them. Asking later, from
             * a row in a list, is asking a question nobody goes back to answer — the same reasoning
             * that puts title, notes and effort on this screen.
             *
             * Each image uploads as it is picked, so the run's own save request stays small and
             * retryable; the URLs ride along with it. The server re-encodes every upload, which
             * strips the EXIF GPS coordinates a mid-run photo carries.
             */
            RunPhotoPicker(
                photos = saveState.photos,
                uploading = saveState.uploadingPhotos,
                error = saveState.photoError,
                enabled = !saveState.saving,
                onPicked = viewModel::addPhotos,
                onRemove = viewModel::removePhoto,
                onDismissError = viewModel::dismissPhotoError,
            )

            ZidRunEffortSlider(
                value = effort,
                onValueChange = { effort = it },
                label = stringResource(R.string.runs_effort_label, ZidRunFormat.count(effort, currentLocale())),
                enabled = !saveState.saving,
            )

            /*
             * Visibility, decided before the run exists on the server (NATRUN-06.1). The same row
             * Run Details shows afterwards, so the choice reads the same in both places. Private
             * by default: a run records where the runner was. The value lives in the recorder so a
             * failed save retried later — or restored after a process kill — posts what was chosen.
             * A run the on-foot test flags cannot be published, here or on the server.
             */
            val publishable = state.activityMismatch == null
            ZidRunCard {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
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
                                    if (state.draftIsPublic && publishable) R.string.runs_visibility_public_body
                                    else R.string.runs_visibility_private_body
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                        }
                        Spacer(Modifier.width(ZidRunDimens.spaceMd))
                        Switch(
                            checked = state.draftIsPublic && publishable,
                            onCheckedChange = { RunRecorder.setDraftVisibility(it) },
                            enabled = !saveState.saving && publishable,
                        )
                    }
                    if (!publishable) {
                        Text(
                            stringResource(R.string.runs_visibility_blocked),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                }
            }

            saveState.error?.let { ZidRunInlineError(it) }

            // A no-GPS recording saves once its distance (estimated or typed) is one the server accepts;
            // the field above says what is wrong until then. Under a minute the server refuses any
            // run (createRunnerRunSchema), and its "Check the highlighted fields" highlighted nothing
            // here — so say why instead, and leave Discard as the way out.
            val tooShort = state.elapsedSeconds < MIN_SAVABLE_SECONDS
            if (tooShort) {
                Text(
                    text = stringResource(R.string.runs_too_short_to_save),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
            val nothingToSave = tooShort || (noGpsDistance && !noGpsDistanceValid)

            ZidRunButton(
                text = stringResource(R.string.runs_save),
                onClick = {
                    viewModel.save(
                        title = title.trim().takeIf { it.isNotEmpty() },
                        notes = notes.trim().takeIf { it.isNotEmpty() },
                        perceivedEffort = effort,
                        noGpsDistanceKm = if (noGpsDistance) noGpsDistanceKm else null,
                        onSaved = onSaved,
                        onFailedRetryable = { request ->
                            // The runner asked to save and the network said no: keep their exact
                            // body and let WorkManager finish the job when there is a connection.
                            if (RunRecorder.markSaveRequested(request)) {
                                RunRecorder.currentOwnerUserId()?.let { owner ->
                                    RunSyncWorker.enqueue(context, owner, request.clientId)
                                }
                            }
                        },
                    )
                },
                loading = saveState.saving || saveState.uploadingPhotos || backgroundSaving,
                // Also blocked while photos upload. Saving mid-upload posted the run with only the
                // URLs that had landed, and the rest finished into storage attached to nothing —
                // the runner loses the photo and the server keeps the bytes forever.
                enabled = !nothingToSave && !saveState.saving && !saveState.uploadingPhotos && !backgroundSaving,
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
                        // A background retry may already carry this run; discarding must take the
                        // retry with it, or it can still upload what was just destroyed.
                        RunRecorder.state.value.clientId.takeIf { it.isNotEmpty() }?.let { clientId ->
                            RunRecorder.currentOwnerUserId()?.let { owner ->
                                RunSyncWorker.cancel(context, owner, clientId)
                            }
                        }
                        RunRecorder.discard()
                        GuidedSessionController.clear()
                        onDiscarded()
                    } else {
                        confirmDiscard = true
                    }
                },
                // Not while a background retry is running either: cancel-then-discard is handled
                // above, but a retry that already reached the server would resurrect a run the
                // runner watched themselves destroy. Wait for the outcome instead.
                enabled = !saveState.saving && !backgroundSaving,
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

/** The four activities as chips, the current one filled; picking one re-runs the sport check. */
@Composable
private fun SummarySportPicker(selected: String, onSelect: (String) -> Unit) {
    val colors = ZidRunTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
        Text(
            text = stringResource(R.string.runs_sport),
            style = MaterialTheme.typography.titleSmall,
            color = colors.textMuted,
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            dz.racedz.nativeapp.core.design.RunSport.entries.forEach { sport ->
                val isSelected = sport.code == selected
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                        .background(if (isSelected) colors.primary else colors.surfaceMuted)
                        .selectable(selected = isSelected, role = Role.RadioButton) { onSelect(sport.code) }
                        .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                ) {
                    Icon(
                        sport.icon,
                        contentDescription = null,
                        tint = if (isSelected) colors.onPrimary else colors.textMuted,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceXs))
                    Text(
                        text = stringResource(sport.labelRes),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (isSelected) colors.onPrimary else colors.textStrong,
                    )
                }
            }
        }
    }
}

/**
 * "This does not fit the activity it was recorded as" — with the activities it could have been,
 * one tap each, and Keep. Keep only folds the choices away: the run is saved as recorded and the
 * server marks it, exactly as it would have without the card.
 */
@Composable
private fun ActivityMismatchCard(mismatch: GpsQuality.ActivityMismatch, sport: String, onChangeSport: (String) -> Unit) {
    val colors = ZidRunTheme.colors
    var kept by rememberSaveable(mismatch, sport) { mutableStateOf(false) }
    val (title, body) = when (mismatch) {
        GpsQuality.ActivityMismatch.TooFastForWalk -> R.string.runs_mismatch_walk_title to R.string.runs_mismatch_walk_body
        GpsQuality.ActivityMismatch.RideTooFast -> R.string.runs_mismatch_ride_title to R.string.runs_mismatch_ride_body
        GpsQuality.ActivityMismatch.LowCadence -> R.string.runs_validity_title to R.string.runs_validity_cadence
        GpsQuality.ActivityMismatch.Vehicle -> R.string.runs_validity_title to R.string.runs_validity_pace
    }
    // What it could have been instead: a too-fast walk was a run or a ride; wheels on a run, walk
    // or trail were a ride. A ride at motorway speed has nothing better to offer.
    val alternatives = when (mismatch) {
        GpsQuality.ActivityMismatch.TooFastForWalk -> listOf("RUN", "RIDE")
        GpsQuality.ActivityMismatch.Vehicle, GpsQuality.ActivityMismatch.LowCadence -> listOf("RIDE")
        GpsQuality.ActivityMismatch.RideTooFast -> emptyList()
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.accentSoft)
            .padding(ZidRunDimens.spaceMd)
            .semantics { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Text(text = stringResource(title), style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
        Text(text = stringResource(body), style = MaterialTheme.typography.bodySmall, color = colors.text)
        if (!kept && alternatives.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
            ) {
                alternatives.forEach { code ->
                    val option = dz.racedz.nativeapp.core.design.RunSport.fromCode(code)
                    dz.racedz.nativeapp.core.design.ZidRunButton(
                        text = stringResource(R.string.runs_mismatch_was, stringResource(option.labelRes)),
                        onClick = { onChangeSport(code) },
                        leadingIcon = option.icon,
                    )
                }
                dz.racedz.nativeapp.core.design.ZidRunButton(
                    text = stringResource(R.string.runs_mismatch_keep, stringResource(dz.racedz.nativeapp.core.design.RunSport.fromCode(sport).labelRes)),
                    onClick = { kept = true },
                    containerColor = colors.surface,
                    contentColor = colors.textStrong,
                )
            }
        }
    }
}
