package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Icon
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
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
    onLogRun: () -> Unit,
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
            )

            !state.week.hasPlan -> ZidRunStatusView(
                icon = Icons.AutoMirrored.Filled.DirectionsRun,
                title = stringResource(R.string.coach_no_plan_title),
                body = stringResource(R.string.coach_no_plan_body),
            )

            else -> {
                val byDay = remember(state.week) {
                    state.week.workouts.associateBy { workout ->
                        Instant.parse(workout.scheduledFor).atZone(zone).toLocalDate()
                    }
                }
                val weekDays = remember(state.week) {
                    val start = state.week.weekStart
                        ?.let { Instant.parse(it).atZone(zone).toLocalDate() }
                        ?: today.minusDays(today.dayOfWeek.value.toLong() - 1)
                    (0L..6L).map { start.plusDays(it) }
                }
                val shown = selectedDay ?: today.takeIf { byDay.containsKey(it) } ?: weekDays.first { byDay.containsKey(it) }
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

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = stringResource(R.string.coach_plan_sessions, done, total),
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

                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                    ) {
                        weekDays.forEach { day ->
                            DayCell(
                                day = day,
                                workout = byDay[day],
                                isToday = day == today,
                                selected = day == shown,
                                onClick = { selectedDay = day },
                            )
                        }
                    }

                    byDay[shown]?.let { workout ->
                        WorkoutDetailCard(workout = workout, locale = locale, onLogRun = onLogRun)
                    } ?: ZidRunCard {
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
    workout: CoachPlanWorkoutDto?,
    isToday: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val completed = workout?.status == "COMPLETED"
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
    val target = workout?.targetDistanceKm?.let { ZidRunFormat.distance(it, java.util.Locale.getDefault()) }
        ?: stringResource(R.string.coach_rest_short)

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
            .semantics(mergeDescendants = true) { contentDescription = "$label $target" },
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
        Text(target, style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
    }
}

@Composable
private fun WorkoutDetailCard(workout: CoachPlanWorkoutDto, locale: java.util.Locale, onLogRun: () -> Unit) {
    val colors = ZidRunTheme.colors
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

            if (workout.instructions.isNotBlank()) {
                ZidRunDivider()
                Text(
                    stringResource(R.string.coach_session),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.primary,
                )
                Text(workout.instructions, style = MaterialTheme.typography.bodyMedium, color = colors.text)
            }

            // Only offered for a session that has not been decided yet — a completed workout has
            // nothing left to log, and offering it would invite a duplicate run.
            if (workout.status == "PLANNED") {
                ZidRunButton(text = stringResource(R.string.coach_log_run), onClick = onLogRun)
            }
        }
    }
}
