package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.CoachPlanWorkoutDto
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * The plan week (03-weekly-plan-v2.png): a day strip across the week, with the selected day's
 * session below it.
 *
 * The strip is built from the workouts the server returned rather than from a local calendar, so a
 * day with no workout is genuinely a rest day in the plan and not a gap the client invented.
 */
@Composable
fun PlanWeekScreen(
    viewModel: PlanWeekViewModel,
    onBack: () -> Unit,
    /** Carries the planned session's id so the saved run links back to it. */
    onLogRun: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val zone = remember { ZoneId.systemDefault() }
    val today = remember { LocalDate.now(zone) }

    var selectedDay by remember { mutableStateOf<LocalDate?>(null) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onBack)

        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.error != null -> ZidRunErrorView(
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

            !state.week.hasPlan -> ZidRunStatusView(
                icon = Icons.AutoMirrored.Filled.DirectionsRun,
                title = stringResource(R.string.coach_no_plan_title),
                body = stringResource(R.string.coach_no_plan_body),
            )

            // A plan exists but none of it lands in this week — the usual case being a plan created
            // late in the week that begins on Monday. Saying "no plan yet" here would contradict the
            // setup the runner has just finished.
            state.week.workouts.isEmpty() -> {
                val startsOn = state.week.planStartsOn
                    ?.let { runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull() }
                ZidRunStatusView(
                    icon = Icons.Filled.SelfImprovement,
                    title = stringResource(R.string.coach_plan_starts_title),
                    body = startsOn
                        ?.let { stringResource(R.string.coach_plan_starts_body, dayOptionLabel(it, locale)) }
                        ?: stringResource(R.string.coach_rest_body),
                )
            }

            else -> {
                /*
                 * Grouped, not keyed. `associateBy` kept only the last workout for a date, so
                 * moving a session onto a day that already had one made the other vanish from the
                 * plan entirely — while the server still had both, and still counted both against
                 * the week's adherence.
                 */
                val byDay = remember(state.week) {
                    state.week.workouts.groupBy { workout ->
                        Instant.parse(workout.scheduledFor).atZone(zone).toLocalDate()
                    }
                }
                /**
                 * Seven cells from the week the server named — plus any workout that lands outside
                 * them.
                 *
                 * The union is defensive, and it earned its place: a week-window bug on the server
                 * once returned a session dated after the week start it also returned, and this
                 * screen crashed rather than drawing it. A day the runner has a session on must
                 * always have somewhere to be shown, whatever the server's arithmetic did.
                 */
                val weekDays = remember(state.week) {
                    val start = state.week.weekStart
                        ?.let { runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull() }
                        ?: today.minusDays(today.dayOfWeek.value.toLong() - 1)
                    ((0L..6L).map { start.plusDays(it) } + byDay.keys).distinct().sorted()
                }
                val shown = selectedDay
                    ?: today.takeIf { byDay.containsKey(it) }
                    // firstOrNull, not first: a week with a plan but no session inside it is a real
                    // state (a rest week, or a plan that starts on Monday), not a crash.
                    ?: weekDays.firstOrNull { byDay.containsKey(it) }
                    ?: today
                val done = state.week.workouts.count { it.status == "COMPLETED" }
                val total = state.week.workouts.size

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = ZidRunDimens.spaceLg),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
                ) {
                    ZidRunDisplayTitle(text = stringResource(R.string.coach_plan_week_title))

                    // Confirms what the server actually did, announced politely so a screen reader
                    // hears it without the focus being stolen mid-scroll.
                    state.confirmation?.let { change ->
                        val message = stringResource(
                            if (change == PlanChange.Skipped) R.string.coach_skipped_done else R.string.coach_moved_done
                        )
                        Text(
                            text = message,
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.success,
                            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        )
                        LaunchedEffect(change) {
                            kotlinx.coroutines.delay(CONFIRMATION_MS)
                            viewModel.consumeConfirmation()
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = pluralStringResource(
                                R.plurals.coach_plan_sessions_week,
                                done,
                                ZidRunFormat.count(done, locale),
                                ZidRunFormat.count(total, locale),
                            ),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textMuted,
                        )
                        Spacer(Modifier.width(ZidRunDimens.spaceMd))
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(colors.border),
                        ) {
                            if (total > 0) {
                                Box(
                                    Modifier
                                        .fillMaxWidth(done.toFloat() / total)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(colors.primary),
                                )
                            }
                        }
                    }

                    /*
                     * The strip scrolls itself to the day being shown.
                     *
                     * Seven cells do not fit a 320dp screen, and the strip starts on Monday — so a
                     * runner opening the plan on a Saturday saw five "Rest" days and had to guess
                     * that their session was off the right edge. Today's session is the whole point
                     * of the screen; it should not need discovering.
                     */
                    val stripState = rememberLazyListState()
                    LaunchedEffect(shown, weekDays) {
                        val index = weekDays.indexOf(shown)
                        if (index >= 0) stripState.animateScrollToItem(index)
                    }
                    LazyRow(
                        state = stripState,
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                    ) {
                        items(weekDays, key = { it.toEpochDay() }) { day ->
                            DayCell(
                                day = day,
                                workouts = byDay[day].orEmpty(),
                                isToday = day == today,
                                selected = day == shown,
                                onClick = { selectedDay = day },
                            )
                        }
                    }

                    state.actionError?.let { ZidRunInlineError(it) }

                    byDay[shown].orEmpty().forEach { workout ->
                        WorkoutDetailCard(
                            workout = workout,
                            locale = locale,
                            onLogRun = onLogRun,
                            busy = state.pendingWorkoutId == workout.id,
                            // Today through the end of the plan, excluding the day it already sits
                            // on. Bounded by the server's own window so the picker cannot offer a
                            // date the server would refuse.
                            moveOptions = moveOptionsFor(workout, state.week.planEndsOn, today, zone),
                            onSkip = { reason -> viewModel.skip(workout.id, reason) },
                            onMove = { day ->
                                viewModel.move(workout.id, day.atTime(8, 0).atZone(zone).toInstant())
                            },
                        )
                    }

                    if (byDay[shown].isNullOrEmpty()) ZidRunCard {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                        ) {
                            Icon(Icons.Filled.SelfImprovement, contentDescription = null, tint = colors.textMuted)
                            Text(
                                stringResource(R.string.coach_rest_day),
                                style = MaterialTheme.typography.titleMedium,
                                color = colors.textStrong,
                            )
                            Text(
                                stringResource(R.string.coach_rest_body),
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.textMuted,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }

                    Spacer(Modifier.height(ZidRunDimens.spaceXxl))
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: LocalDate,
    workouts: List<CoachPlanWorkoutDto>,
    isToday: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val workout = workouts.firstOrNull()
    // A day is only "done" when nothing on it is still outstanding.
    val completed = workouts.isNotEmpty() && workouts.all { it.status == "COMPLETED" }
    val label = stringResource(
        when (day.dayOfWeek.value) {
            1 -> R.string.day_mon
            2 -> R.string.day_tue
            3 -> R.string.day_wed
            4 -> R.string.day_thu
            5 -> R.string.day_fri
            6 -> R.string.day_sat
            else -> R.string.day_sun
        }
    )
    // Two sessions can share a day once one has been moved, and the cell must not pretend otherwise.
    val totalKm = workouts.sumOf { it.targetDistanceKm ?: 0.0 }
    val target = when {
        workouts.isEmpty() -> stringResource(R.string.coach_rest_short)
        totalKm > 0 -> ZidRunFormat.distance(totalKm, java.util.Locale.getDefault())
        else -> stringResource(R.string.coach_session)
    }
    val countSuffix = if (workouts.size > 1) " ×${workouts.size}" else ""

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
        modifier = Modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .then(
                if (selected) Modifier.border(1.5.dp, colors.primary, RoundedCornerShape(ZidRunDimens.cornerLg))
                else Modifier
            )
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceSm, vertical = ZidRunDimens.spaceSm)
            .semantics(mergeDescendants = true) { contentDescription = "$label $target$countSuffix" },
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = if (isToday) colors.primary else colors.textMuted,
        )
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .then(
                    if (completed) Modifier.background(colors.primary)
                    else Modifier.border(1.5.dp, if (workout == null) colors.border else colors.accent, CircleShape)
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = when {
                    completed -> Icons.Filled.Check
                    workout == null -> Icons.Filled.SelfImprovement
                    else -> Icons.AutoMirrored.Filled.DirectionsRun
                },
                contentDescription = null,
                tint = when {
                    completed -> colors.onPrimary
                    workout == null -> colors.textMuted
                    else -> colors.accent
                },
                modifier = Modifier.size(20.dp),
            )
        }
        Text(target + countSuffix, style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
    }
}

/**
 * Days a workout may be moved to: today through the plan's last day, minus the one it is on.
 *
 * Derived from the server's own `planEndsOn` rather than a fixed "next 7 days", because
 * `rescheduleWorkout` refuses anything past the plan window — a picker that can produce a rejected
 * date is a trap dressed up as a choice.
 */
private fun moveOptionsFor(
    workout: CoachPlanWorkoutDto,
    planEndsOn: String?,
    today: LocalDate,
    zone: ZoneId,
): List<LocalDate> {
    val last = planEndsOn?.let { runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull() }
        ?: today.plusDays(6)
    val on = runCatching { Instant.parse(workout.scheduledFor).atZone(zone).toLocalDate() }.getOrNull()
    return generateSequence(today) { it.plusDays(1) }
        .takeWhile { !it.isAfter(last) }
        .filter { it != on }
        .take(MAX_MOVE_OPTIONS)
        .toList()
}

/** Long enough to read, short enough not to sit there as if it were part of the plan. */
private const val CONFIRMATION_MS = 4_000L

private const val MAX_MOVE_OPTIONS = 6

/** Reasons the server accepts, in the order the website offers them. */
private val SKIP_REASONS =
    listOf("SCHEDULE", "FATIGUE", "PAIN_OR_SYMPTOMS", "WEATHER", "ILLNESS", "TRAVEL", "MOTIVATION", "OTHER")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WorkoutDetailCard(
    workout: CoachPlanWorkoutDto,
    locale: java.util.Locale,
    onLogRun: (String?) -> Unit,
    busy: Boolean,
    moveOptions: List<LocalDate>,
    onSkip: (String?) -> Unit,
    onMove: (LocalDate) -> Unit,
) {
    val colors = ZidRunTheme.colors
    var expander by remember(workout.id) { mutableStateOf<String?>(null) }

    ZidRunCard {
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
            Text(
                text = ZidRunFormat.dateCompact(workout.scheduledFor, locale),
                style = MaterialTheme.typography.bodySmall,
                color = colors.primary,
            )
            Text(workout.title, style = MaterialTheme.typography.displaySmall, color = colors.textStrong)
            Text(
                text = listOfNotNull(
                    workout.targetDistanceKm?.let { ZidRunFormat.kilometres(it, locale) },
                    workout.targetDurationMin?.let { stringResource(R.string.runs_step_minutes, it) },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )

            // A missed session says so in words, and says why. The wording is deliberately flat:
            // the design flow rules out shaming a workout the runner could not do.
            if (workout.status == "SKIPPED") {
                val reason = workout.skipReason?.let { skipReasonLabel(it) }
                Text(
                    text = listOfNotNull(stringResource(R.string.coach_workout_skipped), reason).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }

            if (workout.instructions.isNotBlank()) {
                ZidRunDivider()
                Text(
                    stringResource(R.string.coach_session),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.primary,
                )
                Text(workout.instructions, style = MaterialTheme.typography.bodyMedium, color = colors.text)
            }

            // Only offered for a session that has not been decided yet — a completed or already
            // skipped workout has nothing left to log, and offering it would invite a duplicate run.
            if (workout.status == "PLANNED") {
                ZidRunButton(
                    text = stringResource(R.string.coach_log_run),
                    onClick = { onLogRun(workout.id) },
                    enabled = !busy,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.coach_cant_today),
                        onClick = { expander = if (expander == "skip") null else "skip" },
                        enabled = !busy,
                        modifier = Modifier.weight(1f),
                    )
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.coach_move_workout),
                        onClick = { expander = if (expander == "move") null else "move" },
                        enabled = !busy && moveOptions.isNotEmpty(),
                        modifier = Modifier.weight(1f),
                    )
                }

                if (busy) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                    ) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = colors.primary)
                        Text(
                            stringResource(R.string.common_loading),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                }

                when (expander) {
                    "skip" -> Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        ZidRunDivider()
                        Text(
                            stringResource(R.string.coach_skip_title),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                        )
                        Text(
                            stringResource(R.string.coach_skip_encourage),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                        ) {
                            SKIP_REASONS.forEach { reason ->
                                ZidRunChoiceChip(
                                    label = skipReasonLabel(reason),
                                    selected = false,
                                    onClick = {
                                        expander = null
                                        onSkip(reason)
                                    },
                                )
                            }
                        }
                        // Saying why is genuinely optional; requiring it would make skipping feel
                        // like a confession.
                        ZidRunTextButton(
                            text = stringResource(R.string.coach_skip_no_reason),
                            onClick = {
                                expander = null
                                onSkip(null)
                            },
                        )
                    }

                    "move" -> Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        ZidRunDivider()
                        Text(
                            stringResource(R.string.coach_move_title),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                        )
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                        ) {
                            moveOptions.forEach { day ->
                                ZidRunChoiceChip(
                                    label = dayOptionLabel(day, locale),
                                    selected = false,
                                    onClick = {
                                        expander = null
                                        onMove(day)
                                    },
                                )
                            }
                        }
                    }

                    else -> Unit
                }
            }
        }
    }
}

@Composable
private fun skipReasonLabel(reason: String): String = stringResource(
    when (reason) {
        "SCHEDULE" -> R.string.coach_skip_schedule
        "FATIGUE" -> R.string.coach_skip_fatigue
        "PAIN_OR_SYMPTOMS" -> R.string.coach_skip_pain
        "WEATHER" -> R.string.coach_skip_weather
        "ILLNESS" -> R.string.coach_skip_illness
        "TRAVEL" -> R.string.coach_skip_travel
        "MOTIVATION" -> R.string.coach_skip_motivation
        else -> R.string.coach_skip_other
    }
)

/** "Mon 4 Aug" in the app's locale, so the picker reads as dates rather than as offsets. */
private fun dayOptionLabel(day: LocalDate, locale: java.util.Locale): String =
    day.format(java.time.format.DateTimeFormatter.ofPattern("EEE d MMM", locale))
