package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import dz.racedz.nativeapp.core.design.ZidRunPill
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.Canvas
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunBrandBar
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.CoachWorkoutDto
import kotlin.math.min

/**
 * Coach overview (01-coach-overview-v2.png): the goal, today's session, this week's progress, what
 * is next, and the coach's latest note.
 *
 * Nothing here is generated on the phone. Every number and every word of advice comes from the
 * server, which is what keeps the app's coaching identical to the website's — and keeps AI output
 * behind the safety and governance rules that live there.
 */
@Composable
fun CoachScreen(
    viewModel: CoachViewModel,
    onOpenSubscribe: () -> Unit,
    /** Carries the planned session's id so the saved run links back to it. */
    onLogRun: (String?) -> Unit,
    onSetUpCoach: () -> Unit,
    /** Reopens the five steps prefilled, against the update endpoint. */
    onEditGoal: () -> Unit,
    onViewPlan: () -> Unit,
    onAskCoach: () -> Unit,
    onOpenSleep: () -> Unit,
    /** "What your coach remembers" — reachable even without an entitlement (privacy surface). */
    onOpenMemory: () -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    // The overview is a dashboard of things that change elsewhere — onboarding, the plan week, a
    // saved run. Re-reading it whenever the tab returns to the foreground is what keeps it from
    // showing a state the runner has already moved past.
    LifecycleResumeEffect(Unit) {
        viewModel.refresh()
        onPauseOrDispose { }
    }

    Box(modifier = modifier.fillMaxSize().background(colors.background).padding(contentPadding)) {
        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.overview == null -> ZidRunErrorView(
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

            else -> {
                val overview = state.overview!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = ZidRunDimens.spaceLg),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
                ) {
                    ZidRunBrandBar()
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ZidRunDisplayTitle(
                            text = stringResource(R.string.coach_title),
                            modifier = Modifier.weight(1f),
                        )
                        // Reserved slot beside the title (C2): the payment-adjacent status renders
                        // in the header, so it can never pop in below and shift the dashboard.
                        if (state.isTrial) {
                            TrialPill(trialEndsAt = overview.entitlement.trialEndsAt)
                        }
                    }

                    if (!state.hasCoaching) {
                        // Not subscribed is a normal state, not a failure — say what coaching does
                        // and offer the way in, rather than showing an empty dashboard.
                        ZidRunStatusView(
                            icon = Icons.Filled.Chat,
                            title = stringResource(R.string.coach_locked_title),
                            body = stringResource(R.string.coach_locked_body),
                            actionLabel = stringResource(R.string.coach_subscribe),
                            onAction = onOpenSubscribe,
                        )
                        // Memory stays reachable without a subscription: an expired-trial runner
                        // must still be able to inspect and erase what the coach stored.
                        ZidRunTextButton(
                            text = stringResource(R.string.coach_memory_title),
                            onClick = onOpenMemory,
                        )
                        Spacer(Modifier.height(ZidRunDimens.spaceXxl))
                        return@Column
                    }

                    val goal = overview.goal
                    if (goal == null) {
                        // Subscribed but no goal: coaching genuinely cannot work yet — there is no
                        // plan to show and nothing for the coach to reason about. Onboarding is the
                        // only useful thing on this screen, so it is the only thing offered.
                        ZidRunStatusView(
                            icon = Icons.Filled.TrackChanges,
                            title = stringResource(R.string.coach_setup_title),
                            body = stringResource(R.string.coach_setup_intro),
                            actionLabel = stringResource(R.string.coach_setup_submit),
                            onAction = onSetUpCoach,
                        )
                        Spacer(Modifier.height(ZidRunDimens.spaceXxl))
                        return@Column
                    }

                    run {
                        ZidRunCard {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier.size(40.dp).clip(CircleShape).background(colors.primary.copy(alpha = 0.14f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(Icons.Filled.TrackChanges, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
                                }
                                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        stringResource(R.string.coach_goal),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                    )
                                    Text(
                                        // A written goal wins; otherwise the goal type in words.
                                        // Falling through to `goal.goalType` printed the raw enum
                                        // ("TEN_K") on the runner's own dashboard.
                                        text = goal.customGoal?.takeIf { it.isNotBlank() }
                                            ?: goalTypeLabel(goal.goalType),
                                        style = MaterialTheme.typography.titleMedium,
                                        color = colors.textStrong,
                                    )
                                }
                                // The way back into every answer the coach reasons from, including
                                // the language it replies in.
                                ZidRunTextButton(
                                    text = stringResource(R.string.coach_goal_edit),
                                    onClick = onEditGoal,
                                    fillWidth = false,
                                )
                            }
                        }
                    }

                    overview.todayWorkout?.let { workout ->
                        TodayWorkoutCard(workout = workout, onLogRun = onLogRun, locale = locale)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                    ) {
                        overview.adherence?.let { adherence ->
                            ZidRunCard(modifier = Modifier.weight(1f).fillMaxHeight()) {
                                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                                    Text(
                                        stringResource(R.string.coach_this_week),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.primary,
                                    )
                                    // Stacked, not side by side. Sharing the row with a 64dp ring
                                    // left the label about 50dp wide on a 320dp screen, and
                                    // "Sessions completed" broke mid-word into "Sessi / ons /
                                    // compl / eted".
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                                    ) {
                                        SessionsRing(
                                            completed = adherence.completedSessions,
                                            planned = adherence.plannedSessions,
                                        )
                                        Text(
                                            stringResource(R.string.coach_sessions_done_plan),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = colors.textMuted,
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                }
                            }
                        }

                        overview.nextWorkout?.let { next ->
                            ZidRunCard(modifier = Modifier.weight(1f).fillMaxHeight()) {
                                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                                    Text(
                                        // Muted ink, not orange: accent-as-text fails AA on the
                                        // light surface (2.74:1). The calendar icon carries the
                                        // accent instead.
                                        stringResource(R.string.coach_next_workout),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.textMuted,
                                    )
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Filled.CalendarMonth,
                                            contentDescription = null,
                                            tint = colors.accent,
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Spacer(Modifier.width(ZidRunDimens.spaceXs))
                                        Text(
                                            ZidRunFormat.dateCompact(next.scheduledFor, locale),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = colors.textMuted,
                                        )
                                    }
                                    Text(
                                        next.title,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.textStrong,
                                    )
                                    Text(
                                        workoutTargetLabel(next, locale),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = colors.textMuted,
                                    )
                                }
                            }
                        }
                    }

                    overview.latestReview?.text?.let { review ->
                        ZidRunCard(onClick = onAskCoach) {
                            Row(verticalAlignment = Alignment.Top) {
                                Box(
                                    modifier = Modifier.size(40.dp).clip(CircleShape).background(colors.primary.copy(alpha = 0.14f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(Icons.Filled.Chat, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
                                }
                                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        stringResource(R.string.coach_latest_review),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = colors.primary,
                                    )
                                    Spacer(Modifier.height(ZidRunDimens.spaceXs))
                                    Text(
                                        // Trimmed: the full reply belongs in the conversation view,
                                        // not squeezed into a summary card.
                                        text = review.take(240),
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.text,
                                    )
                                }
                            }
                        }
                    }

                    if (overview.todayWorkout == null && overview.nextWorkout == null) {
                        // No goal means no plan can exist yet — send the runner to onboarding
                        // rather than leaving them looking at an empty dashboard.
                        ZidRunStatusView(
                            icon = Icons.AutoMirrored.Filled.DirectionsRun,
                            title = stringResource(R.string.coach_no_plan_title),
                            body = stringResource(R.string.coach_no_plan_body),
                            actionLabel = stringResource(R.string.coach_setup_submit),
                            onAction = onSetUpCoach,
                        )
                    }

                    // The mockup closes the overview with a way into the full week.
                    if (overview.todayWorkout != null || overview.nextWorkout != null) {
                        ZidRunOutlinedButton(
                            text = stringResource(R.string.coach_view_plan),
                            onClick = onViewPlan,
                        )
                    }

                    ZidRunButton(text = stringResource(R.string.coach_chat_title), onClick = onAskCoach)
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.coach_sleep_title),
                        onClick = onOpenSleep,
                    )
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.coach_memory_title),
                        onClick = onOpenMemory,
                    )

                    Spacer(Modifier.height(ZidRunDimens.spaceXxl))
                }
            }
        }
    }
}

@Composable
private fun TodayWorkoutCard(workout: CoachWorkoutDto, onLogRun: (String?) -> Unit, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    ZidRunCard {
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
            Text(
                stringResource(R.string.coach_today_workout),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textMuted,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(48.dp).clip(CircleShape).background(colors.primary.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.DirectionsRun,
                        contentDescription = null,
                        tint = colors.primary,
                        modifier = Modifier.size(24.dp),
                    )
                }
                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                Column(Modifier.weight(1f)) {
                    Text(workout.title, style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
                    Text(
                        workoutTargetLabel(workout, locale),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                    )
                }
            }

            ZidRunDivider()

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.coach_target_effort),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.primary,
                    modifier = Modifier.weight(1f),
                )
                ZidRunPill(text = workout.intensity, color = colors.primary)
            }

            if (workout.instructions.isNotBlank()) {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                    Text(
                        stringResource(R.string.coach_what_to_do),
                        style = MaterialTheme.typography.titleSmall,
                        color = colors.primary,
                    )
                    Text(workout.instructions, style = MaterialTheme.typography.bodyMedium, color = colors.text)
                }
            }

            ZidRunButton(text = stringResource(R.string.coach_log_run), onClick = { onLogRun(workout.id) })
        }
    }
}

/** The goal type in the runner's language. Kept in step with the onboarding chips. */
@Composable
internal fun goalTypeLabel(type: String): String = when (type) {
    "FIVE_K" -> "5K"
    "TEN_K" -> "10K"
    "HALF_MARATHON" -> stringResource(R.string.coach_goal_half)
    "MARATHON" -> stringResource(R.string.coach_goal_marathon)
    "TRAIL" -> stringResource(R.string.coach_goal_trail)
    "OTHER" -> stringResource(R.string.coach_goal_other)
    else -> stringResource(R.string.coach_goal_fitness)
}

/** "5 km · 32 min", omitting whichever the plan did not specify. */
@Composable
private fun workoutTargetLabel(workout: CoachWorkoutDto, locale: java.util.Locale): String {
    val parts = buildList {
        workout.targetDistanceKm?.let { add(ZidRunFormat.kilometres(it, locale)) }
        workout.targetDurationMin?.let { add(stringResource(R.string.runs_step_minutes, it)) }
    }
    return parts.joinToString(" · ")
}

/** Completed sessions out of planned, as a ring. */
@Composable
private fun SessionsRing(completed: Int, planned: Int) {
    val colors = ZidRunTheme.colors
    val fraction = if (planned > 0) min(1f, completed.toFloat() / planned) else 0f
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(64.dp).semantics {
        contentDescription = "$completed / $planned"
    }) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val strokePx = 6.dp.toPx()
            val inset = strokePx / 2
            val arcSize = Size(size.width - strokePx, size.height - strokePx)
            drawArc(
                color = colors.border,
                startAngle = -90f, sweepAngle = 360f, useCenter = false,
                topLeft = Offset(inset, inset), size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
            )
            if (fraction > 0f) {
                drawArc(
                    color = colors.primary,
                    startAngle = -90f, sweepAngle = 360f * fraction, useCenter = false,
                    topLeft = Offset(inset, inset), size = arcSize,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(completed.toString(), style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
            Text(
                stringResource(R.string.coach_of_n, planned),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
        }
    }
}

/**
 * The trial pill in the header's reserved slot: soft primary fill, live dot, and — when the
 * entitlement carries an end date — how many days remain. Primary ink on the soft fill passes
 * 4.5:1 in all three themes; the old accent-outline pill was orange text on the light surface.
 */
@Composable
private fun TrialPill(trialEndsAt: String?, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    val daysLeft = remember(trialEndsAt) {
        trialEndsAt?.let {
            runCatching {
                java.time.Duration.between(java.time.Instant.now(), java.time.Instant.parse(it))
                    .toDays().toInt()
            }.getOrNull()?.takeIf { days -> days > 0 }
        }
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
            .background(colors.primarySoft)
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(colors.primary))
        Text(
            text = if (daysLeft != null) {
                stringResource(R.string.coach_trial) + " · " +
                    pluralStringResource(R.plurals.coach_trial_days_left, daysLeft, daysLeft)
            } else {
                stringResource(R.string.coach_trial)
            },
            style = MaterialTheme.typography.labelMedium,
            color = colors.primary,
            maxLines = 1,
        )
    }
}
