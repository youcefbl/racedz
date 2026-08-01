package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.foundation.selection.toggleable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunStepIndicator
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.CreateCoachGoalRequest
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Goal types the server accepts, in the order the form offers them. `OTHER` is last and is the one
 * that requires a written goal — the schema refuses it without one.
 */
private val GOAL_TYPES =
    listOf("GENERAL_FITNESS", "FIVE_K", "TEN_K", "HALF_MARATHON", "MARATHON", "TRAIL", "OTHER")

private val EXPERIENCE = listOf("BEGINNER", "INTERMEDIATE", "ADVANCED")

/** Weekday numbers as the schema expects them: 0 = Sunday. */
private val WEEKDAYS = listOf(0, 1, 2, 3, 4, 5, 6)

/** Exactly the server's CHRONIC_CONDITIONS enum. "NONE" clears the rest server-side. */
private val CONDITIONS =
    listOf("NONE", "ASTHMA", "DIABETES", "HYPERTENSION", "HEART_CONDITION", "THYROID", "ANEMIA", "OTHER")

private const val TOTAL_STEPS = 5

/** The schema's floor. Fewer than two days is not a training week the planner can build. */
private const val MIN_TRAINING_DAYS = 2

/**
 * Coach goal setup (02-coach-goal-setup-v2.png): the approved five steps — Goal, Background,
 * Availability, Health & safety, Review.
 *
 * Every field maps to `createCoachGoalSchema`; the goal is created by the same server call the
 * website makes, so validation, the sex/birth-date write-back, and plan generation are identical.
 *
 * Two rules govern what is sent. Optional fields are sent **only when the runner typed something** —
 * a fabricated resting heart rate or longest run would reach the planner indistinguishable from a
 * measured one. And health fields are sent only behind the explicit consent on the review step,
 * which is also where the website puts it.
 *
 * Answers live in `rememberSaveable`, so going Back, rotating, or being sent away by the system does
 * not empty the form — the only reason to lose them is a deliberate Cancel.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CoachOnboardingScreen(
    viewModel: CoachOnboardingViewModel,
    onBack: () -> Unit,
    onCreated: () -> Unit,
    modifier: Modifier = Modifier,
    /** True when the runner came from "Edit goal" rather than from first-time setup. */
    editing: Boolean = false,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val appLocale = currentLocale()

    var step by rememberSaveable { mutableStateOf(1) }

    // Step 1 — goal.
    var goalType by rememberSaveable { mutableStateOf("TEN_K") }
    var customGoal by rememberSaveable { mutableStateOf("") }
    var weeks by rememberSaveable { mutableStateOf("8") }
    var targetDistanceKm by rememberSaveable { mutableStateOf("") }
    var targetTime by rememberSaveable { mutableStateOf("") }

    // Step 2 — background.
    var experience by rememberSaveable { mutableStateOf("BEGINNER") }
    var weeklyKm by rememberSaveable { mutableStateOf("") }
    var yearsRunning by rememberSaveable { mutableStateOf("") }
    var peakWeeklyKm by rememberSaveable { mutableStateOf("") }
    var longestRecentKm by rememberSaveable { mutableStateOf("") }
    var recentResult by rememberSaveable { mutableStateOf("") }
    var restingHeartRate by rememberSaveable { mutableStateOf("") }
    var weightKg by rememberSaveable { mutableStateOf("") }
    var heightCm by rememberSaveable { mutableStateOf("") }
    var sex by rememberSaveable { mutableStateOf<String?>(null) }
    var birthYear by rememberSaveable { mutableStateOf("") }

    // Step 3 — availability.
    var days by rememberSaveable { mutableStateOf(setOf(1, 3, 5)) }
    var longRunDay by rememberSaveable { mutableStateOf<Int?>(null) }
    var constraints by rememberSaveable { mutableStateOf("") }

    // Step 4 — health and safety.
    var injuryNotes by rememberSaveable { mutableStateOf("") }
    var injuryHistory by rememberSaveable { mutableStateOf("") }
    var conditions by rememberSaveable { mutableStateOf(emptySet<String>()) }
    var healthNotes by rememberSaveable { mutableStateOf("") }

    // Step 5 — review.
    var consent by rememberSaveable { mutableStateOf(false) }
    var coachLocale by rememberSaveable { mutableStateOf(appLocale.language.take(2).let { if (it in COACH_LOCALES) it else "en" }) }

    /*
     * Prefill, exactly once, when the goal arrives.
     *
     * Keyed on the goal id so it does not fight the runner's typing on every recomposition, and
     * guarded so a slow response cannot overwrite an answer they have already changed.
     */
    var prefilled by rememberSaveable { mutableStateOf(false) }
    val existing = state.gaps.goal
    LaunchedEffect(existing?.id) {
        if (!editing || existing == null || prefilled) return@LaunchedEffect
        goalType = existing.goalType
        customGoal = existing.customGoal.orEmpty()
        weeks = weeksUntil(existing.targetDate)
        targetDistanceKm = existing.targetDistanceKm?.let { trimNumber(it) }.orEmpty()
        targetTime = existing.targetTimeSeconds?.let(::formatTargetTime).orEmpty()
        experience = existing.experienceLevel
        weeklyKm = trimNumber(existing.currentWeeklyDistanceKm)
        yearsRunning = existing.yearsRunning?.toString().orEmpty()
        peakWeeklyKm = existing.peakWeeklyDistanceKm?.let { trimNumber(it) }.orEmpty()
        longestRecentKm = existing.longestRecentRunKm?.let { trimNumber(it) }.orEmpty()
        recentResult = existing.recentRaceResult.orEmpty()
        restingHeartRate = existing.restingHeartRate?.toString().orEmpty()
        weightKg = existing.weightKg?.let { trimNumber(it) }.orEmpty()
        heightCm = existing.heightCm?.toString().orEmpty()
        days = existing.availableTrainingDays.toSet().ifEmpty { days }
        longRunDay = existing.preferredLongRunDay
        constraints = existing.constraints.orEmpty()
        injuryNotes = existing.injuryNotes.orEmpty()
        injuryHistory = existing.injuryHistory.orEmpty()
        conditions = existing.chronicConditions.toSet()
        healthNotes = existing.healthNotes.orEmpty()
        coachLocale = existing.preferredLocale
        // Editing does not re-ask for consent: it was given when the goal was created, and asking
        // again every time a date changes turns a meaningful agreement into a nuisance click.
        consent = true
        prefilled = true
    }

    val currentYear = LocalDate.now().year
    val birthYearValue = birthYear.toIntOrNull()
    val birthYearOk = birthYear.isEmpty() ||
        (birthYear.length == 4 && birthYearValue != null && birthYearValue in (currentYear - 100)..(currentYear - 10))

    // A long-run day the runner is not available on is refused by the server, so drop it silently
    // when they deselect that day rather than letting them submit into a rejection.
    if (longRunDay != null && longRunDay !in days) longRunDay = null

    val weeklyValue = weeklyKm.toDoubleOrNull()
    val weeksValue = weeks.toIntOrNull()

    val step1Ok = (weeksValue ?: 0) > 0 &&
        (goalType != "OTHER" || customGoal.trim().length >= 3) &&
        parseTargetTimeSeconds(targetTime) != INVALID_TIME
    val step2Ok = weeklyValue != null &&
        (!state.gaps.needsSex || sex != null) &&
        (!state.gaps.needsBirthDate || birthYear.length == 4) &&
        birthYearOk
    val step3Ok = days.size >= MIN_TRAINING_DAYS

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(
            title = stringResource(if (editing) R.string.coach_goal_edit_title else R.string.coach_setup_title),
            // Back walks the wizard backwards before it leaves it, which is what the chevron means
            // once there is a step 2 on screen.
            onBack = { if (step > 1) step -= 1 else onBack() },
        )

        if (state.loading) {
            ZidRunLoading(label = stringResource(R.string.common_loading))
            return@Column
        }

        val stepLabel = stringResource(R.string.coach_setup_step_of, step, TOTAL_STEPS)

        // Each step starts at its own beginning. Compose keeps one scroll position for the column,
        // so without this, tapping Continue two-thirds of the way down step 2 dropped the runner
        // two-thirds of the way down step 3 — past its title, its progress, and its first question.
        val scroll = rememberScrollState()
        LaunchedEffect(step) { scroll.scrollTo(0) }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            // The indicator itself is decorative (it clears its own semantics), so the progress is
            // also stated in words — a screen-reader user needs to know they are on step 3 of 5.
            Text(
                text = stepLabel,
                style = MaterialTheme.typography.labelMedium,
                color = colors.primary,
                modifier = Modifier.semantics { contentDescription = stepLabel },
            )
            ZidRunStepIndicator(currentStep = step, totalSteps = TOTAL_STEPS)

            Text(
                text = stringResource(stepTitleRes(step)),
                style = MaterialTheme.typography.titleLarge,
                color = colors.textStrong,
            )
            Text(
                text = stringResource(stepIntroRes(step)),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )

            when (step) {
                1 -> {
                    Section(stringResource(R.string.coach_setup_goal)) {
                        ChipRow {
                            GOAL_TYPES.forEach { type ->
                                ZidRunChoiceChip(
                                    label = goalTypeLabel(type),
                                    selected = goalType == type,
                                    onClick = { goalType = type },
                                )
                            }
                        }
                        if (goalType == "OTHER" || goalType == "GENERAL_FITNESS") {
                            ZidRunTextField(
                                value = customGoal,
                                onValueChange = { customGoal = it.take(300) },
                                label = stringResource(R.string.coach_setup_custom_goal),
                                supportingText = stringResource(R.string.coach_setup_custom_goal_hint),
                                // Only OTHER makes it mandatory; the server enforces the same rule.
                                errorText = if (goalType == "OTHER" && customGoal.isNotEmpty() && customGoal.trim().length < 3) {
                                    stringResource(R.string.coach_setup_custom_goal_required)
                                } else {
                                    null
                                },
                                singleLine = false,
                            )
                        }
                        ZidRunTextField(
                            value = weeks,
                            onValueChange = { weeks = it.filter(Char::isDigit).take(2) },
                            label = stringResource(R.string.coach_setup_weeks),
                            supportingText = targetDateFor(weeksValue)?.toString(),
                            keyboardType = KeyboardType.Number,
                        )
                        ZidRunTextField(
                            value = targetDistanceKm,
                            onValueChange = { targetDistanceKm = it.filter { c -> c.isDigit() || c == '.' }.take(5) },
                            label = stringResource(R.string.coach_setup_target_distance),
                            supportingText = stringResource(R.string.common_optional),
                            keyboardType = KeyboardType.Decimal,
                        )
                        ZidRunTextField(
                            value = targetTime,
                            onValueChange = { targetTime = it.filter { c -> c.isDigit() || c == ':' }.take(8) },
                            label = stringResource(R.string.coach_setup_target_time),
                            supportingText = stringResource(R.string.coach_setup_target_time_hint),
                            errorText = if (parseTargetTimeSeconds(targetTime) == INVALID_TIME) {
                                stringResource(R.string.coach_setup_target_time_error)
                            } else {
                                null
                            },
                        )
                    }
                }

                2 -> {
                    Section(stringResource(R.string.coach_setup_about_you)) {
                        ChipRow {
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
                            keyboardType = KeyboardType.Decimal,
                        )

                        // Only asked when the account still lacks them — user onboarding asks the
                        // same questions, and asking twice makes the app look inattentive.
                        if (state.gaps.needsSex) {
                            Text(
                                stringResource(R.string.onboarding_gender),
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.textStrong,
                            )
                            ChipRow {
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
                                supportingText = stringResource(
                                    R.string.coach_setup_birth_year_hint,
                                    currentYear - 100,
                                    currentYear - 10,
                                ),
                                errorText = if (birthYearOk) null else stringResource(R.string.coach_setup_birth_year_error),
                                keyboardType = KeyboardType.Number,
                            )
                        }
                    }

                    Section(stringResource(R.string.coach_setup_optional_details)) {
                        OptionalNumber(yearsRunning, { yearsRunning = it }, R.string.coach_setup_years_running, decimal = false)
                        OptionalNumber(peakWeeklyKm, { peakWeeklyKm = it }, R.string.coach_setup_peak_weekly)
                        OptionalNumber(longestRecentKm, { longestRecentKm = it }, R.string.coach_setup_longest_recent)
                        ZidRunTextField(
                            value = recentResult,
                            onValueChange = { recentResult = it.take(300) },
                            label = stringResource(R.string.coach_setup_recent_result),
                            supportingText = stringResource(R.string.coach_setup_recent_result_hint),
                        )
                        OptionalNumber(restingHeartRate, { restingHeartRate = it }, R.string.coach_setup_resting_hr, decimal = false)
                        OptionalNumber(weightKg, { weightKg = it }, R.string.coach_setup_weight, hint = R.string.coach_setup_weight_hint)
                        OptionalNumber(heightCm, { heightCm = it }, R.string.coach_setup_height, decimal = false, hint = R.string.coach_setup_height_hint)
                    }
                }

                3 -> {
                    Section(stringResource(R.string.coach_setup_days)) {
                        Text(
                            stringResource(R.string.coach_setup_days_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        // Seven chips do not fit one row on a phone; wrapping beats a row clipped
                        // at "Thu".
                        ChipRow {
                            WEEKDAYS.forEach { day ->
                                ZidRunChoiceChip(
                                    label = weekdayLabel(day),
                                    selected = days.contains(day),
                                    onClick = { days = if (days.contains(day)) days - day else days + day },
                                )
                            }
                        }
                        if (!step3Ok) {
                            Text(
                                stringResource(R.string.coach_setup_days_min, MIN_TRAINING_DAYS),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.danger,
                            )
                        }
                    }

                    Section(stringResource(R.string.coach_setup_long_run_day)) {
                        Text(
                            stringResource(R.string.common_optional),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        // Offered only among the days they train — the server refuses any other,
                        // and a picker that can produce a rejected value is a trap.
                        ChipRow {
                            days.sorted().forEach { day ->
                                ZidRunChoiceChip(
                                    label = weekdayLabel(day),
                                    selected = longRunDay == day,
                                    onClick = { longRunDay = if (longRunDay == day) null else day },
                                )
                            }
                        }
                    }

                    ZidRunTextField(
                        value = constraints,
                        onValueChange = { constraints = it.take(1000) },
                        label = stringResource(R.string.coach_setup_constraints),
                        supportingText = stringResource(R.string.coach_setup_constraints_hint),
                        singleLine = false,
                    )
                }

                4 -> {
                    ZidRunTextField(
                        value = injuryNotes,
                        onValueChange = { injuryNotes = it.take(1000) },
                        label = stringResource(R.string.coach_setup_injury_now),
                        supportingText = stringResource(R.string.common_optional),
                        singleLine = false,
                    )
                    ZidRunTextField(
                        value = injuryHistory,
                        onValueChange = { injuryHistory = it.take(1000) },
                        label = stringResource(R.string.coach_setup_injury_history),
                        supportingText = stringResource(R.string.coach_setup_injury_history_hint),
                        singleLine = false,
                    )

                    Section(stringResource(R.string.coach_setup_conditions)) {
                        Text(
                            stringResource(R.string.coach_setup_conditions_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        ChipRow {
                            CONDITIONS.forEach { condition ->
                                ZidRunChoiceChip(
                                    label = conditionLabel(condition),
                                    selected = conditions.contains(condition),
                                    onClick = {
                                        // "None" is an answer, not an item: picking it clears the
                                        // rest, and picking anything else clears it.
                                        conditions = when {
                                            condition == "NONE" -> setOf("NONE")
                                            conditions.contains(condition) -> conditions - condition
                                            else -> conditions - "NONE" + condition
                                        }
                                    },
                                )
                            }
                        }
                    }

                    ZidRunTextField(
                        value = healthNotes,
                        onValueChange = { healthNotes = it.take(1000) },
                        label = stringResource(R.string.coach_setup_health_notes),
                        supportingText = stringResource(R.string.common_optional),
                        singleLine = false,
                    )
                }

                else -> {
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                            ReviewRow(stringResource(R.string.coach_setup_goal), goalTypeLabel(goalType))
                            customGoal.trim().takeIf { it.isNotEmpty() && (goalType == "OTHER" || goalType == "GENERAL_FITNESS") }
                                ?.let { ReviewRow(stringResource(R.string.coach_setup_custom_goal), it) }
                            targetDateFor(weeksValue)?.let {
                                ReviewRow(stringResource(R.string.coach_setup_target_date), it.toString())
                            }
                            ReviewRow(stringResource(R.string.coach_setup_experience), experienceLabel(experience))
                            ReviewRow(
                                stringResource(R.string.coach_setup_weekly_km),
                                weeklyKm.ifBlank { "—" },
                            )
                            // `map` is inline so the composable label lookups are legal inside it;
                            // joinToString is not, hence the two steps.
                            val dayLabels = days.sorted().map { weekdayLabel(it) }
                            val conditionLabels = conditions.filterNot { it == "NONE" }.map { conditionLabel(it) }
                            val noneLabel = conditionLabel("NONE")
                            ReviewRow(stringResource(R.string.coach_setup_days), dayLabels.joinToString(", "))
                            longRunDay?.let {
                                ReviewRow(stringResource(R.string.coach_setup_long_run_day), weekdayLabel(it))
                            }
                            ReviewRow(
                                stringResource(R.string.coach_setup_conditions),
                                conditionLabels.joinToString(", ").ifEmpty { noneLabel },
                            )
                        }
                    }

                    Section(stringResource(R.string.coach_setup_language)) {
                        Text(
                            stringResource(R.string.coach_setup_language_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        ChipRow {
                            COACH_LOCALES.forEach { code ->
                                ZidRunChoiceChip(
                                    label = coachLocaleLabel(code),
                                    selected = coachLocale == code,
                                    onClick = { coachLocale = code },
                                )
                            }
                        }
                    }

                    ZidRunDivider()

                    // Nothing on step 4 leaves the device until this is ticked. The website asks the
                    // same way and for the same reason: health context is volunteered, not assumed.
                    val consentLabel = stringResource(R.string.coach_setup_consent)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            // The whole row toggles, not just the box: a checkbox glyph is a small
                            // target for a sentence-long label, and this is the control the entire
                            // health step is gated on.
                            .toggleable(
                                value = consent,
                                role = Role.Checkbox,
                                onValueChange = { consent = it },
                            )
                            .semantics(mergeDescendants = true) { contentDescription = consentLabel },
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
                    ) {
                        Checkbox(
                            checked = consent,
                            // Null: the row above owns the interaction, and a nested clickable would
                            // give TalkBack two separate checkboxes for one answer.
                            onCheckedChange = null,
                            colors = CheckboxDefaults.colors(checkedColor = colors.primary),
                        )
                        Text(
                            consentLabel,
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.text,
                            modifier = Modifier.padding(top = ZidRunDimens.spaceSm),
                        )
                    }
                    Text(
                        stringResource(R.string.coach_setup_not_medical),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
            }

            state.error?.let { ZidRunInlineError(it) }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
            ) {
                if (step > 1) {
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.common_back),
                        onClick = { step -= 1 },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (step < TOTAL_STEPS) {
                    ZidRunButton(
                        text = stringResource(R.string.common_continue),
                        onClick = { step += 1 },
                        enabled = when (step) {
                            1 -> step1Ok
                            2 -> step2Ok
                            3 -> step3Ok
                            else -> true
                        },
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    ZidRunButton(
                        text = stringResource(if (editing) R.string.common_save else R.string.coach_setup_submit),
                        onClick = {
                            viewModel.submit(
                                CreateCoachGoalRequest(
                                    goalType = goalType,
                                    targetDate = targetDateFor(weeksValue)!!
                                        .atStartOfDay(ZoneOffset.UTC).toInstant().toString(),
                                    experienceLevel = experience,
                                    currentWeeklyDistanceKm = weeklyValue ?: 0.0,
                                    availableTrainingDays = days.sorted(),
                                    customGoal = customGoal.trim().takeIf { it.isNotEmpty() },
                                    targetDistanceKm = targetDistanceKm.toDoubleOrNull(),
                                    targetTimeSeconds = parseTargetTimeSeconds(targetTime).takeIf { it > 0 },
                                    sex = sex,
                                    dateOfBirth = birthYear.takeIf { it.length == 4 }
                                        ?.let { "$it-01-01T00:00:00.000Z" },
                                    yearsRunning = yearsRunning.toIntOrNull(),
                                    peakWeeklyDistanceKm = peakWeeklyKm.toDoubleOrNull(),
                                    longestRecentRunKm = longestRecentKm.toDoubleOrNull(),
                                    recentRaceResult = recentResult.trim().takeIf { it.isNotEmpty() },
                                    restingHeartRate = restingHeartRate.toIntOrNull(),
                                    weightKg = weightKg.toDoubleOrNull(),
                                    heightCm = heightCm.toIntOrNull(),
                                    preferredLongRunDay = longRunDay,
                                    constraints = constraints.trim().takeIf { it.isNotEmpty() },
                                    injuryNotes = injuryNotes.trim().takeIf { it.isNotEmpty() },
                                    injuryHistory = injuryHistory.trim().takeIf { it.isNotEmpty() },
                                    chronicConditions = conditions.takeIf { it.isNotEmpty() }?.toList(),
                                    healthNotes = healthNotes.trim().takeIf { it.isNotEmpty() },
                                    preferredLocale = coachLocale,
                                ),
                                editing = editing,
                                onCreated = onCreated,
                            )
                        },
                        enabled = consent && step1Ok && step2Ok && step3Ok && !state.submitting,
                        loading = state.submitting,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

private val COACH_LOCALES = listOf("en", "fr", "ar")

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = ZidRunTheme.colors.textStrong)
        content()
    }
}

/** Wrapping chip row. The vertical spacing matters: without it a wrapped second row sits flush. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipRow(content: @Composable () -> Unit) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        content()
    }
}

@Composable
private fun OptionalNumber(
    value: String,
    onValueChange: (String) -> Unit,
    labelRes: Int,
    decimal: Boolean = true,
    hint: Int? = null,
) {
    ZidRunTextField(
        value = value,
        onValueChange = { raw ->
            onValueChange(raw.filter { c -> c.isDigit() || (decimal && c == '.') }.take(6))
        },
        label = stringResource(labelRes),
        supportingText = stringResource(hint ?: R.string.common_optional),
        keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number,
    )
}

@Composable
private fun ReviewRow(label: String, value: String) {
    val colors = ZidRunTheme.colors
    Column {
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = colors.textMuted)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = colors.textStrong)
    }
}

private fun stepTitleRes(step: Int) = when (step) {
    1 -> R.string.coach_setup_step1_title
    2 -> R.string.coach_setup_step2_title
    3 -> R.string.coach_setup_step3_title
    4 -> R.string.coach_setup_step4_title
    else -> R.string.coach_setup_step5_title
}

private fun stepIntroRes(step: Int) = when (step) {
    1 -> R.string.coach_setup_step1_intro
    2 -> R.string.coach_setup_step2_intro
    3 -> R.string.coach_setup_step3_intro
    4 -> R.string.coach_setup_step4_intro
    else -> R.string.coach_setup_step5_intro
}

/** The date the goal is aimed at. Null when the week count is not usable yet. */
private fun targetDateFor(weeks: Int?): LocalDate? =
    weeks?.takeIf { it > 0 }?.let { LocalDate.now().plusWeeks(it.toLong()) }

private const val INVALID_TIME = -1

/**
 * "HH:MM:SS", "MM:SS", or empty, in seconds.
 *
 * Returns [INVALID_TIME] for anything else so the field can say so rather than silently sending a
 * goal time the runner did not mean.
 */
internal fun parseTargetTimeSeconds(raw: String): Int {
    val text = raw.trim()
    if (text.isEmpty()) return 0
    val parts = text.split(":")
    if (parts.size !in 2..3 || parts.any { it.isEmpty() || it.length > 2 }) return INVALID_TIME
    val numbers = parts.map { it.toIntOrNull() ?: return INVALID_TIME }
    if (numbers.drop(1).any { it > 59 }) return INVALID_TIME
    val seconds = if (numbers.size == 3) {
        numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    } else {
        numbers[0] * 60 + numbers[1]
    }
    // The server's ceiling; a bigger number is a typo, not a goal.
    return if (seconds in 1..172_800) seconds else INVALID_TIME
}

@Composable
private fun experienceLabel(level: String): String = when (level) {
    "INTERMEDIATE" -> stringResource(R.string.coach_exp_intermediate)
    "ADVANCED" -> stringResource(R.string.coach_exp_advanced)
    else -> stringResource(R.string.coach_exp_beginner)
}

@Composable
private fun conditionLabel(condition: String): String = stringResource(
    when (condition) {
        "ASTHMA" -> R.string.coach_condition_asthma
        "DIABETES" -> R.string.coach_condition_diabetes
        "HYPERTENSION" -> R.string.coach_condition_hypertension
        "HEART_CONDITION" -> R.string.coach_condition_heart
        "THYROID" -> R.string.coach_condition_thyroid
        "ANEMIA" -> R.string.coach_condition_anemia
        "OTHER" -> R.string.coach_condition_other
        else -> R.string.coach_condition_none
    }
)

@Composable
private fun coachLocaleLabel(code: String): String = stringResource(
    when (code) {
        "fr" -> R.string.profile_language_fr
        "ar" -> R.string.profile_language_ar
        else -> R.string.profile_language_en
    }
)

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


/** Whole weeks from today to [isoDate], floored at 1 — the form counts forward, the goal stores a date. */
private fun weeksUntil(isoDate: String): String {
    val target = runCatching { java.time.Instant.parse(isoDate).atZone(ZoneOffset.UTC).toLocalDate() }.getOrNull()
        ?: return "8"
    val weeks = java.time.temporal.ChronoUnit.WEEKS.between(LocalDate.now(), target)
    return weeks.coerceAtLeast(1L).toString()
}

/** "12.0" reads as a typo in a field the runner has to edit; "12" is what they entered. */
private fun trimNumber(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else value.toString()

private fun formatTargetTime(seconds: Int): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val secs = seconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, secs) else "%d:%02d".format(minutes, secs)
}
