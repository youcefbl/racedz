package dz.racedz.nativeapp

import android.content.Context
import dz.racedz.nativeapp.core.auth.AccountRepository
import dz.racedz.nativeapp.core.auth.AuthRepository
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.feature.runs.record.GpsQuality
import dz.racedz.nativeapp.feature.runs.record.RunOutbox
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.core.auth.RacesRepository
import dz.racedz.nativeapp.core.auth.RunsRepository
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
class AppContainer(context: Context, appVersion: String, val appInfo: AppInfo) {

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
    val runsRepository = RunsRepository(api, apiClient)
    val coachRepository = CoachRepository(api, apiClient)

    /**
     * Durable storage for a run that has not reached the server yet. Attached to the recorder at
     * construction so a recording is being persisted from its first fix, not from the moment the
     * runner presses Save.
     */
    val runOutbox = RunOutbox(context).also { RunRecorder.attachOutbox(it) }

    init {
        // Debug builds only. The emulator reports speed = 0 on every injected fix, which the
        // production rule correctly rejects; without this, `adb emu geo fix` can never exercise the
        // recording pipeline. Release and internal builds keep the real rule — see GpsQuality.
        GpsQuality.trustDisplacementWhenSpeedIsZero = BuildConfig.DEBUG
    }
    val accountRepository = AccountRepository(api, apiClient, sessionManager)

    /**
     * Push registration. Inert when this build has no Firebase config — see PushRegistrar.
     * Constructed here so the messaging service, which the system starts on its own, can reach the
     * same repository the rest of the app uses instead of building a second network stack.
     */
    val pushRegistrar = dz.racedz.nativeapp.push.PushRegistrar(
        context = context.applicationContext,
        registerToken = { token, label -> accountRepository.registerPushToken(token, label) },
        revokeToken = { token -> accountRepository.revokePushToken(token) },
    )
    val registrationRepository = RegistrationRepository(api, apiClient, sessionManager)
}

/**
 * What the About screen states about this build.
 *
 * Carried from the app module rather than read where it is displayed: `BuildConfig` belongs to the
 * module that declares it, and the feature modules cannot see the app's own.
 */
data class AppInfo(
    val versionName: String,
    val versionCode: Int,
    val releaseDate: String,
    /** The company that builds ZidRun. */
    val developer: String = "Inoblast",
    val developerUrl: String = "https://inoblast.net",
    val websiteUrl: String = "https://zidrun.com",
)
