package dz.racedz.nativeapp.core.auth

import android.os.Build
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AuthSessionDto
import dz.racedz.nativeapp.core.network.AuthTokenProvider
import dz.racedz.nativeapp.core.network.LogoutRequest
import dz.racedz.nativeapp.core.network.RefreshRequest
import dz.racedz.nativeapp.core.network.TokenPairDto
import dz.racedz.nativeapp.core.network.UserDto
import dz.racedz.nativeapp.core.network.ZidRunApi
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** What the UI knows about the signed-in user. Deliberately coarse — screens branch on this only. */
sealed interface AuthState {
    /** Storage has not been read yet; the splash screen waits on this. */
    data object Unknown : AuthState
    data object SignedOut : AuthState
    data class SignedIn(val userId: String, val email: String, val displayName: String) : AuthState
}

/**
 * Why a session ended, so the sign-in screen can explain itself instead of appearing for no reason.
 */
enum class SignOutReason {
    UserAction,
    SessionExpired,
    /** The refresh token was replayed from elsewhere and the server revoked the device family. */
    SecurityRevocation,
    AccountBlocked,
}

/**
 * Owns the device session: persistence, the [AuthTokenProvider] the network layer calls, refresh
 * with single-flight de-duplication, and sign-out.
 *
 * Refresh de-duplication matters more than it looks. Several screens can fire requests at once
 * after the app is foregrounded; without the mutex each 401 would start its own refresh, and since
 * the server rotates the refresh token on every use, the second one would present an
 * already-rotated token — which the server correctly reads as token replay and responds to by
 * revoking the whole device family. The app would log itself out. The mutex plus the
 * "did someone already refresh while I waited?" check below is what prevents that.
 */
class SessionManager(
    private val api: ZidRunApi,
    private val tokenStore: TokenStore,
) : AuthTokenProvider {

    private val refreshMutex = Mutex()

    private val _state = MutableStateFlow<AuthState>(AuthState.Unknown)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _lastSignOutReason = MutableStateFlow<SignOutReason?>(null)
    val lastSignOutReason: StateFlow<SignOutReason?> = _lastSignOutReason.asStateFlow()

    /** Device metadata sent with sign-in so "Signed-in devices" is recognizable. Model only —
     *  no serial number, no advertising id, nothing that identifies the handset uniquely. */
    val deviceName: String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    /** Reads persisted state. Called once from the splash screen before deciding where to go. */
    fun restore() {
        val stored = tokenStore.read()
        _state.value = if (stored == null) {
            AuthState.SignedOut
        } else {
            AuthState.SignedIn(stored.userId, stored.email, stored.displayName)
        }
    }

    override fun currentAccessToken(): String? = tokenStore.read()?.accessToken

    override suspend fun refreshAccessToken(): String? = refreshMutex.withLock {
        val before = tokenStore.read() ?: return@withLock null

        // Another coroutine may have completed a refresh while this one waited for the lock. Its
        // new token is already valid, so use it instead of rotating again.
        if (before.accessExpiresAtMs > System.currentTimeMillis() + EXPIRY_SKEW_MS) {
            return@withLock before.accessToken
        }

        val response = runCatching {
            api.refresh(
                RefreshRequest(
                    refreshToken = before.refreshToken,
                    appVersion = appVersion,
                    deviceName = deviceName,
                )
            )
        }.getOrNull()

        val tokens = response?.body()?.data?.tokens
        if (response == null || !response.isSuccessful || tokens == null || tokens.accessToken.isEmpty()) {
            // A transport failure is not proof the session is gone — do not throw the refresh token
            // away just because the phone was in a tunnel. Only a definitive 401 signs the user out.
            if (response?.code() == 401) {
                val reason = if (readErrorCode(response) == "REFRESH_REUSE_DETECTED") {
                    SignOutReason.SecurityRevocation
                } else {
                    SignOutReason.SessionExpired
                }
                clearSession(reason)
            }
            return@withLock null
        }

        tokenStore.write(before.copy(
            accessToken = tokens.accessToken,
            refreshToken = tokens.refreshToken,
            accessExpiresAtMs = expiryFrom(tokens),
        ))
        tokens.accessToken
    }

    /** Persist a session returned by login or the PKCE token exchange. */
    fun adopt(session: AuthSessionDto) {
        tokenStore.write(
            StoredSession(
                accessToken = session.tokens.accessToken,
                refreshToken = session.tokens.refreshToken,
                accessExpiresAtMs = expiryFrom(session.tokens),
                userId = session.user.id,
                email = session.user.email,
                displayName = session.user.displayName.ifBlank { session.user.email },
            )
        )
        _lastSignOutReason.value = null
        _state.value = AuthState.SignedIn(
            userId = session.user.id,
            email = session.user.email,
            displayName = session.user.displayName.ifBlank { session.user.email },
        )
    }

    /** Keep the cached display name in step after a profile edit. */
    fun updateProfileSnapshot(user: UserDto) {
        val stored = tokenStore.read() ?: return
        val displayName = user.displayName.ifBlank { user.email }
        tokenStore.write(stored.copy(email = user.email, displayName = displayName))
        _state.value = AuthState.SignedIn(user.id, user.email, displayName)
    }

    /**
     * Sign out. The server call is best-effort: if the device is offline the local tokens are still
     * destroyed, because the user's expectation of "log out" is that this phone stops being signed
     * in. The refresh token then dies naturally at its expiry, and "sign out everywhere" is
     * available for the case where the device was lost.
     */
    suspend fun signOut(reason: SignOutReason = SignOutReason.UserAction) {
        val stored = tokenStore.read()
        if (stored != null) {
            runCatching { api.logout(LogoutRequest(stored.refreshToken)) }
        }
        clearSession(reason)
    }

    /**
     * Run whenever a session ends, however it ended.
     *
     * Set once at startup. Exists because sign-out is not only the button: an expired refresh
     * token and a server-side security revocation both land here, and device-scoped cleanup —
     * push registration, for one — must happen on those paths too or the previous account keeps
     * receiving notifications on this phone.
     */
    var onSessionCleared: (() -> Unit)? = null

    fun clearSession(reason: SignOutReason) {
        tokenStore.clear()
        _lastSignOutReason.value = reason
        _state.value = AuthState.SignedOut
        // After the state change, and never allowed to throw: a failing cleanup must not leave the
        // app believing it is still signed in.
        runCatching { onSessionCleared?.invoke() }
    }

    fun consumeSignOutReason(): SignOutReason? = _lastSignOutReason.value.also { _lastSignOutReason.value = null }

    /** Turns a failure that means "the session is gone" into an actual sign-out. */
    fun handleAuthFailure(error: ApiCallException) {
        when (error.code) {
            ApiErrorCode.RefreshReuseDetected -> clearSession(SignOutReason.SecurityRevocation)
            ApiErrorCode.AccountBlocked -> clearSession(SignOutReason.AccountBlocked)
            ApiErrorCode.SessionExpired, ApiErrorCode.Unauthenticated -> clearSession(SignOutReason.SessionExpired)
            else -> Unit
        }
    }

    fun <T> onResult(result: ApiResult<T>): ApiResult<T> {
        if (result is ApiResult.Failure && result.error.requiresSignIn) handleAuthFailure(result.error)
        return result
    }

    private fun expiryFrom(tokens: TokenPairDto): Long =
        System.currentTimeMillis() + (tokens.expiresIn * 1000L)

    private fun readErrorCode(response: retrofit2.Response<*>): String? = runCatching {
        response.errorBody()?.string()?.let { body ->
            Regex("\"code\"\\s*:\\s*\"([A-Z_]+)\"").find(body)?.groupValues?.get(1)
        }
    }.getOrNull()

    var appVersion: String? = null

    private companion object {
        /** Refresh a little before the real expiry so a request in flight cannot land expired. */
        const val EXPIRY_SKEW_MS = 30_000L
    }
}
