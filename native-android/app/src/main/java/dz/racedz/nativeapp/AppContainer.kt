package dz.racedz.nativeapp

import android.content.Context
import dz.racedz.nativeapp.core.auth.AccountRepository
import dz.racedz.nativeapp.core.auth.AuthRepository
import dz.racedz.nativeapp.core.auth.RacesRepository
import dz.racedz.nativeapp.core.auth.RegistrationRepository
import dz.racedz.nativeapp.core.auth.SessionManager
import dz.racedz.nativeapp.core.auth.TokenStore
import dz.racedz.nativeapp.core.network.ApiClient
import dz.racedz.nativeapp.core.network.AuthTokenProvider
import dz.racedz.nativeapp.core.network.NetworkFactory
import dz.racedz.nativeapp.core.network.ZidRunApi

/**
 * Manual dependency graph. A service locator rather than Hilt on purpose: the graph is a handful of
 * singletons with no scoping subtleties, and skipping annotation processing keeps the build fast and
 * the wiring readable in one file.
 *
 * The [SessionManager] is constructed before the OkHttp client and handed in as the token provider
 * through an indirection, because the client needs the provider and the manager needs the API the
 * client builds. The indirection breaks that cycle without a lateinit escape hatch.
 */
class AppContainer(context: Context, appVersion: String) {

    private val tokenStore = TokenStore(context)

    // Resolved after `sessionManager` exists; every call site reads it lazily at request time, so
    // the first HTTP request cannot observe the null window.
    private var delegate: AuthTokenProvider? = null

    private val tokenProvider = object : AuthTokenProvider {
        override fun currentAccessToken(): String? = delegate?.currentAccessToken()
        override suspend fun refreshAccessToken(): String? = delegate?.refreshAccessToken()
    }

    private val api: ZidRunApi = NetworkFactory.api(NetworkFactory.okHttpClient(tokenProvider))

    val sessionManager: SessionManager = SessionManager(api, tokenStore).also {
        it.appVersion = appVersion
        delegate = it
    }

    private val apiClient = ApiClient(api, tokenProvider)

    val authRepository = AuthRepository(api, apiClient, sessionManager)
    val racesRepository = RacesRepository(api, apiClient)
    val accountRepository = AccountRepository(api, apiClient, sessionManager)
    val registrationRepository = RegistrationRepository(api, apiClient, sessionManager)
}
