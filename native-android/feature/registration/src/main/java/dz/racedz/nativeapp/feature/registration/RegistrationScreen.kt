package dz.racedz.nativeapp.feature.registration

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLabel
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale

/**
 * Race registration: pick a distance, confirm your details, then (when the distance costs money)
 * pay and upload proof.
 *
 * Capacity, duplicate protection, and the resulting status all come from the server — this screen
 * only reflects them. It never claims a registration is confirmed; a new one is PENDING until an
 * organizer says otherwise, and the copy says so.
 */
@Composable
fun RegistrationScreen(
    viewModel: RegistrationViewModel,
    onBack: () -> Unit,
    /** Invoked when the server says the profile is not complete enough to register. */
    onCompleteProfile: () -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // The server refused for a reason this form cannot fix. Send them to onboarding immediately.
    LaunchedEffect(state.needsOnboarding) {
        if (state.needsOnboarding) onCompleteProfile()
    }
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val context = LocalContext.current

    // The photo picker returns one image without the app ever holding a storage permission.
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) viewModel.uploadProof(context, uri)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .navigationBarsPadding()
            .imePadding(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(ZidRunDimens.spaceSm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.sizeIn(minWidth = ZidRunDimens.minTouchTarget, minHeight = ZidRunDimens.minTouchTarget),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.common_back),
                    tint = colors.textStrong,
                )
            }
            Spacer(Modifier.width(ZidRunDimens.spaceSm))
            Text(
                text = state.race?.title.orEmpty(),
                style = MaterialTheme.typography.headlineSmall,
                color = colors.textStrong,
                modifier = Modifier.semantics { heading() },
            )
        }

        when {
            state.loading -> ZidRunLoading(
                label = stringResource(R.string.common_loading),
                modifier = Modifier.height(280.dp),
            )

            state.race == null -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message.orEmpty(),
                retryLabel = stringResource(R.string.common_back),
                onRetry = onBack,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
                modifier = Modifier.height(320.dp),
            )

            else -> Column(
                modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
            ) {
                state.error?.let { ZidRunInlineError(it.message, offline = state.isOffline) }

                when (state.step) {
                    RegistrationStep.Distance -> DistanceStep(state, viewModel, locale)
                    RegistrationStep.Details -> DetailsStep(state, viewModel)
                    RegistrationStep.Payment -> PaymentStep(state, viewModel, locale) {
                        pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    }
                    RegistrationStep.Done -> DoneStep(proofUploaded = state.proofUploaded, onDone = onDone)
                }

                Spacer(Modifier.height(ZidRunDimens.spaceXxl))
            }
        }
    }
}

@Composable
private fun DistanceStep(state: RegistrationUiState, viewModel: RegistrationViewModel, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    ZidRunSectionTitle(stringResource(R.string.registration_step_distance))

    state.race?.categories?.forEach { category ->
        val selected = state.selectedCategoryId == category.id
        ZidRunCard(onClick = { viewModel.selectCategory(category.id) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(category.name, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
                    Text(
                        ZidRunFormat.distance(category.distanceKm, locale),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                    )
                }
                Text(
                    text = category.priceDzd?.takeIf { it > 0 }
                        ?.let { stringResource(R.string.payment_amount, ZidRunFormat.money(it, locale)) }
                        ?: stringResource(R.string.race_free),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.textStrong,
                )
                if (selected) {
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = colors.primary)
                }
            }
        }
    }

    ZidRunButton(
        text = stringResource(R.string.common_continue),
        onClick = { viewModel.goToStep(RegistrationStep.Details) },
        enabled = state.selectedCategoryId != null,
    )
}

@Composable
private fun DetailsStep(state: RegistrationUiState, viewModel: RegistrationViewModel) {
    val colors = ZidRunTheme.colors
    ZidRunSectionTitle(stringResource(R.string.registration_step_details))

    ZidRunTextField(state.firstName, viewModel::onFirstName, stringResource(R.string.registration_first_name), required = true)
    ZidRunTextField(state.lastName, viewModel::onLastName, stringResource(R.string.registration_last_name), required = true)
    ZidRunTextField(
        state.phone,
        viewModel::onPhone,
        stringResource(R.string.registration_phone),
        keyboardType = KeyboardType.Phone,
        required = true,
    )
    ZidRunTextField(
        state.dateOfBirth,
        viewModel::onDateOfBirth,
        stringResource(R.string.registration_dob),
        keyboardType = KeyboardType.Number,
        required = true,
    )

    ZidRunLabel(stringResource(R.string.registration_gender))
    Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        listOf(
            "MALE" to stringResource(R.string.registration_gender_male),
            "FEMALE" to stringResource(R.string.registration_gender_female),
            "OTHER" to stringResource(R.string.registration_gender_other),
        ).forEach { (value, label) ->
            ZidRunChoiceChip(
                label = label,
                selected = state.gender == value,
                onClick = { viewModel.onGender(value) },
            )
        }
    }

    ZidRunTextField(state.wilaya, viewModel::onWilaya, stringResource(R.string.registration_wilaya), required = true)
    ZidRunTextField(state.city, viewModel::onCity, stringResource(R.string.registration_city), required = true)
    ZidRunTextField(state.emergencyName, viewModel::onEmergencyName, stringResource(R.string.registration_emergency_name), required = true)
    ZidRunTextField(
        state.emergencyPhone,
        viewModel::onEmergencyPhone,
        stringResource(R.string.registration_emergency_phone),
        keyboardType = KeyboardType.Phone,
        required = true,
    )
    ZidRunTextField(state.clubName, viewModel::onClubName, stringResource(R.string.registration_club))

    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(
            checked = state.acceptedTerms,
            onCheckedChange = viewModel::onAcceptTerms,
            colors = CheckboxDefaults.colors(checkedColor = colors.primary, checkmarkColor = colors.onPrimary),
        )
        Text(
            stringResource(R.string.registration_accept),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.text,
            modifier = Modifier.weight(1f),
        )
    }

    if (!state.canSubmitDetails && !state.submitting) {
        Text(
            stringResource(R.string.registration_incomplete),
            style = MaterialTheme.typography.bodySmall,
            color = colors.textMuted,
        )
    }

    ZidRunButton(
        text = stringResource(R.string.registration_submit),
        onClick = viewModel::submit,
        enabled = state.canSubmitDetails,
        loading = state.submitting,
    )
}

@Composable
private fun PaymentStep(
    state: RegistrationUiState,
    viewModel: RegistrationViewModel,
    locale: java.util.Locale,
    onPickImage: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val registration = state.registration ?: return
    val instructions = registration.paymentInstructions
    val hasPaymentDetails = !instructions?.baridiMobNumber.isNullOrBlank() ||
        !instructions?.ccpAccount.isNullOrBlank()

    ZidRunSectionTitle(stringResource(R.string.payment_title))

    ZidRunCard {
        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            Text(
                stringResource(R.string.registration_success_title),
                style = MaterialTheme.typography.titleMedium,
                color = colors.textStrong,
            )
            Text(
                stringResource(R.string.registration_success_body),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.text,
            )
            registration.category.priceDzd?.takeIf { it > 0 }?.let {
                Text(
                    stringResource(R.string.payment_amount, ZidRunFormat.money(it, locale)),
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.primary,
                )
            }
            // Organizer bank details are only present because this registration proves the runner
            // entered the race — the race list and detail responses never carry them.
            instructions?.baridiMobNumber?.let {
                Text(stringResource(R.string.payment_baridimob_number, it), style = MaterialTheme.typography.bodyMedium, color = colors.text)
            }
            instructions?.ccpAccount?.let {
                Text(stringResource(R.string.payment_ccp_account, it), style = MaterialTheme.typography.bodyMedium, color = colors.text)
            }
            instructions?.ccpKey?.let {
                Text(stringResource(R.string.payment_ccp_key, it), style = MaterialTheme.typography.bodyMedium, color = colors.text)
            }
            instructions?.note?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
            }
            // Every field in PaymentInstructionsDto is nullable and a seeded paid race really can
            // return none of them. Saying so is the honest state; the old screen listed BaridiMob,
            // CCP and Bank transfer, preselected BaridiMob and invited a proof upload with no
            // account, recipient or reference anywhere on screen (DEV-R04). Web parity already
            // shows a "no details" line here.
            if (!hasPaymentDetails) {
                Text(
                    stringResource(R.string.payment_no_details),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textStrong,
                )
                // No organizer contact exists in the registration contract, so the recovery path
                // is the one that does: the entry is held and reachable from My registrations.
                Text(
                    stringResource(R.string.payment_no_details_next),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }
    }

    // Bank transfer is deliberately absent: the contract carries no bank destination, so offering
    // it would be inviting a payment to nowhere.
    val methods = buildList {
        if (!instructions?.baridiMobNumber.isNullOrBlank()) {
            add("BARIDIMOB" to stringResource(R.string.payment_method_baridimob))
        }
        if (!instructions?.ccpAccount.isNullOrBlank()) {
            add("CCP" to stringResource(R.string.payment_method_ccp))
        }
    }
    val selectedMethod = state.paymentMethod.takeIf { current ->
        methods.any { (value, _) -> value == current }
    } ?: methods.firstOrNull()?.first

    if (methods.isNotEmpty()) {
        ZidRunLabel(stringResource(R.string.payment_method))
        Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            methods.forEach { (value, label) ->
                ZidRunChoiceChip(
                    label = label,
                    selected = selectedMethod == value,
                    onClick = { viewModel.onPaymentMethod(value) },
                )
            }
        }
    }

    selectedMethod?.let { method ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Lock, contentDescription = null, tint = colors.textMuted, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(ZidRunDimens.spaceXs))
            Text(
                stringResource(R.string.payment_proof_private),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }

        ZidRunButton(
            text = stringResource(R.string.payment_choose_proof),
            onClick = {
                // Keep upload state consistent when CCP is the only available destination but the
                // view-model default is BaridiMob.
                viewModel.onPaymentMethod(method)
                onPickImage()
            },
            loading = state.uploading,
        )
    }

    ZidRunOutlinedButton(
        text = stringResource(R.string.common_close),
        onClick = { viewModel.goToStep(RegistrationStep.Done) },
        enabled = !state.uploading,
    )
}

@Composable
private fun DoneStep(proofUploaded: Boolean, onDone: () -> Unit) {
    val colors = ZidRunTheme.colors
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        modifier = Modifier.fillMaxWidth().padding(vertical = ZidRunDimens.spaceXxl),
    ) {
        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = colors.success, modifier = Modifier.size(56.dp))
        Text(
            stringResource(R.string.registration_success_title),
            style = MaterialTheme.typography.headlineSmall,
            color = colors.textStrong,
        )
        Text(
            // Once proof is in, telling the runner to upload proof is wrong and makes them think
            // the upload failed.
            stringResource(
                if (proofUploaded) R.string.payment_proof_uploaded else R.string.registration_success_body
            ),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            textAlign = TextAlign.Center,
        )
        ZidRunButton(text = stringResource(R.string.common_close), onClick = onDone)
    }
}
