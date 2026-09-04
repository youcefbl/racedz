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

    // Kept, not just handed to Retrofit and dropped: ApiClient needs it back on a connection
    // failure to evict stale pooled connections (see the comment in ApiClient.call's IOException
    // branch) — without this reference there is nothing for a failed request to clean up, and a
    // long-lived process can get stuck retrying the same broken connection indefinitely.
    private val okHttpClient = NetworkFactory.okHttpClient(tokenProvider)
    private val api: ZidRunApi = NetworkFactory.api(okHttpClient)

    /**
     * Drops every pooled connection. [ApiClient] already does this reactively when a request
     * fails (see its `IOException` branch) — that recovers the *next* attempt after the runner
     * hits the error once. This is the proactive half: [ZidRunApplication] calls it every time the
     * whole app returns to the foreground, so a route that went bad while the process sat
     * backgrounded (the network changed, a middlebox timed out an idle socket — exactly what
     * happened on a build left running unattended for ~26h, see the review-round note in
     * ApiClient.kt) is cleared before the runner's first request after reopening the app, rather
     * than after their first VISIBLE failure. Safe and cheap to call whenever: eviction of an
     * already-empty or already-healthy pool is a no-op, and the very next request simply opens a
     * fresh connection either way.
     */
    fun evictStaleConnections() {
        okHttpClient.connectionPool.evictAll()
    }

    val sessionManager: SessionManager = SessionManager(api, tokenStore).also {
        it.appVersion = appVersion
        delegate = it
    }

    private val apiClient = ApiClient(api, tokenProvider, okHttpClient)

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
        // Auto-pause and cue-interval preferences persist across runs; attach before any screen reads them.
        dz.racedz.nativeapp.feature.runs.record.RunSettings.attach(context)
        // The background save worker (NATRUN-07.2) reads the outbox and posts through the same
        // repository/session as the foreground; it only ever acts for the signed-in owner.
        dz.racedz.nativeapp.feature.runs.record.RunSyncWorker.install(
            dz.racedz.nativeapp.feature.runs.record.RunSyncWorker.Dependencies(
                outbox = runOutbox,
                repository = runsRepository,
                currentUserId = { (sessionManager.state.value as? dz.racedz.nativeapp.core.auth.AuthState.SignedIn)?.userId },
            )
        )
    }

    init {
        // Debug builds only. The emulator reports speed = 0 on every injected fix, which the
        // production rule correctly rejects; without this, `adb emu geo fix` can never exercise the
        // recording pipeline. Release and internal builds keep the real rule — see GpsQuality.
        GpsQuality.trustDisplacementWhenSpeedIsZero = BuildConfig.DEBUG
    }
    private val analyticsRepository = dz.racedz.nativeapp.core.auth.AnalyticsRepository(api)

    /** First-party screen-view tracking (NATGAP-17). No third-party SDK is involved. */
    val analytics = dz.racedz.nativeapp.observability.Analytics(
        context = context.applicationContext,
        send = { path, locale, visitorId, sessionId ->
            analyticsRepository.track(path, locale, visitorId, sessionId)
        },
    )

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

    init {
        // Covers the sign-outs nobody taps: refresh expiry and security revocation. The manual
        // path still revokes server-side first (see AccountViewModel), which is cleaner; this is
        // the floor that always works.
        sessionManager.onSessionCleared = { pushRegistrar.invalidateLocalToken() }
    }
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
