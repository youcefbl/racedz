package dz.racedz.nativeapp

import android.net.Uri
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.core.view.WindowCompat
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kotlinx.coroutines.launch
import dz.racedz.nativeapp.core.auth.AuthState
import dz.racedz.nativeapp.core.auth.SignOutReason
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AppFeaturesDto
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.design.ZidRunThemeMode
import dz.racedz.nativeapp.feature.account.AboutScreen
import dz.racedz.nativeapp.feature.account.AccountViewModel
import dz.racedz.nativeapp.feature.account.PrivacyDataScreen
import dz.racedz.nativeapp.feature.account.ProfilePreferencesScreen
import dz.racedz.nativeapp.feature.account.RegistrationsScreen
import dz.racedz.nativeapp.feature.auth.AuthScreen
import dz.racedz.nativeapp.feature.auth.AuthViewModel
import dz.racedz.nativeapp.feature.races.RaceDetailScreen
import dz.racedz.nativeapp.feature.races.RaceDetailViewModel
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import dz.racedz.nativeapp.push.PUSH_HREF_KEY
import dz.racedz.nativeapp.push.ensurePushChannel
import dz.racedz.nativeapp.feature.runs.RunDetailScreen
import dz.racedz.nativeapp.feature.runs.RunDetailViewModel
import dz.racedz.nativeapp.feature.runs.RunHistoryScreen
import dz.racedz.nativeapp.feature.runs.RunsViewModel
import dz.racedz.nativeapp.feature.runs.record.RecordRunViewModel
import dz.racedz.nativeapp.feature.runs.record.RecordingScreen
import dz.racedz.nativeapp.feature.coach.CoachMemoryScreen
import dz.racedz.nativeapp.feature.coach.CoachMemoryViewModel
import dz.racedz.nativeapp.feature.coach.CoachOnboardingScreen
import dz.racedz.nativeapp.feature.account.UserOnboardingScreen
import dz.racedz.nativeapp.feature.coach.ConversationScreen
import dz.racedz.nativeapp.feature.coach.ConversationViewModel
import dz.racedz.nativeapp.feature.coach.PlanWeekScreen
import dz.racedz.nativeapp.feature.coach.SleepScreen
import dz.racedz.nativeapp.feature.coach.SleepViewModel
import dz.racedz.nativeapp.feature.coach.PlanWeekViewModel
import dz.racedz.nativeapp.feature.coach.CoachOnboardingViewModel
import dz.racedz.nativeapp.feature.runs.record.RecordingStatus
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.feature.runs.record.RunSummaryScreen
import dz.racedz.nativeapp.feature.runs.record.StartRunScreen
import dz.racedz.nativeapp.feature.runs.record.StartRunViewModel
import dz.racedz.nativeapp.feature.runs.manual.ManualRunScreen
import dz.racedz.nativeapp.feature.runs.manual.ManualRunViewModel
import dz.racedz.nativeapp.feature.runs.gpx.GpxImportScreen
import dz.racedz.nativeapp.feature.runs.gpx.GpxImportViewModel
import dz.racedz.nativeapp.feature.registration.RegistrationScreen
import dz.racedz.nativeapp.feature.registration.RegistrationViewModel
import dz.racedz.nativeapp.locale.LocaleManager
import dz.racedz.nativeapp.navigation.RootDestinations
import dz.racedz.nativeapp.navigation.ShellTab
import dz.racedz.nativeapp.ui.shell.AppShell
import dz.racedz.nativeapp.ui.splash.SplashRoute
import dz.racedz.nativeapp.core.design.R as DesignR

/**
 * The root navigation graph.
 *
 * Splash decides where the app starts by asking the session manager what is in secure storage; that
 * is why the shell and the auth screen are siblings rather than nested. When a session ends for any
 * reason — user sign-out, expiry, or a server-side revocation — the auth screen replaces the whole
 * back stack, so pressing Back cannot return to a signed-in screen holding stale data.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun ZidRunApp(
    container: AppContainer,
    /** The link the Activity received, if any. */
    pendingDeepLink: DeepLinkEvent?,
    onDeepLinkHandled: () -> Unit,
    onOpenBrowserSignIn: (String) -> Unit,
) {
    val context = LocalContext.current
    val systemInDarkTheme = isSystemInDarkTheme()
    val appearance = remember { AppearanceController(context, systemInDarkTheme) }
    val authState by container.sessionManager.state.collectAsStateWithLifecycle()

    // Whether to offer "Analyze run" on a run. Coaching is paid, so the action is hidden rather
    // than shown and then refused — offering something that answers "subscribe first" is worse than
    // not offering it. Read once per signed-in session; a tier change mid-session is rare enough
    // that a relaunch picking it up is acceptable.
    // The recorder must know whose runs it may record and recover: a snapshot is bound to its
    // owner, and switching accounts drops any live state rather than carrying one person's route
    // into another person's session (P234-R01).
    LaunchedEffect(authState) {
        RunRecorder.setOwner((authState as? AuthState.SignedIn)?.userId)
    }

    var coachEnabled by remember { mutableStateOf(false) }
    LaunchedEffect(authState) {
        coachEnabled = if (authState is AuthState.SignedIn) {
            (container.coachRepository.overview() as? ApiResult.Success)?.value
                ?.entitlement?.tier?.let { it != "NONE" } ?: false
        } else {
            false
        }
    }

    // Web handoffs open in a coroutine: the handoff URL is minted server-side (single-use token)
    // so the Custom Tab lands signed in (NATPAR-002); on failure the plain URL is opened instead
    // and the runner meets the normal login with the destination preserved.
    val handoffScope = rememberCoroutineScope()
    fun openWebSignedIn(next: String) {
        handoffScope.launch {
            // The app's own language, normalized to the two-letter tag the web dictionaries use.
            val appLanguage = LocaleManager.currentTag(context).take(2).lowercase()
            onOpenBrowserSignIn(container.authRepository.webHandoffUrl(next, appLanguage))
        }
    }

    // Remote feature flags from /api/v1/config (RUNPAR-006). Null until fetched, and the shell
    // fails OPEN on null: the flags are an operator kill switch for a misbehaving feature, not an
    // entitlement gate, so an offline launch must show the app, not an emptied one.
    var features by remember { mutableStateOf<AppFeaturesDto?>(null) }
    LaunchedEffect(Unit) {
        features = (container.authRepository.appConfig() as? ApiResult.Success)?.value?.features
    }

    // A race link that arrives while the splash is still up cannot be navigated to yet: the splash
    // finishes by popping itself with popUpTo(inclusive = true), which would take the race
    // destination with it. Park the slug and open it once the splash has handed over.
    var pendingRaceSlug by remember { mutableStateOf<String?>(null) }

    // System bars follow the *app's* theme, not the OS configuration (P234-R05). `enableEdgeToEdge()`
    // in MainActivity picks icon appearance from the system's own light/dark setting, so a light
    // ZidRun theme on a dark-mode phone drew white clock/battery/signal icons onto the light
    // `#F9FAFB` background — unreadable exactly where this app is used, outdoors.
    val view = LocalView.current
    val lightAppTheme = appearance.themeMode == ZidRunThemeMode.Light
    if (!view.isInEditMode) {
        LaunchedEffect(lightAppTheme) {
            val window = (view.context as? android.app.Activity)?.window ?: return@LaunchedEffect
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = lightAppTheme
                isAppearanceLightNavigationBars = lightAppTheme
            }
        }
    }

    ZidRunTheme(mode = appearance.themeMode) {
        val navController = rememberNavController()

        val authViewModel: AuthViewModel = viewModel(
            factory = SimpleViewModelFactory {
                AuthViewModel(container.authRepository) { LocaleManager.currentTag(context) }
            }
        )

        // Incoming links: the OAuth callback goes to the view model holding the matching PKCE
        // verifier; a race link opens that race. Both are consumed exactly once — replaying a spent
        // authorization code on a configuration change would fail and look like a broken sign-in.
        var pendingShellTab by remember { mutableStateOf<ShellTab?>(null) }
        var crashReportingEnabled by remember {
            mutableStateOf(dz.racedz.nativeapp.observability.CrashReporting.isEnabled(context))
        }

        /*
         * ONE notification view model, shared by the Account badge and the inbox.
         *
         * They had one each. Reading a notification updated only the inbox's copy, so going back
         * to Account still showed the old unread count until something else refetched — the two
         * views disagreed about the same number. Hoisted here because this is the nearest scope
         * that contains both.
         */
        /*
         * Keyed by ACCOUNT, not a constant.
         *
         * With a fixed key the single instance outlived the session: it was built before sign-in,
         * loaded once, and was never cleared — so after signing out and back in as someone else the
         * badge and inbox could still be showing the previous runner's notifications. Keying by
         * user id means a different account gets a different instance and cross-account state is
         * impossible by construction rather than by remembering to clear.
         */
        val signedInUserId = (authState as? AuthState.SignedIn)?.userId
        val notificationsViewModel: dz.racedz.nativeapp.feature.account.NotificationsViewModel = viewModel(
            key = "notifications-${signedInUserId.orEmpty()}",
            factory = SimpleViewModelFactory {
                dz.racedz.nativeapp.feature.account.NotificationsViewModel(container.accountRepository)
            },
        )

        // Loaded only once there is a session to load it with, and again whenever the account
        // changes — which is also what fills a freshly keyed instance.
        LaunchedEffect(signedInUserId) {
            if (signedInUserId != null) notificationsViewModel.load()
        }

        /*
         * Screen views (NATGAP-17).
         *
         * Reported as WEBSITE paths, not native route names: the admin funnel groups by path, so
         * "runs/history" and "/account/runs" would otherwise sit in the dashboard as two unrelated
         * rows for the same screen. Route arguments are dropped — a path carrying a run id would
         * shatter the aggregate into one row per run and put an identifier in the analytics table.
         */
        val notificationsState by notificationsViewModel.state.collectAsStateWithLifecycle()

        val locale = currentLocale()
        DisposableEffect(navController, locale) {
            val listener = androidx.navigation.NavController.OnDestinationChangedListener { _, destination, _ ->
                analyticsPathFor(destination.route)?.let { path ->
                    container.analytics.screen(path, locale.language)
                }
            }
            navController.addOnDestinationChangedListener(listener)
            onDispose { navController.removeOnDestinationChangedListener(listener) }
        }

        LaunchedEffect(pendingDeepLink?.id) {
            val link = pendingDeepLink?.uri ?: return@LaunchedEffect

            when {
                link.scheme == "zidrun" && link.host == "auth" -> {
                    authViewModel.completeBrowserSignIn(link) {
                        navController.navigate(RootDestinations.SHELL) {
                            popUpTo(RootDestinations.AUTH) { inclusive = true }
                        }
                    }
                }

                // A tapped notification, mapped from its website href by pushDestination().
                //
                // The tab is REQUESTED, not navigated to: tab routes belong to the shell's own
                // nested NavHost, and asking the root controller for "shell/runs" throws and
                // crashes the app. Anything stacked above the shell is popped first so the tab is
                // actually visible rather than hidden behind a run detail or a settings screen.
                link.scheme == "zidrun" && link.host == "runs" -> {
                    navController.popBackStack(RootDestinations.SHELL, inclusive = false)
                    pendingShellTab = ShellTab.Runs
                }

                // Registrations IS a root destination, so this one navigates normally.
                link.scheme == "zidrun" && link.host == "registrations" ->
                    navController.navigate(RootDestinations.REGISTRATIONS)

                // Race detail is public, so a link works signed out too — the screen offers
                // "sign in to register" rather than bouncing the user to a login wall.
                else -> pendingRaceSlug = raceSlugFrom(link)
            }

            onDeepLinkHandled()
        }

        /*
         * Keep this device's push token registered for as long as someone is signed in.
         *
         * Every launch, not just at sign-in: FCM rotates tokens on its own schedule, and a stale
         * one stops delivering silently. Registration is idempotent by token server-side, so the
         * repeat costs a row update. Revoked on sign-out so the next account on this device does
         * not inherit the previous runner's reminders — the token belongs to the install.
         *
         * Entirely best-effort and silent: no Firebase config, no network, a refused request —
         * all mean the app works exactly as it did before, without push.
         */
        val notificationPermission = rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { /* Declined is a valid answer: the token stays registered and nothing else changes. */ }

        LaunchedEffect(authState) {
            if (authState is AuthState.SignedIn) {
                ensurePushChannel(context)
                container.pushRegistrar.registerCurrentToken()

                /*
                 * Ask to post notifications, once signed in.
                 *
                 * Without this the whole feature is inert on Android 13+: the token registers, the
                 * server sends, FCM delivers, and the system drops it on the floor because the app
                 * has no POST_NOTIFICATIONS grant. Verified on the M21 — the first test push was
                 * accepted by FCM and simply never appeared. The permission was only ever requested
                 * at hold-to-begin, so a runner who never started a run, or who declined there,
                 * would never receive a reminder and would never be told why.
                 *
                 * Asked here rather than at launch because a signed-in runner is the only one there
                 * is anything to notify about. The system shows this at most twice in an app's
                 * lifetime and ignores it thereafter, so re-asking on later launches is harmless.
                 */
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                    PackageManager.PERMISSION_GRANTED
                ) {
                    notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }

        // Pull the account's saved appearance once per signed-in session, so a fresh install or a
        // theme changed on the website is reflected without the user having to open Account. The
        // controller renders from its local mirror on the very first frame; this reconciles it.
        LaunchedEffect(authState) {
            if (authState is AuthState.SignedIn) {
                (container.accountRepository.profile() as? ApiResult.Success)?.value?.let { user ->
                    appearance.apply(user.preferences.theme, null)
                }
            }
        }

        // A revocation can arrive at any moment (a 401 during a background refresh), not only when
        // the user taps sign out — so react to the state itself rather than to the tap.
        LaunchedEffect(authState) {
            if (authState is AuthState.SignedOut &&
                navController.currentDestination?.route !in setOf(RootDestinations.AUTH, RootDestinations.SPLASH)
            ) {
                navController.navigate(RootDestinations.AUTH) { popUpTo(0) { inclusive = true } }
            }
        }

        // "The splash has handed over" is a fact about where navigation currently is, so read it from
        // the back stack rather than from a flag the splash sets on its way out. Android restoring
        // the app after process death rebuilds the saved back stack without ever composing
        // SplashRoute, so a one-shot flag stayed false for the rest of that process — and every race
        // link a runner opened afterwards was parked here and silently never opened.
        val currentEntry by navController.currentBackStackEntryAsState()
        LaunchedEffect(currentEntry, pendingRaceSlug) {
            val slug = pendingRaceSlug ?: return@LaunchedEffect
            if (currentEntry?.destination?.route == RootDestinations.SPLASH) return@LaunchedEffect
            pendingRaceSlug = null
            navController.navigate(RootDestinations.raceDetail(slug))
        }

        NavHost(
            navController = navController,
            startDestination = RootDestinations.SPLASH,
            // Exposes the small, stable ZidRunTestTags contract to black-box UI Automator and
            // Macrobenchmark tests. Visible copy remains the accessibility name; tags are only
            // resource identifiers and do not change what TalkBack announces.
            modifier = Modifier.semantics { testTagsAsResourceId = true },
        ) {

            composable(RootDestinations.SPLASH) {
                SplashRoute(
                    onFinished = {
                        val target = if (container.sessionManager.state.value is AuthState.SignedIn) {
                            RootDestinations.SHELL
                        } else {
                            RootDestinations.AUTH
                        }
                        navController.navigate(target) {
                            popUpTo(RootDestinations.SPLASH) { inclusive = true }
                        }
                    },
                )
            }

            composable(RootDestinations.AUTH) {
                val reason by container.sessionManager.lastSignOutReason.collectAsStateWithLifecycle()
                AuthScreen(
                    viewModel = authViewModel,
                    onSignedIn = {
                        // Always routed through onboarding; the screen forwards straight to the
                        // shell when the profile is already complete. Deciding there rather than
                        // here means one place reads the server's own `profileComplete` instead of
                        // this navigation guessing from a cached session.
                        navController.navigate(RootDestinations.ONBOARDING) {
                            popUpTo(RootDestinations.AUTH) { inclusive = true }
                        }
                    },
                    onOpenBrowserSignIn = onOpenBrowserSignIn,
                    // Local-only until there is an account: AppearanceController persists both to
                    // the device, and signing in reconciles them from the server's preferences.
                    theme = when (appearance.themeMode) {
                        ZidRunThemeMode.Light -> "light"
                        ZidRunThemeMode.Dark -> "dark"
                        ZidRunThemeMode.Race -> "race"
                    },
                    language = LocaleManager.currentTag(context).take(2).lowercase(),
                    onAppearanceChange = { theme, language -> appearance.apply(theme, language) },
                    signedOutNotice = when (reason) {
                        SignOutReason.SessionExpired -> stringResource(DesignR.string.auth_signed_out_expired)
                        SignOutReason.SecurityRevocation -> stringResource(DesignR.string.auth_signed_out_security)
                        SignOutReason.AccountBlocked -> stringResource(DesignR.string.auth_signed_out_blocked)
                        // A deliberate sign-out needs no explanation.
                        SignOutReason.UserAction, null -> null
                    },
                )
            }

            composable(RootDestinations.SHELL) {
                // A run left on disk but not on the server — the app was killed mid-run or before a
                // save, or the runner backed out. Two separate concerns, deliberately (RED-R02):
                //
                // HYDRATION is unconditional: whenever the in-memory recorder is empty and the
                // outbox holds a run (finished or interrupted — RED-R01), the run is loaded as a
                // salvageable Finished state, so the Runs dock reads "Save run" and start() stays
                // refused. A saved navigation flag must never suppress this — after saved-state
                // process recreation the flag survives but the singleton restarts empty, and
                // skipping hydration would strand the run invisible on disk.
                //
                // AUTO-NAVIGATION is once per pending run, keyed on its clientId rather than a
                // Boolean: the summary opens by itself the first time this particular run is seen,
                // then the shell stays reachable and the dock is the way back. A different pending
                // run (a new death) surfaces itself again.
                var surfacedPendingId by rememberSaveable { mutableStateOf<String?>(null) }
                LaunchedEffect(authState) {
                    val userId = (authState as? AuthState.SignedIn)?.userId ?: return@LaunchedEffect
                    // Owner-scoped: another account's snapshot is neither hydrated nor shown.
                    val pending = RunRecorder.pendingFor(userId) ?: return@LaunchedEffect
                    if (RunRecorder.state.value.status == RecordingStatus.Idle) {
                        RunRecorder.resumeFinished(pending)
                    }
                    // Only a settled (Finished) run is auto-surfaced. A live recording also keeps a
                    // snapshot on disk; navigating away from it into the save screen would be wrong.
                    if (RunRecorder.state.value.status == RecordingStatus.Finished &&
                        surfacedPendingId != pending.request.clientId
                    ) {
                        surfacedPendingId = pending.request.clientId
                        navController.navigate(RootDestinations.RUN_SUMMARY)
                    }
                }

                AppShell(
                    unreadNotifications = notificationsState.unreadCount,
                    onScreen = { route ->
                        analyticsPathFor(route)?.let { container.analytics.screen(it, locale.language) }
                    },
                    requestedTab = pendingShellTab,
                    onRequestedTabHandled = { pendingShellTab = null },
                    container = container,
                    appearance = appearance,
                    onOpenRace = { navController.navigate(RootDestinations.raceDetail(it)) },
                    onOpenRunHistory = { navController.navigate(RootDestinations.RUN_HISTORY) },
                    onOpenRun = { navController.navigate(RootDestinations.runDetail(it)) },
                    onRecordRun = { workoutId -> navController.navigate(RootDestinations.runStart(workoutId)) },
                    onResumeRecording = { navController.navigate(RootDestinations.RUN_RECORDING) },
                    onOpenPendingSave = { navController.navigate(RootDestinations.RUN_SUMMARY) },
                    onAddManual = { navController.navigate(RootDestinations.RUN_MANUAL) },
                    onImportGpx = { navController.navigate(RootDestinations.RUN_IMPORT) },
                    // Subscribing is a payment-proof upload flow that already exists on the website;
                    // the app opens it in a custom tab rather than shipping a second version of it.
                    onOpenSubscribe = { openWebSignedIn("/account/coach/subscribe") },
                    onOpenCoachSetup = { editing -> navController.navigate(RootDestinations.coachSetup(editing)) },
                    onOpenCoachPlan = { navController.navigate(RootDestinations.COACH_PLAN) },
                    onOpenCoachChat = { navController.navigate(RootDestinations.coachChat()) },
                    onOpenCoachSleep = { navController.navigate(RootDestinations.COACH_SLEEP) },
                    onOpenCoachMemory = { navController.navigate(RootDestinations.COACH_MEMORY) },
                    features = features,
                    onOpenRegistrations = { navController.navigate(RootDestinations.REGISTRATIONS) },
                    onOpenProfile = { navController.navigate(RootDestinations.PROFILE) },
                    onOpenPrivacy = { navController.navigate(RootDestinations.PRIVACY) },
                    // Support and security are web surfaces. A Custom Tab shares the system
                    // browser's cookie jar, so a runner already signed in on the web lands straight
                    // on the page rather than at a second login.
                    onOpenSupport = { openWebSignedIn("/account/support") },
                    onOpenNotifications = { navController.navigate(RootDestinations.NOTIFICATIONS) },
                    onOpenSecurity = {
                        openWebSignedIn("/account/security")
                    },
                    onOpenAbout = { navController.navigate(RootDestinations.ABOUT) },
                    onSignedOut = {
                        navController.navigate(RootDestinations.AUTH) { popUpTo(0) { inclusive = true } }
                    },
                )
            }

            composable(
                route = RootDestinations.RUN_START,
                arguments = listOf(
                    navArgument("workoutId") { nullable = true; defaultValue = null; type = NavType.StringType }
                ),
            ) { entry ->
                val startViewModel: StartRunViewModel = viewModel(
                    factory = SimpleViewModelFactory { StartRunViewModel(container.runsRepository, container.coachRepository) }
                )
                StartRunScreen(
                    viewModel = startViewModel,
                    workoutId = entry.arguments?.getString("workoutId"),
                    onBack = { navController.popBackStack() },
                    onStarted = {
                        // Replaces itself in the back stack: once recording has begun, "back" should
                        // not return to a screen offering to begin it again.
                        navController.navigate(RootDestinations.RUN_RECORDING) {
                            popUpTo(RootDestinations.RUN_START) { inclusive = true }
                        }
                    },
                )
            }

            composable(RootDestinations.RUN_RECORDING) {
                val coachViewModel: dz.racedz.nativeapp.feature.runs.record.MidRunCoachViewModel = viewModel(
                    factory = SimpleViewModelFactory {
                        dz.racedz.nativeapp.feature.runs.record.MidRunCoachViewModel(container.coachRepository)
                    }
                )
                RecordingScreen(
                    onFinished = { navController.navigate(RootDestinations.RUN_SUMMARY) },
                    onDiscarded = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
                    // Minimising leaves the recording running in the service; the Runs tab shows a
                    // banner to come back.
                    onMinimize = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
                    coachViewModel = coachViewModel,
                    // Only guided-run cues reach this; the allowlist behind it refuses anything
                    // that is not a known coaching phrase.
                    fetchCueAudio = { text, cueLocale ->
                        container.coachRepository.cueAudio(text, cueLocale)
                    },
                )
            }

            composable(RootDestinations.ONBOARDING) {
                UserOnboardingScreen(
                    viewModel = rememberAccountViewModel(container, appearance),
                    // Both paths land in the shell: skipping only delays the ask, since the server
                    // enforces the same fields when a registration is attempted.
                    onDone = { navController.navigate(RootDestinations.SHELL) { popUpTo(0) { inclusive = true } } },
                    onSkip = { navController.navigate(RootDestinations.SHELL) { popUpTo(0) { inclusive = true } } },
                )
            }

            composable(
                route = RootDestinations.COACH_CHAT,
                arguments = listOf(
                    navArgument("runId") { nullable = true; defaultValue = null; type = NavType.StringType }
                ),
            ) { entry ->
                val runId = entry.arguments?.getString("runId")
                val chatViewModel: ConversationViewModel = viewModel(
                    // Keyed by run so arriving from a different run's "Analyze" gets its own model
                    // rather than reusing the previous run's focus.
                    key = "coach-chat-${runId ?: "general"}",
                    factory = SavedStateViewModelFactory(entry) { handle ->
                        ConversationViewModel(container.coachRepository, runId, handle)
                    },
                )
                ConversationScreen(
                    viewModel = chatViewModel,
                    onBack = { navController.popBackStack() },
                    // A consent refusal is cleared by re-saving the goal, so the failure state
                    // routes there directly (F234-R04).
                    onReviewConsent = { navController.navigate(RootDestinations.coachSetup(true)) },
                )
            }

            composable(RootDestinations.COACH_SLEEP) {
                val sleepViewModel: SleepViewModel = viewModel(
                    factory = SimpleViewModelFactory { SleepViewModel(container.coachRepository) }
                )
                SleepScreen(viewModel = sleepViewModel, onBack = { navController.popBackStack() })
            }

            composable(RootDestinations.COACH_MEMORY) {
                val memoryViewModel: CoachMemoryViewModel = viewModel(
                    factory = SimpleViewModelFactory { CoachMemoryViewModel(container.coachRepository) }
                )
                CoachMemoryScreen(viewModel = memoryViewModel, onBack = { navController.popBackStack() })
            }

            composable(RootDestinations.COACH_PLAN) {
                val planViewModel: PlanWeekViewModel = viewModel(
                    factory = SimpleViewModelFactory { PlanWeekViewModel(container.coachRepository) }
                )
                PlanWeekScreen(
                    viewModel = planViewModel,
                    onBack = { navController.popBackStack() },
                    onLogRun = { workoutId -> navController.navigate(RootDestinations.runStart(workoutId)) },
                )
            }

            composable(
                route = RootDestinations.COACH_SETUP,
                arguments = listOf(
                    navArgument("edit") { nullable = true; defaultValue = null; type = NavType.StringType }
                ),
            ) { entry ->
                val onboardingViewModel: CoachOnboardingViewModel = viewModel(
                    factory = SimpleViewModelFactory { CoachOnboardingViewModel(container.coachRepository) }
                )
                CoachOnboardingScreen(
                    viewModel = onboardingViewModel,
                    editing = entry.arguments?.getString("edit") == "true",
                    onBack = { navController.popBackStack() },
                    // Back to the Coach tab, which now has a plan to show.
                    onCreated = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
                )
            }

            composable(RootDestinations.RUN_SUMMARY) {
                val recordViewModel: RecordRunViewModel = viewModel(
                    factory = SimpleViewModelFactory { RecordRunViewModel(container.runsRepository) }
                )
                RunSummaryScreen(
                    viewModel = recordViewModel,
                    onSaved = { runId ->
                        navController.navigate(RootDestinations.runDetail(runId)) {
                            popUpTo(RootDestinations.SHELL) { inclusive = false }
                        }
                    },
                    onDiscarded = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
                )
            }

            composable(RootDestinations.RUN_MANUAL) {
                val manualViewModel: ManualRunViewModel = viewModel(
                    factory = SimpleViewModelFactory { ManualRunViewModel(container.runsRepository) }
                )
                ManualRunScreen(
                    viewModel = manualViewModel,
                    // Same landing as a recorded save: straight to the new run's detail, with the
                    // form gone from the back stack so Back returns to the Runs tab.
                    onSaved = { runId ->
                        navController.navigate(RootDestinations.runDetail(runId)) {
                            popUpTo(RootDestinations.SHELL) { inclusive = false }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(RootDestinations.RUN_IMPORT) {
                val importViewModel: GpxImportViewModel = viewModel(
                    factory = SimpleViewModelFactory { GpxImportViewModel(container.runsRepository) }
                )
                GpxImportScreen(
                    viewModel = importViewModel,
                    onSaved = { runId ->
                        navController.navigate(RootDestinations.runDetail(runId)) {
                            popUpTo(RootDestinations.SHELL) { inclusive = false }
                        }
                    },
                    onBack = { navController.popBackStack() },
                )
            }

            composable(RootDestinations.NOTIFICATIONS) {
                dz.racedz.nativeapp.feature.account.NotificationsScreen(
                    viewModel = notificationsViewModel,
                    onBack = { navController.popBackStack() },
                    // Reuses the push href mapping, so a notification opened from the inbox lands
                    // exactly where the same notification opened from the tray does.
                    onOpenHref = { href ->
                        pushDestination(android.content.Intent().putExtra(PUSH_HREF_KEY, href))?.let { link ->
                            when {
                                link.host == "runs" -> {
                                    navController.popBackStack(RootDestinations.SHELL, inclusive = false)
                                    pendingShellTab = ShellTab.Runs
                                }
                                link.host == "registrations" -> navController.navigate(RootDestinations.REGISTRATIONS)
                                else -> pendingRaceSlug = raceSlugFrom(link)
                            }
                        }
                    },
                )
            }

            composable(RootDestinations.RUN_HISTORY) {
                val runsViewModel: RunsViewModel = viewModel(
                    factory = SimpleViewModelFactory { RunsViewModel(container.runsRepository) }
                )
                RunHistoryScreen(
                    viewModel = runsViewModel,
                    onBack = { navController.popBackStack() },
                    onOpenRun = { navController.navigate(RootDestinations.runDetail(it)) },
                )
            }

            composable(
                route = RootDestinations.RUN_DETAIL,
                arguments = listOf(navArgument("runId") { type = NavType.StringType }),
            ) { entry ->
                val runId = entry.arguments?.getString("runId").orEmpty()
                val detailViewModel: RunDetailViewModel = viewModel(
                    key = "run-$runId",
                    factory = SimpleViewModelFactory { RunDetailViewModel(container.runsRepository, runId) },
                )
                RunDetailScreen(
                    viewModel = detailViewModel,
                    onBack = { navController.popBackStack() },
                    // Coaching is a paid feature; the action is only offered to a runner who has it,
                    // rather than shown and then refused.
                    onAnalyse = if (coachEnabled) {
                        // Carries the run, so the conversation is about *this* run rather than a
                        // general chat the button's label did not promise.
                        { navController.navigate(RootDestinations.coachChat(runId)) }
                    } else {
                        null
                    },
                    // Back to the list, which reloads on resume — the deleted run is gone from the
                    // server, so returning to its detail screen would show a 404.
                    onDeleted = { navController.popBackStack() },
                )
            }

            composable(
                route = RootDestinations.RACE_DETAIL,
                arguments = listOf(navArgument("raceId") { type = NavType.StringType }),
            ) { entry ->
                val raceId = entry.arguments?.getString("raceId").orEmpty()
                val detailViewModel: RaceDetailViewModel = viewModel(
                    key = "race-$raceId",
                    factory = SimpleViewModelFactory { RaceDetailViewModel(container.racesRepository, raceId) },
                )
                RaceDetailScreen(
                    viewModel = detailViewModel,
                    onBack = { navController.popBackStack() },
                    onRegister = { id, categoryId -> navController.navigate(RootDestinations.registration(id, categoryId)) },
                    onViewRegistration = { navController.navigate(RootDestinations.REGISTRATIONS) },
                    isSignedIn = authState is AuthState.SignedIn,
                    onSignIn = { navController.navigate(RootDestinations.AUTH) },
                )
            }

            composable(
                route = RootDestinations.REGISTRATION,
                arguments = listOf(
                    navArgument("raceId") { type = NavType.StringType },
                    navArgument("categoryId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                val raceId = entry.arguments?.getString("raceId").orEmpty()
                // The distance chosen on Race Detail (DEV-R02); null when registration was opened
                // from somewhere that has no selection to carry.
                val categoryId = entry.arguments?.getString("categoryId")
                val registrationViewModel: RegistrationViewModel = viewModel(
                    key = "registration-$raceId",
                    // Saved-state factory: the form survives process recreation (a backgrounded
                    // app used to come back with every typed field emptied).
                    factory = SavedStateViewModelFactory(entry) { handle ->
                        RegistrationViewModel(
                            container.racesRepository,
                            container.registrationRepository,
                            container.accountRepository,
                            raceId,
                            categoryId,
                            handle,
                        )
                    },
                )
                // Android Back follows the visible flow before leaving it, matching the top bar.
                androidx.activity.compose.BackHandler {
                    if (!registrationViewModel.backStep()) navController.popBackStack()
                }
                RegistrationScreen(
                    onCompleteProfile = { navController.navigate(RootDestinations.ONBOARDING) },
                    viewModel = registrationViewModel,
                    onBack = { navController.popBackStack() },
                    onDone = {
                        navController.popBackStack(RootDestinations.SHELL, inclusive = false)
                    },
                )
            }

            composable(RootDestinations.REGISTRATIONS) {
                RegistrationsScreen(
                    viewModel = rememberAccountViewModel(container, appearance),
                    onBack = { navController.popBackStack() },
                    onOpenRace = { navController.navigate(RootDestinations.raceDetail(it)) },
                )
            }

            composable(RootDestinations.PROFILE) {
                ProfilePreferencesScreen(
                    viewModel = rememberAccountViewModel(container, appearance),
                    onBack = { navController.popBackStack() },
                )
            }

            composable(RootDestinations.ABOUT) {
                // Public pages, so a plain URL rather than a signed handoff: minting a single-use
                // session token to read the terms would be handing out a credential for nothing.
                AboutScreen(
                    onForceTestCrash = if (BuildConfig.DEBUG) {
                        { dz.racedz.nativeapp.observability.CrashReporting.forceTestCrash() }
                    } else null,
                    versionName = container.appInfo.versionName,
                    versionCode = container.appInfo.versionCode,
                    releaseDate = container.appInfo.releaseDate,
                    developer = container.appInfo.developer,
                    developerUrl = container.appInfo.developerUrl,
                    websiteUrl = container.appInfo.websiteUrl,
                    onBack = { navController.popBackStack() },
                    onOpenUrl = onOpenBrowserSignIn,
                )
            }

            composable(RootDestinations.PRIVACY) {
                PrivacyDataScreen(
                    crashReporting = crashReportingEnabled to { enabled: Boolean ->
                        crashReportingEnabled = enabled
                        dz.racedz.nativeapp.observability.CrashReporting.setEnabled(context, enabled)
                    },
                    viewModel = rememberAccountViewModel(container, appearance),
                    onBack = { navController.popBackStack() },
                    onSignedOut = {
                        navController.navigate(RootDestinations.AUTH) { popUpTo(0) { inclusive = true } }
                    },
                )
            }
        }
    }
}

/**
 * Extracts a race slug from `zidrun://race/<slug>` or `https://zidrun.com/races/<slug>`.
 *
 * Only the last path segment is taken, and anything with an unexpected shape returns null rather
 * than being passed through — a deep link is untrusted input, and this value goes straight into an
 * API path.
 */
private fun raceSlugFrom(link: Uri): String? {
    val segments = link.pathSegments.orEmpty().filter { it.isNotBlank() }
    val slug = when {
        link.scheme == "zidrun" && link.host == "race" -> segments.firstOrNull()
        link.scheme == "https" && segments.firstOrNull() == "races" -> segments.getOrNull(1)
        else -> null
    }
    return slug?.takeIf { it.matches(Regex("^[A-Za-z0-9._-]{1,120}$")) }
}

/**
 * Account view model for the settings sub-screens. Each destination gets its own instance, but they
 * all read the same server state, and a preference saved on one is applied to the running app
 * through the shared [AppearanceController].
 */
@Composable
internal fun rememberAccountViewModel(
    container: AppContainer,
    appearance: AppearanceController,
): AccountViewModel = viewModel(
    factory = SimpleViewModelFactory {
        AccountViewModel(
            repository = container.accountRepository,
            session = container.sessionManager,
            loadEntitlement = {
                (container.coachRepository.overview() as? ApiResult.Success)?.value?.entitlement
            },
            applyAppearance = { theme, language -> appearance.apply(theme, language) },
            revokePushToken = { container.pushRegistrar.revokeCurrentToken() },
            onSignedOutCleanup = appearance::clear,
        )
    }
)

/**
 * The website path a native destination corresponds to, or null when it should not be tracked.
 *
 * Deliberately an explicit allowlist rather than a transform of the route string. Two reasons: a
 * route template like `runs/{runId}` would otherwise be reported with the id substituted, putting
 * an identifier into the analytics table and splitting one screen into thousands of rows; and
 * screens with no website equivalent are better left out than mapped to an invented path.
 */
internal fun analyticsPathFor(route: String?): String? = when (route) {
    ShellTab.Races.route -> "/races"
    ShellTab.Runs.route -> "/account/runs"
    ShellTab.Coach.route -> "/account/coach"
    ShellTab.Account.route -> "/account"
    RootDestinations.RUN_HISTORY -> "/account/runs"
    RootDestinations.REGISTRATIONS -> "/account/registrations"
    RootDestinations.PROFILE -> "/account/profile"
    RootDestinations.PRIVACY -> "/account/privacy"
    RootDestinations.ABOUT -> "/about"
    RootDestinations.NOTIFICATIONS -> "/account/notifications"
    RootDestinations.AUTH -> "/login"
    // Everything else — run detail, race detail, the recording flow, coach sub-screens — either
    // carries an id or has no web counterpart.
    else -> null
}
