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
import androidx.compose.ui.platform.testTag
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
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.res.painterResource
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
import dz.racedz.nativeapp.core.design.R as DesignR
import dz.racedz.nativeapp.SimpleViewModelFactory
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTestTags
import dz.racedz.nativeapp.core.network.AppFeaturesDto
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
    val iconRes: Int,
    /** The website gives Runs a stronger pill than the other three; this mirrors that. */
    val primary: Boolean = false,
)

/*
 * Races and Coach deliberately diverge from the website's glyphs.
 *
 * The web nav carried calendar-search and sparkles. At 24dp in a tab bar the magnifier reads as
 * "search races" rather than "races", and sparkles reads as "AI" rather than as training — neither
 * says sport to a runner glancing down mid-session. A start flag and a stopwatch do, and they sit
 * in the same Lucide line family as the footprints and the profile mark, so the row still reads as
 * one set. If the website's nav is restyled, these are the two to bring back into line.
 */
private val shellTabs = listOf(
    ShellTabSpec(ShellTab.Races, R.string.nav_races, DesignR.drawable.ic_flag),
    // Runs is the primary tab on the website too: it keeps a tinted pill even when unselected and
    // a solid one when active, because starting a run is the app's main verb.
    ShellTabSpec(ShellTab.Runs, R.string.nav_runs, DesignR.drawable.ic_footprints, primary = true),
    ShellTabSpec(ShellTab.Coach, R.string.nav_coach, DesignR.drawable.ic_timer),
    ShellTabSpec(ShellTab.Account, R.string.nav_account, DesignR.drawable.ic_user_round),
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
    /** [workoutId] is the planned session being logged, or null for a free run from the Runs tab. */
    onRecordRun: (String?) -> Unit,
    onResumeRecording: () -> Unit,
    /** Opens the save/discard summary for a finished recording that was never saved. */
    onOpenPendingSave: () -> Unit,
    /** Opens the hand-entry form for a run with no GPS (NATRUN-01). */
    onAddManual: () -> Unit,
    /** Opens the GPX import flow (NATRUN-02). */
    onImportGpx: () -> Unit,
    onOpenSubscribe: () -> Unit,
    /** [editing] distinguishes first-time setup from editing an existing goal. */
    onOpenCoachSetup: (Boolean) -> Unit,
    onOpenCoachPlan: () -> Unit,
    onOpenCoachChat: () -> Unit,
    onOpenCoachSleep: () -> Unit,
    onOpenCoachMemory: () -> Unit,
    onOpenRegistrations: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenPrivacy: () -> Unit,
    /** Hands off to the website for support and for security/MFA, which have no native screens. */
    onOpenSupport: () -> Unit,
    onOpenSecurity: () -> Unit,
    onOpenAbout: () -> Unit,
    onSignedOut: () -> Unit,
    /**
     * Remote feature flags from /api/v1/config, or null while the fetch is pending or failed.
     * Null fails OPEN (all tabs shown): the flags are an operator kill switch for a misbehaving
     * feature (RUNPAR-006), not an entitlement gate — an offline launch must not hide the app.
     */
    features: AppFeaturesDto? = null,
) {
    val navController = rememberNavController()

    Scaffold(
        containerColor = ZidRunTheme.colors.background,
        // enableEdgeToEdge() lets content draw under the system bars; contentWindowInsets makes
        // Scaffold report the status-bar height in innerPadding so each tab can inset itself
        // instead of the screen title rendering behind the clock.
        contentWindowInsets = WindowInsets.systemBars,
        bottomBar = { ShellBottomBar(navController, features) },
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
                    onRecordRun = { onRecordRun(null) },
                    onOpenPendingSave = onOpenPendingSave,
                    onAddManual = onAddManual,
                    onImportGpx = onImportGpx,
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
                    onSetUpCoach = { onOpenCoachSetup(false) },
                    onEditGoal = { onOpenCoachSetup(true) },
                    onViewPlan = onOpenCoachPlan,
                    onAskCoach = onOpenCoachChat,
                    onOpenSleep = onOpenCoachSleep,
                    onOpenMemory = onOpenCoachMemory,
                    contentPadding = innerPadding,
                )
            }
            composable(ShellTab.Account.route) {
                AccountScreen(
                    viewModel = rememberAccountViewModel(container, appearance),
                    onOpenRegistrations = onOpenRegistrations,
                    onOpenProfile = onOpenProfile,
                    onOpenPrivacy = onOpenPrivacy,
                    onOpenSupport = onOpenSupport,
                    onOpenSecurity = onOpenSecurity,
                    onOpenAbout = onOpenAbout,
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
private fun ShellBottomBar(navController: NavHostController, features: AppFeaturesDto?) {
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
            // The kill switch made real (RUNPAR-006): a tab whose server flag is off is not
            // rendered, so an operator can hide a misbehaving feature without a new binary.
            // Races and Account are never gated — Races is the start destination and Account
            // carries sign-out/privacy, which must stay reachable.
            val visibleTabs = shellTabs.filter { spec ->
                when (spec.tab) {
                    ShellTab.Runs -> features?.runs != false
                    ShellTab.Coach -> features?.coach != false
                    else -> true
                }
            }
            visibleTabs.forEach { spec ->
                val selected = currentRoute == spec.tab.route
                // Icon sits in a pill, matching .mobile-tab-icon on the website: tinted at 16% when
                // the tab is active, and for the primary (Runs) tab a solid fill with a dark glyph.
                val pillWidth = if (spec.primary) 58.dp else 52.dp
                val pillHeight = if (spec.primary) 34.dp else 28.dp
                val pillColor = when {
                    selected && spec.primary -> colors.primary
                    selected -> colors.primary.copy(alpha = 0.16f)
                    spec.primary -> colors.primary.copy(alpha = 0.12f)
                    else -> Color.Transparent
                }
                val iconTint = when {
                    selected && spec.primary -> colors.surfaceStrong
                    selected -> colors.primary
                    else -> colors.textMuted
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .testTag(
                            when (spec.tab) {
                                ShellTab.Races -> ZidRunTestTags.TabRaces
                                ShellTab.Runs -> ZidRunTestTags.TabRuns
                                ShellTab.Coach -> ZidRunTestTags.TabCoach
                                ShellTab.Account -> ZidRunTestTags.TabAccount
                            }
                        )
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
                        .padding(top = ZidRunDimens.spaceSm, bottom = ZidRunDimens.spaceXs),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .offset(y = if (spec.primary) (-4).dp else 0.dp)
                            .size(width = pillWidth, height = pillHeight)
                            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                            .background(pillColor),
                        contentAlignment = Alignment.Center,
                    ) {
                        // contentDescription intentionally null: the visible label below already
                        // gives this item's accessible name, so TalkBack would announce it twice.
                        Icon(
                            painterResource(spec.iconRes),
                            contentDescription = null,
                            tint = iconTint,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = stringResource(spec.labelRes),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (selected) colors.primary else colors.textMuted,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
