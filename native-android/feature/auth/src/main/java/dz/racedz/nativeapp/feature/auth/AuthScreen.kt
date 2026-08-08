package dz.racedz.nativeapp.feature.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MarkEmailUnread
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Pin
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunStepIndicator
import dz.racedz.nativeapp.core.design.ZidRunTextField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTestTags

/**
 * The auth surface: sign in, create account, MFA code, and the "check your email" confirmation.
 *
 * Layout follows 02-login.png / 03-create-account.png — a dark branded hero that always uses the
 * dark palette (the user has not signed in yet, so their saved theme is not known) above a rounded
 * sheet on the current theme's surface that holds the form. The whole screen scrolls and carries
 * `imePadding()`, so on a small phone the keyboard pushes content instead of covering the button.
 */
@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    onSignedIn: () -> Unit,
    onOpenBrowserSignIn: (String) -> Unit,
    modifier: Modifier = Modifier,
    signedOutNotice: String? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            // Insets before the scroller, so the viewport ends at the keyboard and a focused field
            // can actually be scrolled above it. See RegistrationScreen for the failure this order
            // prevents.
            .imePadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
    ) {
        AuthHero(
            step = state.step,
            onBack = {
                viewModel.goTo(if (state.step == AuthStep.Mfa) AuthStep.SignIn else AuthStep.SignIn)
            },
            showBack = state.step != AuthStep.SignIn,
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                .background(colors.surfaceSoft)
                .padding(horizontal = ZidRunDimens.spaceXl, vertical = ZidRunDimens.spaceXl),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            if (signedOutNotice != null && state.step == AuthStep.SignIn) {
                ZidRunInlineError(signedOutNotice)
            }
            state.errorMessage?.let { ZidRunInlineError(it, offline = state.errorIsOffline) }
            state.infoMessage?.let { message ->
                Text(message, style = MaterialTheme.typography.bodyMedium, color = colors.primary)
            }

            when (state.step) {
                AuthStep.SignIn -> SignInForm(state, viewModel, onSignedIn, onOpenBrowserSignIn)
                AuthStep.Mfa -> MfaForm(state, viewModel, onSignedIn)
                AuthStep.CreateAccount -> CreateAccountForm(state, viewModel)
                AuthStep.VerifyEmail -> VerifyEmailPanel(state, viewModel)
            }
        }
    }
}

@Composable
private fun AuthHero(step: AuthStep, showBack: Boolean, onBack: () -> Unit) {
    // Always the dark palette: this matches the mockups and stays legible before the user's own
    // theme preference has been loaded from their account.
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(ZidRunDarkColors.background)
            .statusBarsPadding()
            .padding(bottom = ZidRunDimens.spaceXxl),
    ) {
        if (showBack) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .padding(ZidRunDimens.spaceSm)
                    .sizeIn(minWidth = ZidRunDimens.minTouchTarget, minHeight = ZidRunDimens.minTouchTarget),
            ) {
                Icon(
                    // AutoMirrored so the arrow points the correct way in Arabic RTL.
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.common_back),
                    tint = ZidRunDarkColors.textStrong,
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 56.dp, start = ZidRunDimens.spaceXl, end = ZidRunDimens.spaceXl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Image(
                painter = painterResource(R.drawable.ic_zidrun_wordmark_dark),
                contentDescription = stringResource(R.string.cd_zidrun_wordmark),
                modifier = Modifier.height(44.dp),
            )
            Text(
                text = when (step) {
                    AuthStep.SignIn -> stringResource(R.string.auth_welcome_back)
                    AuthStep.Mfa -> stringResource(R.string.auth_mfa_title)
                    AuthStep.CreateAccount -> stringResource(R.string.auth_create_title)
                    AuthStep.VerifyEmail -> stringResource(R.string.auth_verify_title)
                },
                style = MaterialTheme.typography.displayMedium,
                color = ZidRunDarkColors.textStrong,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = when (step) {
                    AuthStep.SignIn -> stringResource(R.string.auth_welcome_subtitle)
                    AuthStep.Mfa -> stringResource(R.string.auth_mfa_body)
                    AuthStep.CreateAccount -> stringResource(R.string.auth_step_of, 1, 2)
                    AuthStep.VerifyEmail -> stringResource(R.string.auth_step_of, 2, 2)
                },
                style = MaterialTheme.typography.bodyLarge,
                color = ZidRunDarkColors.textMuted,
                textAlign = TextAlign.Center,
            )
            if (step == AuthStep.CreateAccount || step == AuthStep.VerifyEmail) {
                ZidRunStepIndicator(
                    currentStep = if (step == AuthStep.CreateAccount) 1 else 2,
                    totalSteps = 2,
                    modifier = Modifier.padding(horizontal = ZidRunDimens.spaceXxl),
                )
            }
        }
    }
}

/** Password reset is an email flow that already exists on the website; the app links to it. */
private const val FORGOT_PASSWORD_PATH = "/forgot-password"

@Composable
private fun ColumnScope.SignInForm(
    state: AuthUiState,
    viewModel: AuthViewModel,
    onSignedIn: () -> Unit,
    onOpenBrowserSignIn: (String) -> Unit,
) {
    val colors = ZidRunTheme.colors

    ZidRunTextField(
        value = state.email,
        onValueChange = viewModel::onEmailChange,
        label = stringResource(R.string.auth_email_label),
        modifier = Modifier.testTag(ZidRunTestTags.AuthEmail),
        leadingIcon = Icons.Filled.Email,
        keyboardType = KeyboardType.Email,
        errorText = state.fieldErrors["email"],
        enabled = !state.submitting,
    )
    ZidRunTextField(
        value = state.password,
        onValueChange = viewModel::onPasswordChange,
        label = stringResource(R.string.auth_password_label),
        modifier = Modifier.testTag(ZidRunTestTags.AuthPassword),
        leadingIcon = Icons.Filled.Lock,
        keyboardType = KeyboardType.Password,
        isPassword = true,
        errorText = state.fieldErrors["password"],
        enabled = !state.submitting,
        showPasswordLabel = stringResource(R.string.common_show_password),
        hidePasswordLabel = stringResource(R.string.common_hide_password),
    )

    Text(
        text = stringResource(R.string.auth_forgot_password),
        style = MaterialTheme.typography.labelLarge,
        color = colors.primary,
        textAlign = TextAlign.End,
        modifier = Modifier
            .align(Alignment.End)
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .clickable { onOpenBrowserSignIn(viewModel.webUrl(FORGOT_PASSWORD_PATH)) }
            .padding(vertical = ZidRunDimens.spaceMd),
    )

    ZidRunButton(
        text = stringResource(R.string.auth_sign_in),
        onClick = { viewModel.signIn(onSignedIn) },
        modifier = Modifier.testTag(ZidRunTestTags.AuthSignIn),
        enabled = state.canSubmitSignIn,
        loading = state.submitting,
        leadingIcon = Icons.AutoMirrored.Filled.DirectionsRun,
    )

    if (state.googleSignInAvailable) {
        OrDivider()
        ZidRunOutlinedButton(
            text = stringResource(R.string.auth_continue_with_google),
            onClick = { onOpenBrowserSignIn(viewModel.startBrowserSignIn()) },
            enabled = !state.submitting,
        )
    }

    Row(
        modifier = Modifier.fillMaxWidth().padding(top = ZidRunDimens.spaceSm),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(stringResource(R.string.auth_new_here), style = MaterialTheme.typography.bodyMedium, color = colors.text)
        Spacer(Modifier.width(ZidRunDimens.spaceXs))
        Text(
            text = stringResource(R.string.auth_create_account_link),
            style = MaterialTheme.typography.titleMedium,
            color = colors.primary,
            modifier = Modifier
                .heightIn(min = ZidRunDimens.minTouchTarget)
                .clickable { viewModel.goTo(AuthStep.CreateAccount) }
                .padding(vertical = ZidRunDimens.spaceMd),
        )
    }
}

@Composable
private fun CreateAccountForm(state: AuthUiState, viewModel: AuthViewModel) {
    val colors = ZidRunTheme.colors

    ZidRunTextField(
        value = state.fullName,
        onValueChange = viewModel::onFullNameChange,
        label = stringResource(R.string.auth_full_name_label),
        leadingIcon = Icons.Filled.Person,
        errorText = state.fieldErrors["fullName"],
        enabled = !state.submitting,
    )
    ZidRunTextField(
        value = state.email,
        onValueChange = viewModel::onEmailChange,
        label = stringResource(R.string.auth_email_label),
        leadingIcon = Icons.Filled.Email,
        keyboardType = KeyboardType.Email,
        errorText = state.fieldErrors["email"],
        enabled = !state.submitting,
    )
    ZidRunTextField(
        value = state.password,
        onValueChange = viewModel::onPasswordChange,
        label = stringResource(R.string.auth_password_label),
        leadingIcon = Icons.Filled.Lock,
        keyboardType = KeyboardType.Password,
        isPassword = true,
        errorText = state.fieldErrors["password"],
        supportingText = stringResource(R.string.auth_password_hint),
        enabled = !state.submitting,
        showPasswordLabel = stringResource(R.string.common_show_password),
        hidePasswordLabel = stringResource(R.string.common_hide_password),
    )

    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(
            checked = state.acceptedTerms,
            onCheckedChange = viewModel::onAcceptTermsChange,
            colors = CheckboxDefaults.colors(checkedColor = colors.primary, checkmarkColor = colors.onPrimary),
        )
        Text(
            text = stringResource(R.string.auth_accept_terms),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.text,
            modifier = Modifier.weight(1f),
        )
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .background(colors.primarySoft)
            .padding(ZidRunDimens.spaceLg),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.Person, contentDescription = null, tint = colors.primary, modifier = Modifier.size(28.dp))
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Column {
            Text(
                stringResource(R.string.auth_profile_next_title),
                style = MaterialTheme.typography.titleMedium,
                color = colors.textStrong,
            )
            Text(
                stringResource(R.string.auth_profile_next_body),
                style = MaterialTheme.typography.bodySmall,
                color = colors.text,
            )
        }
    }

    ZidRunButton(
        text = stringResource(R.string.auth_create_account),
        onClick = viewModel::createAccount,
        enabled = state.canSubmitCreate,
        loading = state.submitting,
        leadingIcon = Icons.AutoMirrored.Filled.DirectionsRun,
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(stringResource(R.string.auth_have_account), style = MaterialTheme.typography.bodyMedium, color = colors.text)
        Spacer(Modifier.width(ZidRunDimens.spaceXs))
        Text(
            text = stringResource(R.string.auth_sign_in),
            style = MaterialTheme.typography.titleMedium,
            color = colors.primary,
            modifier = Modifier
                .heightIn(min = ZidRunDimens.minTouchTarget)
                .clickable { viewModel.goTo(AuthStep.SignIn) }
                .padding(vertical = ZidRunDimens.spaceMd),
        )
    }

    Text(
        text = stringResource(R.string.auth_privacy_footnote),
        style = MaterialTheme.typography.bodySmall,
        color = colors.textMuted,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun MfaForm(state: AuthUiState, viewModel: AuthViewModel, onSignedIn: () -> Unit) {
    ZidRunTextField(
        value = state.totp,
        onValueChange = viewModel::onTotpChange,
        label = stringResource(R.string.auth_mfa_code_label),
        leadingIcon = Icons.Filled.Pin,
        keyboardType = KeyboardType.NumberPassword,
        enabled = !state.submitting,
    )
    ZidRunButton(
        text = stringResource(R.string.auth_mfa_verify),
        onClick = { viewModel.submitMfa(onSignedIn) },
        enabled = state.canSubmitMfa,
        loading = state.submitting,
    )
}

@Composable
private fun VerifyEmailPanel(state: AuthUiState, viewModel: AuthViewModel) {
    val colors = ZidRunTheme.colors
    val sentMessage = stringResource(R.string.auth_resend_sent)

    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg)) {
        Icon(
            Icons.Filled.MarkEmailUnread,
            contentDescription = null,
            tint = colors.primary,
            modifier = Modifier.size(48.dp),
        )
        Text(
            text = stringResource(R.string.auth_verify_body, state.email),
            style = MaterialTheme.typography.bodyLarge,
            color = colors.text,
            textAlign = TextAlign.Center,
        )
        ZidRunOutlinedButton(
            text = stringResource(R.string.auth_resend_email),
            onClick = { viewModel.resendVerification(sentMessage) },
            enabled = !state.submitting,
        )
        ZidRunButton(
            text = stringResource(R.string.auth_back_to_sign_in),
            onClick = { viewModel.goTo(AuthStep.SignIn) },
        )
    }
}

@Composable
private fun OrDivider() {
    val colors = ZidRunTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(colors.border))
        Text(
            text = stringResource(R.string.auth_or),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            modifier = Modifier.padding(horizontal = ZidRunDimens.spaceMd),
        )
        Box(Modifier.weight(1f).height(1.dp).background(colors.border))
    }
}
