package dz.racedz.nativeapp

import android.net.Uri
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dz.racedz.nativeapp.core.auth.AuthState
import dz.racedz.nativeapp.core.auth.SignOutReason
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AppFeaturesDto
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.feature.account.AccountViewModel
import dz.racedz.nativeapp.feature.account.PrivacyDataScreen
import dz.racedz.nativeapp.feature.account.ProfilePreferencesScreen
import dz.racedz.nativeapp.feature.account.RegistrationsScreen
import dz.racedz.nativeapp.feature.auth.AuthScreen
import dz.racedz.nativeapp.feature.auth.AuthViewModel
import dz.racedz.nativeapp.feature.races.RaceDetailScreen
import dz.racedz.nativeapp.feature.races.RaceDetailViewModel
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
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.feature.runs.record.RunSummaryScreen
import dz.racedz.nativeapp.feature.runs.record.StartRunScreen
import dz.racedz.nativeapp.feature.runs.record.StartRunViewModel
import dz.racedz.nativeapp.feature.registration.RegistrationScreen
import dz.racedz.nativeapp.feature.registration.RegistrationViewModel
import dz.racedz.nativeapp.locale.LocaleManager
import dz.racedz.nativeapp.navigation.RootDestinations
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
    var coachEnabled by remember { mutableStateOf(false) }
    LaunchedEffect(authState) {
        coachEnabled = if (authState is AuthState.SignedIn) {
            (container.coachRepository.overview() as? ApiResult.Success)?.value
                ?.entitlement?.tier?.let { it != "NONE" } ?: false
        } else {
            false
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
    var splashResolved by remember { mutableStateOf(false) }
    var pendingRaceSlug by remember { mutableStateOf<String?>(null) }

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

                // Race detail is public, so a link works signed out too — the screen offers
                // "sign in to register" rather than bouncing the user to a login wall.
                else -> pendingRaceSlug = raceSlugFrom(link)
            }

            onDeepLinkHandled()
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

        LaunchedEffect(splashResolved, pendingRaceSlug) {
            val slug = pendingRaceSlug
            if (splashResolved && slug != null) {
                pendingRaceSlug = null
                navController.navigate(RootDestinations.raceDetail(slug))
            }
        }

        NavHost(navController = navController, startDestination = RootDestinations.SPLASH) {

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
                        splashResolved = true
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
                // A run finished but never saved — the app was killed, or the save failed and the
                // runner backed out. Surfaced once, on the first shell entry, rather than left
                // sitting silently on disk where it would look like the run simply vanished.
                LaunchedEffect(Unit) {
                    RunRecorder.restorePending()?.let { pending ->
                        RunRecorder.resumeFinished(pending)
                        navController.navigate(RootDestinations.RUN_SUMMARY)
                    }
                }

                AppShell(
                    container = container,
                    appearance = appearance,
                    onOpenRace = { navController.navigate(RootDestinations.raceDetail(it)) },
                    onOpenRunHistory = { navController.navigate(RootDestinations.RUN_HISTORY) },
                    onOpenRun = { navController.navigate(RootDestinations.runDetail(it)) },
                    onRecordRun = { workoutId -> navController.navigate(RootDestinations.runStart(workoutId)) },
                    onResumeRecording = { navController.navigate(RootDestinations.RUN_RECORDING) },
                    // Subscribing is a payment-proof upload flow that already exists on the website;
                    // the app opens it in a custom tab rather than shipping a second version of it.
                    onOpenSubscribe = {
                        onOpenBrowserSignIn(container.authRepository.buildWebUrl("/account/coach/subscribe"))
                    },
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
                    onOpenSupport = {
                        onOpenBrowserSignIn(container.authRepository.buildWebUrl("/account/support"))
                    },
                    onOpenSecurity = {
                        onOpenBrowserSignIn(container.authRepository.buildWebUrl("/account/security"))
                    },
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
                    factory = SimpleViewModelFactory { StartRunViewModel(container.runsRepository) }
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
                RecordingScreen(
                    onFinished = { navController.navigate(RootDestinations.RUN_SUMMARY) },
                    onDiscarded = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
                    // Minimising leaves the recording running in the service; the Runs tab shows a
                    // banner to come back.
                    onMinimize = { navController.popBackStack(RootDestinations.SHELL, inclusive = false) },
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
                    factory = SimpleViewModelFactory { ConversationViewModel(container.coachRepository, runId) },
                )
                ConversationScreen(viewModel = chatViewModel, onBack = { navController.popBackStack() })
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
                    onExportGpx = { id ->
                        onOpenBrowserSignIn(container.authRepository.buildWebUrl("/api/v1/runs/$id/gpx"))
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
                    onRegister = { id, _ -> navController.navigate(RootDestinations.registration(id)) },
                    onViewRegistration = { navController.navigate(RootDestinations.REGISTRATIONS) },
                    isSignedIn = authState is AuthState.SignedIn,
                    onSignIn = { navController.navigate(RootDestinations.AUTH) },
                )
            }

            composable(
                route = RootDestinations.REGISTRATION,
                arguments = listOf(navArgument("raceId") { type = NavType.StringType }),
            ) { entry ->
                val raceId = entry.arguments?.getString("raceId").orEmpty()
                val registrationViewModel: RegistrationViewModel = viewModel(
                    key = "registration-$raceId",
                    factory = SimpleViewModelFactory {
                        RegistrationViewModel(
                            container.racesRepository,
                            container.registrationRepository,
                            container.accountRepository,
                            raceId,
                        )
                    },
                )
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

            composable(RootDestinations.PRIVACY) {
                PrivacyDataScreen(
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
            applyAppearance = { theme, language -> appearance.apply(theme, language) },
            onSignedOutCleanup = appearance::clear,
        )
    }
)
