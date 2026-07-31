package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.network.CreateCoachGoalRequest
import java.time.LocalDate
import java.time.ZoneOffset

/** Goal types the server accepts, in the order the form offers them. */
private val GOAL_TYPES = listOf("GENERAL_FITNESS", "FIVE_K", "TEN_K", "HALF_MARATHON", "MARATHON", "TRAIL")

private val EXPERIENCE = listOf("BEGINNER", "INTERMEDIATE", "ADVANCED")

/** Weekday numbers as the schema expects them: 0 = Sunday. */
private val WEEKDAYS = listOf(0, 1, 2, 3, 4, 5, 6)

/**
 * Coach onboarding (02-coach-goal-setup-v2.png): what the coach needs before it can build a plan.
 *
 * Only asks what createCoachGoalSchema actually requires — goal, date, experience, current weekly
 * volume, and which days the runner can train — plus sex and birth date when the account is missing
 * them. Everything else the website's fuller form collects (resting heart rate, injury history, peak
 * volume) is genuinely optional, and inventing values for it would feed the plan numbers the runner
 * never gave.
 *
 * The goal is created by the same server call the website makes, so plan generation and the profile
 * write-back behave identically.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CoachOnboardingScreen(
    viewModel: CoachOnboardingViewModel,
    onBack: () -> Unit,
    onCreated: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors

    var goalType by rememberSaveable { mutableStateOf("TEN_K") }
    var customGoal by rememberSaveable { mutableStateOf("") }
    var experience by rememberSaveable { mutableStateOf("BEGINNER") }
    var weeklyKm by rememberSaveable { mutableStateOf("") }
    var weeks by rememberSaveable { mutableStateOf("8") }
    var sex by rememberSaveable { mutableStateOf<String?>(null) }
    var birthYear by rememberSaveable { mutableStateOf("") }
    var days by rememberSaveable { mutableStateOf(setOf(1, 3, 5)) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.coach_setup_title), onBack = onBack)

        if (state.loading) {
            ZidRunLoading(label = stringResource(R.string.common_loading))
            return@Column
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                stringResource(R.string.coach_setup_intro),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )

            Section(stringResource(R.string.coach_setup_goal)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    GOAL_TYPES.forEach { type ->
                        ZidRunChoiceChip(
                            label = goalTypeLabel(type),
                            selected = goalType == type,
                            onClick = { goalType = type },
                        )
                    }
                }
                if (goalType == "GENERAL_FITNESS") {
                    ZidRunTextField(
                        value = customGoal,
                        onValueChange = { customGoal = it.take(300) },
                        label = stringResource(R.string.coach_setup_custom_goal),
                        supportingText = stringResource(R.string.coach_setup_custom_goal_hint),
                    )
                }
                ZidRunTextField(
                    value = weeks,
                    onValueChange = { weeks = it.filter(Char::isDigit).take(2) },
                    label = stringResource(R.string.coach_setup_weeks),
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                )
            }

            Section(stringResource(R.string.coach_setup_about_you)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    EXPERIENCE.forEach { level ->
                        ZidRunChoiceChip(
                            label = experienceLabel(level),
                            selected = experience == level,
                            onClick = { experience = level },
                        )
                    }
                }
                ZidRunTextField(
                    value = weeklyKm,
                    onValueChange = { weeklyKm = it.filter { c -> c.isDigit() || c == '.' }.take(5) },
                    label = stringResource(R.string.coach_setup_weekly_km),
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal,
                )

                // Only asked when the account does not already have them.
                if (state.gaps.needsSex) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        listOf("MALE", "FEMALE").forEach { value ->
                            ZidRunChoiceChip(
                                label = if (value == "MALE") {
                                    stringResource(R.string.coach_setup_male)
                                } else {
                                    stringResource(R.string.coach_setup_female)
                                },
                                selected = sex == value,
                                onClick = { sex = value },
                            )
                        }
                    }
                }
                if (state.gaps.needsBirthDate) {
                    ZidRunTextField(
                        value = birthYear,
                        onValueChange = { birthYear = it.filter(Char::isDigit).take(4) },
                        label = stringResource(R.string.coach_setup_birth_year),
                        keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                    )
                }
            }

            Section(stringResource(R.string.coach_setup_days)) {
                Text(
                    stringResource(R.string.coach_setup_days_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    WEEKDAYS.forEach { day ->
                        ZidRunChoiceChip(
                            label = weekdayLabel(day),
                            selected = days.contains(day),
                            onClick = {
                                days = if (days.contains(day)) days - day else days + day
                            },
                        )
                    }
                }
            }

            state.error?.let { ZidRunInlineError(it) }

            val weeklyValue = weeklyKm.toDoubleOrNull()
            val canSubmit = weeklyValue != null &&
                days.size >= 2 &&
                (weeks.toIntOrNull() ?: 0) > 0 &&
                (!state.gaps.needsSex || sex != null) &&
                (!state.gaps.needsBirthDate || birthYear.length == 4)

            ZidRunButton(
                text = stringResource(R.string.coach_setup_submit),
                onClick = {
                    val target = LocalDate.now().plusWeeks((weeks.toLongOrNull() ?: 8L))
                    viewModel.submit(
                        CreateCoachGoalRequest(
                            goalType = goalType,
                            targetDate = target.atStartOfDay(ZoneOffset.UTC).toInstant().toString(),
                            experienceLevel = experience,
                            currentWeeklyDistanceKm = weeklyValue ?: 0.0,
                            availableTrainingDays = days.sorted(),
                            customGoal = customGoal.trim().takeIf { it.isNotEmpty() },
                            sex = sex,
                            dateOfBirth = birthYear.takeIf { it.length == 4 }
                                ?.let { "$it-01-01T00:00:00.000Z" },
                        ),
                        onCreated = onCreated,
                    )
                },
                enabled = canSubmit && !state.submitting,
                loading = state.submitting,
            )

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = ZidRunTheme.colors.textStrong)
        content()
    }
}

@Composable
private fun goalTypeLabel(type: String): String = when (type) {
    "FIVE_K" -> "5K"
    "TEN_K" -> "10K"
    "HALF_MARATHON" -> stringResource(R.string.coach_goal_half)
    "MARATHON" -> stringResource(R.string.coach_goal_marathon)
    "TRAIL" -> stringResource(R.string.coach_goal_trail)
    else -> stringResource(R.string.coach_goal_fitness)
}

@Composable
private fun experienceLabel(level: String): String = when (level) {
    "INTERMEDIATE" -> stringResource(R.string.coach_exp_intermediate)
    "ADVANCED" -> stringResource(R.string.coach_exp_advanced)
    else -> stringResource(R.string.coach_exp_beginner)
}

/** 0 = Sunday, matching the schema's weekday numbering. */
@Composable
private fun weekdayLabel(day: Int): String = stringResource(
    when (day) {
        0 -> R.string.day_sun
        1 -> R.string.day_mon
        2 -> R.string.day_tue
        3 -> R.string.day_wed
        4 -> R.string.day_thu
        5 -> R.string.day_fri
        else -> R.string.day_sat
    }
)
