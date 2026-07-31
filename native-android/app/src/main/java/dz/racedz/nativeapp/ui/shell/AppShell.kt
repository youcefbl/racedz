package dz.racedz.nativeapp.ui.shell

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dz.racedz.nativeapp.AppContainer
import dz.racedz.nativeapp.AppearanceController
import dz.racedz.nativeapp.R
import dz.racedz.nativeapp.SimpleViewModelFactory
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.feature.account.AccountScreen
import dz.racedz.nativeapp.feature.races.RacesScreen
import dz.racedz.nativeapp.feature.races.RacesViewModel
import dz.racedz.nativeapp.navigation.ShellTab
import dz.racedz.nativeapp.rememberAccountViewModel

private data class ShellTabSpec(
    val tab: ShellTab,
    val labelRes: Int,
    val icon: ImageVector,
)

private val shellTabs = listOf(
    ShellTabSpec(ShellTab.Races, R.string.nav_races, Icons.Filled.EmojiEvents),
    ShellTabSpec(ShellTab.Runs, R.string.nav_runs, Icons.AutoMirrored.Filled.DirectionsRun),
    ShellTabSpec(ShellTab.Coach, R.string.nav_coach, Icons.AutoMirrored.Filled.Assignment),
    ShellTabSpec(ShellTab.Account, R.string.nav_account, Icons.Filled.Person),
)

/**
 * The tabbed app shell. Each tab is a destination in a nested NavHost with `saveState`/`restoreState`,
 * so switching tabs keeps each one's scroll position and loaded pages instead of refetching.
 *
 * Runs and Coach are still placeholders (phase 6); their tabs exist so navigation, back handling,
 * and the layout are already the real ones when those screens land.
 */
@Composable
fun AppShell(
    container: AppContainer,
    appearance: AppearanceController,
    onOpenRace: (String) -> Unit,
    onOpenRegistrations: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onSignedOut: () -> Unit,
) {
    val navController = rememberNavController()

    Scaffold(
        containerColor = ZidRunTheme.colors.background,
        // enableEdgeToEdge() lets content draw under the system bars; contentWindowInsets makes
        // Scaffold report the status-bar height in innerPadding so each tab can inset itself
        // instead of the screen title rendering behind the clock.
        contentWindowInsets = WindowInsets.systemBars,
        bottomBar = { ShellBottomBar(navController) },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = ShellTab.Races.route,
        ) {
            composable(ShellTab.Races.route) {
                val racesViewModel: RacesViewModel = viewModel(
                    factory = SimpleViewModelFactory { RacesViewModel(container.racesRepository) }
                )
                RacesScreen(
                    viewModel = racesViewModel,
                    onOpenRace = onOpenRace,
                    contentPadding = innerPadding,
                )
            }
            composable(ShellTab.Runs.route) { RunsPlaceholder(innerPadding) }
            composable(ShellTab.Coach.route) { CoachPlaceholder(innerPadding) }
            composable(ShellTab.Account.route) {
                AccountScreen(
                    viewModel = rememberAccountViewModel(container, appearance),
                    onOpenRegistrations = onOpenRegistrations,
                    onOpenProfile = onOpenProfile,
                    onOpenPrivacy = onOpenPrivacy,
                    onOpenSupport = onOpenPrivacy,
                    onSignedOut = onSignedOut,
                    contentPadding = innerPadding,
                )
            }
        }
    }
}

@Composable
private fun RunsPlaceholder(contentPadding: androidx.compose.foundation.layout.PaddingValues) {
    PlaceholderScreen(
        icon = Icons.AutoMirrored.Filled.DirectionsRun,
        title = stringResource(R.string.nav_runs),
        badge = stringResource(R.string.placeholder_coming_soon),
        body = stringResource(R.string.placeholder_runs_body),
        contentPadding = contentPadding,
    )
}

@Composable
private fun CoachPlaceholder(contentPadding: androidx.compose.foundation.layout.PaddingValues) {
    PlaceholderScreen(
        icon = Icons.AutoMirrored.Filled.Assignment,
        title = stringResource(R.string.nav_coach),
        badge = stringResource(R.string.placeholder_coming_soon),
        body = stringResource(R.string.placeholder_coach_body),
        contentPadding = contentPadding,
    )
}

@Composable
private fun ShellBottomBar(navController: NavHostController) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    NavigationBar(
        containerColor = ZidRunTheme.colors.surface,
        contentColor = ZidRunTheme.colors.text,
    ) {
        shellTabs.forEach { spec ->
            val selected = currentRoute == spec.tab.route
            NavigationBarItem(
                selected = selected,
                onClick = {
                    navController.navigate(spec.tab.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = {
                    // contentDescription intentionally null: the visible label below already
                    // gives this item's accessible name, so TalkBack would otherwise announce it twice.
                    Icon(
                        imageVector = spec.icon,
                        contentDescription = null,
                    )
                },
                label = { Text(stringResource(spec.labelRes)) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = ZidRunTheme.colors.primary,
                    selectedTextColor = ZidRunTheme.colors.primary,
                    unselectedIconColor = ZidRunTheme.colors.textMuted,
                    unselectedTextColor = ZidRunTheme.colors.textMuted,
                    indicatorColor = ZidRunTheme.colors.primarySoft,
                ),
            )
        }
    }
}
