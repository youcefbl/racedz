package dz.racedz.nativeapp.feature.runs.manual

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunEffortSlider
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * Hand-entering a run that was never GPS-recorded (NATRUN-01): a run done on a treadmill, or one a
 * runner is logging after the fact.
 *
 * The validation here mirrors the server's runCreateSchema exactly — distance 0.1–500 km, duration
 * 1 min–48 h, a start time no more than a few minutes in the future — so Save is disabled until the
 * values would pass, and the runner is told which field is wrong inline rather than pressing into a
 * server rejection.
 */
/**
 * Maps any Unicode decimal digits to ASCII and any decimal separator (ASCII or Arabic ٫ ، ٬) to a
 * dot, dropping everything else, so the same field parses whether typed on an Arabic or Latin
 * keyboard. Does not touch what is displayed — only what is parsed for validation/submit.
 */
private fun normalizeNumber(input: String): String = buildString {
    for (ch in input.trim()) {
        val digit = Character.digit(ch, 10)
        when {
            digit in 0..9 -> append(digit)
            ch == '.' || ch == ',' || ch == '٫' || ch == '،' || ch == '٬' -> append('.')
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManualRunScreen(
    viewModel: ManualRunViewModel,
    onSaved: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val saveState by viewModel.state.collectAsStateWithLifecycle()

    var title by rememberSaveable { mutableStateOf("") }
    var startedAtMillis by rememberSaveable { mutableStateOf(System.currentTimeMillis()) }
    var distanceText by rememberSaveable { mutableStateOf("") }
    var minutesText by rememberSaveable { mutableStateOf("") }
    var secondsText by rememberSaveable { mutableStateOf("") }
    var effort by rememberSaveable { mutableStateOf(5) }
    var notes by rememberSaveable { mutableStateOf("") }

    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // Parsed values. Distance accepts a comma decimal, since the French and Arabic keyboards a runner
    // is on here type "5,2" rather than "5.2".
    // Normalize Unicode digits and Arabic separators so ٥٫٢ / ٥,٢ / 5.2 all parse — an Arabic-keyboard
    // user must be able to type the required fields, not just an ASCII one.
    // Typed in the account's unit, kept as kilometres from here on (NATRUN-06.8): the server only
    // ever sees metric.
    val distanceKm = normalizeNumber(distanceText).toDoubleOrNull()?.let { dz.racedz.nativeapp.core.design.ZidRunUnits.toKm(it) }
    val minutes = normalizeNumber(minutesText).toIntOrNull() ?: 0
    val seconds = normalizeNumber(secondsText).toIntOrNull() ?: 0
    val durationSeconds = minutes * 60 + seconds

    // Server bounds, mirrored so Save never sends a value the server would refuse.
    val distanceValid = distanceKm != null && distanceKm in 0.1..500.0
    val durationValid = durationSeconds in 60..172_800
    // The server allows a start up to five minutes ahead (clock skew); anything past that is a typo.
    val futureOk = startedAtMillis <= System.currentTimeMillis() + 5 * 60 * 1000

    val distanceError = if (distanceText.isNotBlank() && !distanceValid) {
        stringResource(R.string.runs_manual_error_distance)
    } else {
        null
    }
    val durationError = if ((minutesText.isNotBlank() || secondsText.isNotBlank()) && !durationValid) {
        stringResource(R.string.runs_manual_error_duration)
    } else {
        null
    }

    val canSave = distanceValid && durationValid && futureOk && !saveState.saving

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.runs_manual_title), onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            ZidRunTextField(
                value = title,
                onValueChange = { title = it.take(120) },
                label = stringResource(R.string.runs_title_label),
                enabled = !saveState.saving,
            )

            // Date and time: default now, adjustable through the system pickers. A hand-logged run is
            // almost always for earlier the same day, so "now" then a nudge back is the quick path.
            ZidRunCard {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    Text(
                        text = stringResource(R.string.runs_manual_datetime_label),
                        style = MaterialTheme.typography.titleSmall,
                        color = colors.textStrong,
                    )
                    Text(
                        text = ZidRunFormat.dateTime(Instant.ofEpochMilli(startedAtMillis).toString(), locale),
                        style = MaterialTheme.typography.bodyLarge,
                        color = colors.textStrong,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        ZidRunOutlinedButton(
                            text = stringResource(R.string.runs_manual_change_date),
                            onClick = { showDatePicker = true },
                            enabled = !saveState.saving,
                            modifier = Modifier.weight(1f),
                        )
                        ZidRunOutlinedButton(
                            text = stringResource(R.string.runs_manual_change_time),
                            onClick = { showTimePicker = true },
                            enabled = !saveState.saving,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (!futureOk) {
                        Text(
                            text = stringResource(R.string.runs_manual_error_future),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.danger,
                        )
                    }
                }
            }

            ZidRunTextField(
                value = distanceText,
                onValueChange = { distanceText = it.take(10) },
                label = stringResource(R.string.runs_manual_distance_label, dz.racedz.nativeapp.core.design.distanceUnitLabel()),
                keyboardType = KeyboardType.Decimal,
                errorText = distanceError,
                required = true,
                enabled = !saveState.saving,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                ZidRunTextField(
                    value = minutesText,
                    onValueChange = { new -> minutesText = new.filter { it.isDigit() }.take(4) },
                    label = stringResource(R.string.runs_manual_minutes_label),
                    keyboardType = KeyboardType.Number,
                    required = true,
                    enabled = !saveState.saving,
                    modifier = Modifier.weight(1f),
                )
                ZidRunTextField(
                    value = secondsText,
                    onValueChange = { new -> secondsText = new.filter { it.isDigit() }.take(2) },
                    label = stringResource(R.string.runs_manual_seconds_label),
                    keyboardType = KeyboardType.Number,
                    enabled = !saveState.saving,
                    modifier = Modifier.weight(1f),
                )
            }
            durationError?.let {
                Text(text = it, style = MaterialTheme.typography.bodySmall, color = colors.danger)
            }

            ZidRunEffortSlider(
                value = effort,
                onValueChange = { effort = it },
                label = stringResource(R.string.runs_effort_label, ZidRunFormat.count(effort, currentLocale())),
                enabled = !saveState.saving,
            )

            ZidRunTextField(
                value = notes,
                onValueChange = { notes = it.take(2000) },
                label = stringResource(R.string.runs_notes_label),
                singleLine = false,
                enabled = !saveState.saving,
            )

            saveState.error?.let { ZidRunInlineError(it) }

            ZidRunButton(
                text = stringResource(R.string.runs_save),
                onClick = {
                    if (distanceKm != null) {
                        viewModel.save(
                            title = title.trim().takeIf { it.isNotEmpty() },
                            startedAtEpochMs = startedAtMillis,
                            distanceKm = distanceKm,
                            durationSeconds = durationSeconds,
                            perceivedEffort = effort,
                            notes = notes.trim().takeIf { it.isNotEmpty() },
                            onSaved = onSaved,
                        )
                    }
                },
                loading = saveState.saving,
                enabled = canSave,
            )

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }

    if (showDatePicker) {
        val zone = ZoneId.systemDefault()
        // The picker works in UTC start-of-day millis, so hand it the chosen day expressed that way,
        // and read the result back the same way before re-attaching the local time.
        val dateState = rememberDatePickerState(
            initialSelectedDateMillis = Instant.ofEpochMilli(startedAtMillis)
                .atZone(zone)
                .toLocalDate()
                .atStartOfDay(ZoneOffset.UTC)
                .toInstant()
                .toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    dateState.selectedDateMillis?.let { utcMillis ->
                        val pickedDate = Instant.ofEpochMilli(utcMillis).atZone(ZoneOffset.UTC).toLocalDate()
                        val keptTime = Instant.ofEpochMilli(startedAtMillis).atZone(zone).toLocalTime()
                        startedAtMillis = pickedDate.atTime(keptTime).atZone(zone).toInstant().toEpochMilli()
                    }
                    showDatePicker = false
                }) { Text(stringResource(R.string.common_save)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) {
                    Text(stringResource(R.string.common_cancel))
                }
            },
        ) {
            DatePicker(state = dateState)
        }
    }

    if (showTimePicker) {
        val zone = ZoneId.systemDefault()
        val current = Instant.ofEpochMilli(startedAtMillis).atZone(zone)
        val timeState = rememberTimePickerState(
            initialHour = current.hour,
            initialMinute = current.minute,
            is24Hour = true,
        )
        Dialog(onDismissRequest = { showTimePicker = false }) {
            Surface(
                shape = RoundedCornerShape(ZidRunDimens.cornerLg),
                color = colors.surface,
            ) {
                Column(
                    modifier = Modifier.padding(ZidRunDimens.spaceLg),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
                ) {
                    TimePicker(state = timeState)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        TextButton(onClick = { showTimePicker = false }) {
                            Text(stringResource(R.string.common_cancel))
                        }
                        Spacer(Modifier.width(ZidRunDimens.spaceSm))
                        TextButton(onClick = {
                            val date = Instant.ofEpochMilli(startedAtMillis).atZone(zone).toLocalDate()
                            startedAtMillis = date
                                .atTime(timeState.hour, timeState.minute)
                                .atZone(zone)
                                .toInstant()
                                .toEpochMilli()
                            showTimePicker = false
                        }) { Text(stringResource(R.string.common_save)) }
                    }
                }
            }
        }
    }
}
