package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLabel
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.ProfileRequest

/** Shared chrome for the Account sub-screens: back button, title, and the error/toast banners. */
@Composable
private fun SettingsScaffold(
    title: String,
    onBack: () -> Unit,
    error: String?,
    errorIsOffline: Boolean = false,
    toast: String?,
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .statusBarsPadding()
            // Insets before the scroller, so the viewport ends at the keyboard and a focused field
            // can actually be scrolled above it. See RegistrationScreen for the failure this order
            // prevents.
            .imePadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
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
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                color = colors.textStrong,
                modifier = Modifier.semantics { heading() },
            )
        }

        Column(
            modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            error?.let { ZidRunInlineError(it, offline = errorIsOffline) }
            toast?.let {
                LaunchedEffect(it) { onDismiss() }
                Text(it, style = MaterialTheme.typography.bodyMedium, color = colors.primary)
            }
            content()
            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

/** Profile fields plus the appearance controls (theme and language). */
@Composable
fun ProfilePreferencesScreen(viewModel: AccountViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val savedMessage = stringResource(R.string.profile_saved)
    val user = state.user

    var firstName by remember(user?.id) { mutableStateOf(user?.firstName.orEmpty()) }
    var lastName by remember(user?.id) { mutableStateOf(user?.lastName.orEmpty()) }
    var phone by remember(user?.id) { mutableStateOf(user?.phone.orEmpty()) }
    var wilaya by remember(user?.id) { mutableStateOf(user?.wilaya.orEmpty()) }
    var city by remember(user?.id) { mutableStateOf(user?.city.orEmpty()) }

    SettingsScaffold(
        title = stringResource(R.string.profile_title),
        onBack = onBack,
        error = state.error?.message,
        errorIsOffline = state.isOffline,
        toast = state.toast,
        onDismiss = viewModel::dismissToast,
    ) {
        if (user == null) {
            ZidRunLoading(label = stringResource(R.string.common_loading), modifier = Modifier.height(240.dp))
            return@SettingsScaffold
        }

        ZidRunSectionTitle(stringResource(R.string.profile_personal))
        ZidRunTextField(
            value = firstName,
            onValueChange = { firstName = it },
            label = stringResource(R.string.registration_first_name),
            errorText = state.error?.fieldErrors?.get("firstName"),
        )
        ZidRunTextField(
            value = lastName,
            onValueChange = { lastName = it },
            label = stringResource(R.string.registration_last_name),
            errorText = state.error?.fieldErrors?.get("lastName"),
        )
        ZidRunTextField(
            value = phone,
            onValueChange = { phone = it },
            label = stringResource(R.string.registration_phone),
            keyboardType = KeyboardType.Phone,
            errorText = state.error?.fieldErrors?.get("phone"),
        )
        ZidRunTextField(
            value = wilaya,
            onValueChange = { wilaya = it },
            label = stringResource(R.string.registration_wilaya),
        )
        ZidRunTextField(
            value = city,
            onValueChange = { city = it },
            label = stringResource(R.string.registration_city),
        )
        ZidRunButton(
            text = stringResource(R.string.common_save),
            loading = state.saving,
            onClick = {
                viewModel.saveProfile(
                    ProfileRequest(
                        // Names are required, so an empty box means "still editing" rather than
                        // "delete my name" — omit it and let the stored value stand.
                        firstName = firstName.trim().takeIf { it.isNotEmpty() },
                        lastName = lastName.trim().takeIf { it.isNotEmpty() },
                        // The optional fields send the empty string on purpose: the API reads "" as
                        // a clear. Sending null instead would be dropped by the serializer
                        // (explicitNulls = false) and look identical to "field not supplied", so
                        // emptying one of these boxes would silently do nothing.
                        phone = phone.trim(),
                        wilaya = wilaya.trim(),
                        city = city.trim(),
                    ),
                    savedMessage,
                )
            },
        )

        ZidRunDivider()

        ZidRunSectionTitle(stringResource(R.string.profile_appearance))
        ZidRunLabel(stringResource(R.string.profile_theme))
        Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            listOf(
                "light" to stringResource(R.string.profile_theme_light),
                "dark" to stringResource(R.string.profile_theme_dark),
                "race" to stringResource(R.string.profile_theme_race),
            ).forEach { (value, label) ->
                ZidRunChoiceChip(
                    label = label,
                    selected = user.preferences.theme == value,
                    onClick = { viewModel.setTheme(value, savedMessage) },
                )
            }
        }

        ZidRunLabel(stringResource(R.string.profile_language))
        Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
            listOf(
                "en" to stringResource(R.string.profile_language_en),
                "fr" to stringResource(R.string.profile_language_fr),
                "ar" to stringResource(R.string.profile_language_ar),
            ).forEach { (value, label) ->
                ZidRunChoiceChip(
                    label = label,
                    selected = user.preferences.language == value,
                    onClick = { viewModel.setLanguage(value, savedMessage) },
                )
            }
        }
    }
}

/** Privacy toggle, signed-in devices, sign-out-everywhere, and the deletion request. */
@Composable
fun PrivacyDataScreen(viewModel: AccountViewModel, onBack: () -> Unit, onSignedOut: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val savedMessage = stringResource(R.string.profile_saved)
    val deletionSent = stringResource(R.string.privacy_delete_sent)
    val context = LocalContext.current
    val exportShareTitle = stringResource(R.string.privacy_export_share)
    val exportFailed = stringResource(R.string.privacy_export_failed)

    LaunchedEffect(Unit) { viewModel.loadDevices() }

    SettingsScaffold(
        title = stringResource(R.string.privacy_title),
        onBack = onBack,
        error = state.error?.message,
        errorIsOffline = state.isOffline,
        toast = state.toast,
        onDismiss = viewModel::dismissToast,
    ) {
        val user = state.user ?: return@SettingsScaffold

        ZidRunCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.privacy_private_profile),
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textStrong,
                    )
                    Text(
                        stringResource(R.string.privacy_private_profile_body),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
                Switch(
                    checked = user.preferences.profilePrivate,
                    onCheckedChange = { viewModel.setProfilePrivate(it, savedMessage) },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = colors.onPrimary,
                        checkedTrackColor = colors.primary,
                    ),
                )
            }
        }

        ZidRunSectionTitle(stringResource(R.string.privacy_devices))
        ZidRunCard(contentPadding = PaddingValues(0.dp)) {
            Column {
                state.devices.forEach { device ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(ZidRunDimens.spaceLg),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.PhoneAndroid,
                            contentDescription = null,
                            tint = colors.textMuted,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(ZidRunDimens.spaceMd))
                        Column(Modifier.weight(1f)) {
                            Text(
                                // deviceName is a model string like "Google Pixel 8" — no serial,
                                // no IP, nothing that identifies the handset uniquely.
                                text = device.deviceName ?: device.platform,
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.textStrong,
                            )
                            Text(
                                text = stringResource(
                                    R.string.privacy_last_used,
                                    ZidRunFormat.dateTime(device.lastUsedAt, locale),
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                        }
                        if (device.current) {
                            ZidRunPill(stringResource(R.string.privacy_device_current))
                        }
                    }
                    ZidRunDivider()
                }

                Column(Modifier.padding(ZidRunDimens.spaceLg)) {
                    Text(
                        stringResource(R.string.privacy_sign_out_all_body),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                    Spacer(Modifier.height(ZidRunDimens.spaceSm))
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.privacy_sign_out_all),
                        onClick = { viewModel.signOutEverywhere(onSignedOut) },
                        enabled = !state.saving,
                    )
                }
            }
        }

        /*
         * "Download my data".
         *
         * The endpoint (GET /api/v1/me/export) has existed and been tested since the mobile
         * contract was written, and no client but the website ever called it — so on the phone the
         * runner had a delete request and no way to obtain a copy first, which is the wrong half of
         * the pair to ship alone. Above deletion deliberately: take your data, then decide.
         */
        ZidRunCard {
            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Download, contentDescription = null, tint = colors.primary)
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    Text(
                        stringResource(R.string.privacy_export),
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textStrong,
                    )
                }
                Text(
                    // Says what is NOT in it. The export deliberately excludes GPS routes — the
                    // most sensitive thing in the account — and a runner who assumed otherwise
                    // would think they had a complete copy when they did not.
                    stringResource(R.string.privacy_export_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
                ZidRunOutlinedButton(
                    text = stringResource(R.string.privacy_export),
                    onClick = {
                        viewModel.exportMyData(context.cacheDir) { file ->
                            shareExport(context, file, exportShareTitle, exportFailed)
                        }
                    },
                    enabled = !state.saving,
                )
            }
        }

        ZidRunCard {
            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.DeleteForever, contentDescription = null, tint = colors.danger)
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    Text(
                        stringResource(R.string.privacy_delete_account),
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textStrong,
                    )
                }
                Text(
                    // Worded as a request, not a deletion: the server files it as a reviewed
                    // support case and nothing is removed on tap.
                    stringResource(R.string.privacy_delete_account_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
                ZidRunOutlinedButton(
                    text = stringResource(R.string.privacy_delete_confirm),
                    onClick = { viewModel.requestAccountDeletion(deletionSent) },
                    enabled = !state.saving,
                )
            }
        }
    }
}

/**
 * Hands the written export to a share target.
 *
 * A content:// URI from the app's own FileProvider with a one-shot read grant — never a file://
 * path, which Android has refused between apps since N, and never a copy written to shared storage,
 * which would leave a permanent second copy of the runner's account outside the app's control.
 *
 * A chooser rather than a direct target, because "keep a copy" means different things to different
 * people: mail it to yourself, drop it in Drive, save it to Files. Falls back to a message rather
 * than silence if the device somehow has nothing that accepts JSON.
 */
private fun shareExport(
    context: android.content.Context,
    file: java.io.File,
    chooserTitle: String,
    failedMessage: String,
) {
    val uri = runCatching {
        androidx.core.content.FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file,
        )
    }.getOrNull()
    if (uri == null) {
        android.widget.Toast.makeText(context, failedMessage, android.widget.Toast.LENGTH_LONG).show()
        return
    }
    val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "application/json"
        putExtra(android.content.Intent.EXTRA_STREAM, uri)
        putExtra(android.content.Intent.EXTRA_TITLE, file.name)
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    runCatching { context.startActivity(android.content.Intent.createChooser(send, chooserTitle)) }
        .onFailure {
            android.widget.Toast.makeText(context, failedMessage, android.widget.Toast.LENGTH_LONG).show()
        }
}

/** The runner's own registrations with their server-authoritative status. */
@Composable
fun RegistrationsScreen(
    viewModel: AccountViewModel,
    onBack: () -> Unit,
    /** Opens the race this registration belongs to; there is no separate registration detail screen. */
    onOpenRace: (slug: String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    LaunchedEffect(Unit) { viewModel.loadRegistrations() }

    SettingsScaffold(
        title = stringResource(R.string.registrations_title),
        onBack = onBack,
        error = state.error?.message,
        errorIsOffline = state.isOffline,
        toast = null,
        onDismiss = viewModel::dismissToast,
    ) {
        if (state.registrations.isEmpty()) {
            Box(Modifier.fillMaxWidth().height(320.dp)) {
                ZidRunStatusView(
                    icon = Icons.Filled.EventAvailable,
                    title = stringResource(R.string.registrations_empty_title),
                    body = stringResource(R.string.registrations_empty_body),
                )
            }
            return@SettingsScaffold
        }

        state.registrations.forEach { registration ->
            ZidRunCard(onClick = { onOpenRace(registration.race.slug) }) {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                    Text(
                        registration.race.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = colors.textStrong,
                    )
                    Text(
                        "${ZidRunFormat.date(registration.race.startDate, locale)} · ${registration.category.name}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        ZidRunPill(
                            text = registrationStatusLabel(registration.status),
                            color = when (registration.status) {
                                "CONFIRMED" -> colors.success
                                "CANCELLED", "REJECTED" -> colors.danger
                                else -> colors.accent
                            },
                        )
                        ZidRunPill(
                            text = paymentStatusLabel(registration.paymentStatus),
                            color = if (registration.paymentStatus == "PAID") colors.success else colors.textMuted,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun registrationStatusLabel(status: String): String = when (status) {
    "CONFIRMED" -> stringResource(R.string.registration_status_confirmed)
    "CANCELLED" -> stringResource(R.string.registration_status_cancelled)
    "REJECTED" -> stringResource(R.string.registration_status_rejected)
    "WAITING_LIST" -> stringResource(R.string.registration_status_waiting)
    else -> stringResource(R.string.registration_status_pending)
}

@Composable
fun paymentStatusLabel(status: String): String = when (status) {
    "PAID" -> stringResource(R.string.payment_status_paid)
    "MANUAL_REVIEW" -> stringResource(R.string.payment_status_review)
    "NOT_REQUIRED" -> stringResource(R.string.payment_status_not_required)
    else -> stringResource(R.string.payment_status_pending)
}

