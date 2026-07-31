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
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.feature.account.AccountViewModel
import dz.racedz.nativeapp.feature.account.PrivacyDataScreen
import dz.racedz.nativeapp.feature.account.ProfilePreferencesScreen
import dz.racedz.nativeapp.feature.account.RegistrationsScreen
import dz.racedz.nativeapp.feature.auth.AuthScreen
import dz.racedz.nativeapp.feature.auth.AuthViewModel
import dz.racedz.nativeapp.feature.races.RaceDetailScreen
import dz.racedz.nativeapp.feature.races.RaceDetailViewModel
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
                        navController.navigate(RootDestinations.SHELL) {
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
                AppShell(
                    container = container,
                    appearance = appearance,
                    onOpenRace = { navController.navigate(RootDestinations.raceDetail(it)) },
                    onOpenRegistrations = { navController.navigate(RootDestinations.REGISTRATIONS) },
                    onOpenProfile = { navController.navigate(RootDestinations.PROFILE) },
                    onOpenPrivacy = { navController.navigate(RootDestinations.PRIVACY) },
                    onSignedOut = {
                        navController.navigate(RootDestinations.AUTH) { popUpTo(0) { inclusive = true } }
                    },
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
                    onOpenRegistration = { },
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
