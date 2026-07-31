package dz.racedz.nativeapp.feature.auth

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.AuthRepository
import dz.racedz.nativeapp.core.auth.PkceChallenge
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which auth screen is showing. Kept in the view model so it survives configuration changes. */
enum class AuthStep {
    SignIn,
    Mfa,
    CreateAccount,
    /** Account created; the user has to activate the emailed link before they can sign in. */
    VerifyEmail,
}

data class AuthUiState(
    val step: AuthStep = AuthStep.SignIn,
    val email: String = "",
    val password: String = "",
    val fullName: String = "",
    val totp: String = "",
    val acceptedTerms: Boolean = false,
    val submitting: Boolean = false,
    val browserSignInRunning: Boolean = false,
    /** Banner error. Never contains a server stack trace or a request id the user cannot use. */
    val errorMessage: String? = null,
    /** True when the banner is a client-synthesized offline failure, whose message is not localized. */
    val errorIsOffline: Boolean = false,
    val fieldErrors: Map<String, String> = emptyMap(),
    val infoMessage: String? = null,
    val googleSignInAvailable: Boolean = false,
) {
    val canSubmitSignIn: Boolean get() = email.isNotBlank() && password.isNotBlank() && !submitting
    val canSubmitCreate: Boolean
        get() = fullName.isNotBlank() && email.isNotBlank() && password.length >= 8 && acceptedTerms && !submitting
    val canSubmitMfa: Boolean get() = totp.trim().length >= 6 && !submitting
}

/**
 * Drives sign-in, account creation, MFA, and the system-browser (PKCE) flow.
 *
 * The password lives in this view model only while the form is on screen. It is never written to
 * saved instance state, so it does not survive process death and cannot end up in a system dump —
 * on return the user simply sees an empty field.
 */
class AuthViewModel(
    private val repository: AuthRepository,
    private val language: () -> String,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    /** Held between opening the Custom Tab and the deep link coming back. */
    private var pendingChallenge: PkceChallenge? = null

    init {
        // Offering "Continue with Google" when the deployment has no Google client configured
        // sends the user into a browser that can only fail, so ask the server first. Defaults to
        // hidden until the answer arrives — a missing button is better than a broken one.
        viewModelScope.launch {
            val enabled = (repository.appConfig() as? ApiResult.Success)?.value?.features?.googleSignIn ?: false
            _state.update { it.copy(googleSignInAvailable = enabled) }
        }
    }

    fun onEmailChange(value: String) = _state.update { it.copy(email = value, fieldErrors = it.fieldErrors - "email") }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, fieldErrors = it.fieldErrors - "password") }
    fun onFullNameChange(value: String) = _state.update { it.copy(fullName = value, fieldErrors = it.fieldErrors - "fullName") }
    fun onTotpChange(value: String) = _state.update { it.copy(totp = value.filter(Char::isLetterOrDigit).take(10)) }
    fun onAcceptTermsChange(value: Boolean) = _state.update { it.copy(acceptedTerms = value) }

    fun goTo(step: AuthStep) = _state.update {
        it.copy(step = step, errorMessage = null, fieldErrors = emptyMap(), infoMessage = null, totp = "")
    }

    fun dismissMessages() = _state.update { it.copy(errorMessage = null, infoMessage = null) }

    fun signIn(onSignedIn: () -> Unit) {
        val snapshot = _state.value
        if (!snapshot.canSubmitSignIn) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, errorMessage = null, fieldErrors = emptyMap()) }
            when (val result = repository.signIn(snapshot.email, snapshot.password)) {
                is ApiResult.Success -> {
                    // Clear the credentials from memory the moment they are no longer needed.
                    _state.update { AuthUiState(googleSignInAvailable = it.googleSignInAvailable) }
                    onSignedIn()
                }
                is ApiResult.Failure -> handleSignInFailure(result.error)
            }
        }
    }

    fun submitMfa(onSignedIn: () -> Unit) {
        val snapshot = _state.value
        if (!snapshot.canSubmitMfa) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, errorMessage = null) }
            // The password is re-sent because the server re-verifies the first factor on this call;
            // MFA is not a checkpoint that can be reached with a code alone.
            when (val result = repository.signIn(snapshot.email, snapshot.password, snapshot.totp)) {
                is ApiResult.Success -> {
                    _state.update { AuthUiState(googleSignInAvailable = it.googleSignInAvailable) }
                    onSignedIn()
                }
                is ApiResult.Failure -> handleSignInFailure(result.error)
            }
        }
    }

    private fun handleSignInFailure(error: ApiCallException) {
        _state.update { current ->
            when (error.code) {
                // The account has a second factor. Move to the code screen; the message is not an
                // error from the user's point of view.
                ApiErrorCode.MfaRequired -> current.copy(
                    submitting = false,
                    step = AuthStep.Mfa,
                    errorMessage = null,
                    totp = "",
                )
                ApiErrorCode.MfaInvalid -> current.copy(submitting = false, step = AuthStep.Mfa, errorMessage = error.message, totp = "")
                else -> current.copy(
                    submitting = false,
                    errorMessage = error.message,
                    errorIsOffline = error.code == ApiErrorCode.Offline,
                    fieldErrors = error.fieldErrors,
                )
            }
        }
    }

    fun createAccount() {
        val snapshot = _state.value
        if (!snapshot.canSubmitCreate) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, errorMessage = null, fieldErrors = emptyMap()) }
            val result = repository.createAccount(
                fullName = snapshot.fullName,
                email = snapshot.email,
                password = snapshot.password,
                acceptedTerms = snapshot.acceptedTerms,
                language = language(),
            )
            _state.update { current ->
                when (result) {
                    is ApiResult.Success -> current.copy(
                        submitting = false,
                        step = AuthStep.VerifyEmail,
                        password = "",
                        errorMessage = null,
                    )
                    is ApiResult.Failure -> current.copy(
                        submitting = false,
                        errorMessage = result.error.message,
                        errorIsOffline = result.error.code == ApiErrorCode.Offline,
                        fieldErrors = result.error.fieldErrors,
                    )
                }
            }
        }
    }

    fun resendVerification(sentMessage: String) {
        val email = _state.value.email
        if (email.isBlank()) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, errorMessage = null, infoMessage = null) }
            val result = repository.resendVerificationEmail(email, language())
            _state.update { current ->
                when (result) {
                    // The server answers identically whether or not the address exists, so the app
                    // must not phrase this as confirmation that an account was found.
                    is ApiResult.Success -> current.copy(submitting = false, infoMessage = sentMessage)
                    is ApiResult.Failure -> current.copy(
                        submitting = false,
                        errorMessage = result.error.message,
                        errorIsOffline = result.error.code == ApiErrorCode.Offline,
                    )
                }
            }
        }
    }

    // ---- system-browser sign-in -----------------------------------------------------------------

    /** Returns the URL to open in a Custom Tab, remembering the verifier for the callback. */
    /** Absolute URL for a website page the app links out to (currently only password reset). */
    fun webUrl(path: String): String = repository.buildWebUrl(path)

    fun startBrowserSignIn(): String {
        val challenge = PkceChallenge.generate()
        pendingChallenge = challenge
        _state.update { it.copy(browserSignInRunning = true, errorMessage = null) }
        return repository.buildAuthorizeUrl(challenge)
    }

    /** Handles the zidrun://auth/callback deep link. */
    fun completeBrowserSignIn(callback: Uri, onSignedIn: () -> Unit) {
        val challenge = pendingChallenge
        if (challenge == null) {
            // A callback with no in-flight challenge means the link did not come from a sign-in
            // this app started. Ignore it rather than attempting an exchange.
            _state.update { it.copy(browserSignInRunning = false) }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(submitting = true) }
            val result = repository.completeBrowserSignIn(callback, challenge)
            pendingChallenge = null
            when (result) {
                is ApiResult.Success -> {
                    _state.update { AuthUiState(googleSignInAvailable = it.googleSignInAvailable) }
                    onSignedIn()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(
                        submitting = false,
                        browserSignInRunning = false,
                        errorMessage = result.error.message,
                        errorIsOffline = result.error.code == ApiErrorCode.Offline,
                    )
                }
            }
        }
    }

    /** The Custom Tab was dismissed without a callback. */
    fun cancelBrowserSignIn() {
        pendingChallenge = null
        _state.update { it.copy(browserSignInRunning = false, submitting = false) }
    }
}
