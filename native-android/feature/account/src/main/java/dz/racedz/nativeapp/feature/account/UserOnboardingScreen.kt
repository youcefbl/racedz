package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.network.ProfileRequest

/**
 * The profile onboarding shown once after registration.
 *
 * Collects exactly the fields a race registration requires — phone, birth date, gender, wilaya,
 * city — so that entering a race later is a matter of picking a distance rather than filling a form
 * under time pressure while a race sells out.
 *
 * Skippable on purpose. A hard gate on first launch is a good way to lose someone before they have
 * seen anything; the server enforces the same fields at registration time, so skipping delays the
 * ask rather than defeating it. Everything here is editable afterwards in Profile & preferences.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun UserOnboardingScreen(
    viewModel: AccountViewModel,
    onDone: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val saved = stringResource(R.string.profile_saved)

    var phone by rememberSaveable { mutableStateOf("") }
    var wilaya by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("") }
    var gender by rememberSaveable { mutableStateOf<String?>(null) }
    var birthDate by rememberSaveable { mutableStateOf("") }
    var prefilled by rememberSaveable { mutableStateOf(false) }

    // Google sign-in and the website may already have supplied some of this; prefill so the runner
    // is not retyping what the account already knows. A profile that is already complete forwards
    // straight through — every sign-in routes here, and only an incomplete one should stop.
    LaunchedEffect(state.user) {
        val user = state.user ?: return@LaunchedEffect
        if (user.profileComplete) {
            onDone()
            return@LaunchedEffect
        }
        if (prefilled) return@LaunchedEffect
        phone = user.phone.orEmpty()
        wilaya = user.wilaya.orEmpty()
        city = user.city.orEmpty()
        gender = user.gender
        birthDate = user.dateOfBirth.orEmpty()
        prefilled = true
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding()
            .imePadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onSkip)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            ZidRunDisplayTitle(text = stringResource(R.string.onboarding_title))
            Text(
                stringResource(R.string.onboarding_intro),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )

            ZidRunTextField(
                value = phone,
                onValueChange = { phone = it.take(24) },
                label = stringResource(R.string.registration_phone),
                keyboardType = KeyboardType.Phone,
                enabled = !state.saving,
            )
            ZidRunTextField(
                value = birthDate,
                onValueChange = { birthDate = it.take(10) },
                label = stringResource(R.string.onboarding_birth_date),
                supportingText = stringResource(R.string.onboarding_birth_hint),
                enabled = !state.saving,
            )

            Text(
                stringResource(R.string.onboarding_gender),
                style = MaterialTheme.typography.titleSmall,
                color = colors.textStrong,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                listOf("MALE" to R.string.coach_setup_male, "FEMALE" to R.string.coach_setup_female).forEach { (value, label) ->
                    ZidRunChoiceChip(
                        label = stringResource(label),
                        selected = gender == value,
                        onClick = { gender = value },
                    )
                }
            }

            ZidRunTextField(
                value = wilaya,
                onValueChange = { wilaya = it.take(60) },
                label = stringResource(R.string.registration_wilaya),
                enabled = !state.saving,
            )
            ZidRunTextField(
                value = city,
                onValueChange = { city = it.take(60) },
                label = stringResource(R.string.registration_city),
                enabled = !state.saving,
            )

            state.error?.let { ZidRunInlineError(it.message, offline = state.isOffline) }

            ZidRunButton(
                text = stringResource(R.string.onboarding_save),
                onClick = {
                    viewModel.saveProfile(
                        ProfileRequest(
                            phone = phone.trim(),
                            wilaya = wilaya.trim(),
                            city = city.trim(),
                            gender = gender,
                            dateOfBirth = birthDate.trim().takeIf { it.isNotEmpty() },
                        ),
                        saved,
                    )
                    onDone()
                },
                enabled = !state.saving,
                loading = state.saving,
            )

            ZidRunTextButton(text = stringResource(R.string.onboarding_skip), onClick = onSkip)

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}
