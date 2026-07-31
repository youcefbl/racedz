package dz.racedz.nativeapp.ui.shell

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
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
import dz.racedz.nativeapp.feature.coach.CoachScreen
import dz.racedz.nativeapp.feature.coach.CoachViewModel
import dz.racedz.nativeapp.feature.races.RacesViewModel
import dz.racedz.nativeapp.feature.runs.RunsOverviewScreen
import dz.racedz.nativeapp.feature.runs.RunsViewModel
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
    onOpenRunHistory: () -> Unit,
    onOpenRun: (String) -> Unit,
    onRecordRun: () -> Unit,
    onResumeRecording: () -> Unit,
    onOpenSubscribe: () -> Unit,
    onOpenCoachSetup: () -> Unit,
    onOpenCoachPlan: () -> Unit,
    onOpenCoachChat: () -> Unit,
    onOpenCoachSleep: () -> Unit,
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
            composable(ShellTab.Runs.route) {
                val runsViewModel: RunsViewModel = viewModel(
                    factory = SimpleViewModelFactory { RunsViewModel(container.runsRepository) }
                )
                RunsOverviewScreen(
                    viewModel = runsViewModel,
                    onOpenHistory = onOpenRunHistory,
                    onResumeRecording = onResumeRecording,
                    onOpenRun = onOpenRun,
                    onRecordRun = onRecordRun,
                    // Manual entry and GPX import are still to come; until then they open history
                    // rather than a dead end.
                    onLogManually = onOpenRunHistory,
                    onImportGpx = onOpenRunHistory,
                    contentPadding = innerPadding,
                )
            }
            composable(ShellTab.Coach.route) {
                val coachViewModel: CoachViewModel = viewModel(
                    factory = SimpleViewModelFactory { CoachViewModel(container.coachRepository) }
                )
                CoachScreen(
                    viewModel = coachViewModel,
                    // Subscribing is a payment-proof flow that lives on the website; the app links
                    // out rather than shipping a second, divergent version of it.
                    onOpenSubscribe = onOpenSubscribe,
                    onLogRun = onRecordRun,
                    onSetUpCoach = onOpenCoachSetup,
                    onViewPlan = onOpenCoachPlan,
                    onAskCoach = onOpenCoachChat,
                    onOpenSleep = onOpenCoachSleep,
                    contentPadding = innerPadding,
                )
            }
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
private fun ShellBottomBar(navController: NavHostController) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val colors = ZidRunTheme.colors

    Column {
        ZidRunDivider()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .windowInsetsPadding(WindowInsets.navigationBars)
                .selectableGroup(),
            verticalAlignment = Alignment.Top,
        ) {
            shellTabs.forEach { spec ->
                val selected = currentRoute == spec.tab.route
                val tint = if (selected) colors.primary else colors.textMuted
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = ZidRunDimens.minTouchTarget)
                        .selectable(
                            selected = selected,
                            role = Role.Tab,
                            onClick = {
                                navController.navigate(spec.tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                        )
                        .padding(top = ZidRunDimens.spaceSm),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    // contentDescription intentionally null: the visible label below already
                    // gives this item's accessible name, so TalkBack would otherwise announce it twice.
                    Icon(spec.icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = stringResource(spec.labelRes),
                        style = MaterialTheme.typography.labelSmall,
                        color = tint,
                        maxLines = 1,
                    )
                    Spacer(Modifier.height(4.dp))
                    // The mockups mark the active tab with a short underline rather than M3's
                    // default pill. Always laid out — transparent when unselected — so selecting a
                    // tab does not shift the row's height.
                    Box(
                        modifier = Modifier
                            .width(24.dp)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(if (selected) colors.primary else Color.Transparent),
                    )
                    Spacer(Modifier.height(ZidRunDimens.spaceXs))
                }
            }
        }
    }
}
