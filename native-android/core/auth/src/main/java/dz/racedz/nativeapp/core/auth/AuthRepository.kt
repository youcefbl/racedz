package dz.racedz.nativeapp.core.auth

import android.net.Uri
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiClient
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AppConfigDto
import dz.racedz.nativeapp.core.network.WebHandoffRequest
import dz.racedz.nativeapp.core.network.AuthSessionDto
import dz.racedz.nativeapp.core.network.LoginRequest
import dz.racedz.nativeapp.core.network.NetworkFactory
import dz.racedz.nativeapp.core.network.PkceTokenRequest
import dz.racedz.nativeapp.core.network.RegisterAccountResultDto
import dz.racedz.nativeapp.core.network.RegisterRequest
import dz.racedz.nativeapp.core.network.ResendVerificationRequest
import dz.racedz.nativeapp.core.network.ZidRunApi

/** Everything the auth screens need. Owns nothing about UI state. */
class AuthRepository(
    private val api: ZidRunApi,
    private val client: ApiClient,
    private val session: SessionManager,
) {

    /** Launch-time compatibility/feature config. Public, so it works before sign-in. */
    suspend fun appConfig(): ApiResult<AppConfigDto> = client.call { api.config() }

    suspend fun signIn(email: String, password: String, totp: String? = null): ApiResult<AuthSessionDto> {
        val result = client.call {
            api.login(
                LoginRequest(
                    email = email.trim(),
                    password = password,
                    totp = totp?.trim()?.takeIf { it.isNotEmpty() },
                    appVersion = session.appVersion,
                    deviceName = session.deviceName,
                )
            )
        }
        if (result is ApiResult.Success) session.adopt(result.value)
        return result
    }

    suspend fun createAccount(
        fullName: String,
        email: String,
        password: String,
        acceptedTerms: Boolean,
        language: String?,
    ): ApiResult<RegisterAccountResultDto> = client.call {
        api.register(
            RegisterRequest(
                fullName = fullName.trim(),
                email = email.trim(),
                password = password,
                acceptedTerms = acceptedTerms,
                language = language,
            )
        )
    }

    suspend fun resendVerificationEmail(email: String, language: String?): ApiResult<Unit> {
        val result = client.call { api.resendVerification(ResendVerificationRequest(email.trim(), language)) }
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }
    }

    // ---- system-browser sign-in (PKCE) ----------------------------------------------------------

    /**
     * Builds the URL to open in a Custom Tab. Keep the returned [PkceChallenge] until the redirect
     * comes back — the verifier in it is the only thing that can redeem the resulting code.
     */
    /**
     * Absolute URL for a page on the ZidRun website, e.g. the email-based password reset. Built from
     * the same configured base as the API so a debug build points at the developer's machine and a
     * production build at zidrun.com — never a hard-coded host.
     */
    /**
     * A web URL that lands SIGNED IN (NATPAR-002): mints a single-use handoff token and returns
     * the absolute /auth/handoff link that confirms and signs the browser in, then forwards to
     * [next]. When the mint fails (offline, expired session) the fallback is the LOGIN page with
     * the destination preserved — not the destination itself, because some targets are not pages
     * (a GPX API URL would render as raw 401 JSON in a signed-out browser).
     */
    suspend fun webHandoffUrl(next: String, locale: String? = null): String =
        when (val result = client.call { api.webHandoff(WebHandoffRequest(next = next, locale = locale)) }) {
            is ApiResult.Success -> buildWebUrl(result.value.path)
            // The fallback carries the language too, so a failed mint does not also switch the
            // runner into a different language on the login page.
            is ApiResult.Failure -> buildWebUrl("/login") + "?callbackUrl=" + Uri.encode(next) +
                (locale?.let { "&lang=" + Uri.encode(it) } ?: "")
        }

    fun buildWebUrl(path: String): String =
        Uri.parse(NetworkFactory.baseUrl).buildUpon()
            .appendEncodedPath(path.trimStart('/'))
            .build()
            .toString()

    fun buildAuthorizeUrl(challenge: PkceChallenge): String =
        Uri.parse(NetworkFactory.baseUrl).buildUpon()
            .appendEncodedPath("api/v1/auth/authorize")
            .appendQueryParameter("code_challenge", challenge.challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("state", challenge.state)
            .appendQueryParameter("redirect_uri", REDIRECT_URI)
            .build()
            .toString()

    /**
     * Completes the browser sign-in from the zidrun://auth/callback deep link.
     *
     * The `state` comparison happens before the code is redeemed: without it, any app or web page
     * able to fire that deep link could feed the app an authorization code from an account the user
     * did not choose, and the app would happily sign in as that account.
     */
    suspend fun completeBrowserSignIn(callback: Uri, challenge: PkceChallenge): ApiResult<AuthSessionDto> {
        val returnedState = callback.getQueryParameter("state")
        if (returnedState == null || returnedState != challenge.state) {
            return ApiResult.Failure(
                ApiCallException(ApiErrorCode.BadRequest, "This sign-in could not be verified. Please try again.")
            )
        }

        val code = callback.getQueryParameter("code")
        if (code.isNullOrBlank()) {
            return ApiResult.Failure(
                ApiCallException(ApiErrorCode.BadRequest, "Sign-in was cancelled or did not complete.")
            )
        }

        val result = client.call {
            api.exchangePkceCode(
                PkceTokenRequest(
                    code = code,
                    codeVerifier = challenge.verifier,
                    appVersion = session.appVersion,
                    deviceName = session.deviceName,
                )
            )
        }
        if (result is ApiResult.Success) session.adopt(result.value)
        return result
    }

    companion object {
        const val REDIRECT_URI = "zidrun://auth/callback"
    }
}
