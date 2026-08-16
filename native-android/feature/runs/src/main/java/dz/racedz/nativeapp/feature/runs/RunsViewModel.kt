package dz.racedz.nativeapp.feature.runs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.BadgesDto
import dz.racedz.nativeapp.core.network.CoachSafetyAlertDto
import dz.racedz.nativeapp.core.network.RunDto
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.WeekFields
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Which recording sources the history list is showing. */
enum class RunSourceFilter { All, Gps, Manual }

/** The four month-scale targets, in the order the overview lists them. */
enum class RunChallengeId { MonthDistance, MonthRuns, MonthLongRun }

/**
 * A challenge: something to chase this month, measured against the runner's own history.
 *
 * Derived entirely from runs already in memory — there is no challenge table, no join, and no
 * award pipeline, so a challenge cannot drift out of sync with the runs it is counted from. The
 * target is the next rung above the runner's best completed month, which is what keeps this
 * meaningful for someone running 15 km a month and someone running 150: a fixed "50 km" would be
 * unreachable for the first and already spent for the second.
 */
data class RunChallenge(val id: RunChallengeId, val current: Double, val target: Double) {
    val done: Boolean get() = current >= target
    val fraction: Float
        get() = if (target <= 0.0) 0f else (current / target).coerceIn(0.0, 1.0).toFloat()
}

/**
 * Rungs per challenge, and the increment used once a runner has climbed past the last one.
 *
 * The named rungs are landmarks — 100 km in a month, a half-marathon — but they must not be a
 * ceiling. Pinning to the top rung was wrong in a way only real data showed: a runner whose best
 * month was 337 km over 32 runs was handed "300 km" and "26 runs" as this month's challenge, both
 * *below* what they had already done. A target beneath your own proven best is not a step up, and
 * a page that offers one has stopped paying attention to the person reading it.
 *
 * Beyond the ladder the target keeps climbing, rounded up to the next [step] so it stays a round
 * number rather than "338 km".
 */
private val MONTH_DISTANCE_LADDER = listOf(25.0, 50.0, 100.0, 150.0, 200.0, 300.0)
private const val MONTH_DISTANCE_STEP = 50.0
private val MONTH_RUNS_LADDER = listOf(4.0, 8.0, 12.0, 16.0, 20.0, 26.0)
private const val MONTH_RUNS_STEP = 4.0
private val LONG_RUN_LADDER = listOf(5.0, 10.0, 15.0, 21.1, 30.0, 42.2)
private const val LONG_RUN_STEP = 5.0

data class RunsUiState(
    val runs: List<RunDto> = emptyList(),
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    val query: String = "",
    val sourceFilter: RunSourceFilter = RunSourceFilter.All,
    val thisMonthOnly: Boolean = false,
    /** RUN | WALK | TRAIL | RIDE, or null for every activity (NATRUN-07.1). */
    val sportFilter: String? = null,
    /**
     * Achievements, straight from the server.
     *
     * Fetched rather than derived: the catalogue, the thresholds and the race-finish count all
     * live server-side, and a second implementation here would eventually disagree with the
     * website about whether something was earned — which is exactly the kind of difference a
     * runner notices and does not forgive. Null until it arrives, and left null if it fails: an
     * unreachable badges endpoint must not take the runs page down with it.
     */
    val badges: BadgesDto? = null,
    val safetyAlert: CoachSafetyAlertDto? = null,
    val safetyClearing: Boolean = false,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
    val isEmpty: Boolean get() = !loading && error == null && runs.isEmpty()

    /**
     * Runs after search and filters. Applied on the client because the whole page is already in
     * memory — going back to the server for a substring match would make typing feel laggy on a
     * slow connection for no gain.
     */
    val visibleRuns: List<RunDto>
        get() {
            val needle = query.trim().lowercase()
            return runs.filter { run ->
                val matchesQuery = needle.isEmpty() ||
                    run.title?.lowercase()?.contains(needle) == true ||
                    run.notes?.lowercase()?.contains(needle) == true
                val matchesSource = when (sourceFilter) {
                    RunSourceFilter.All -> true
                    RunSourceFilter.Gps -> run.source == "GPS"
                    RunSourceFilter.Manual -> run.source != "GPS"
                }
                val matchesSport = sportFilter == null || run.sport == sportFilter
                matchesQuery && matchesSource && matchesSport && (!thisMonthOnly || run.isThisMonth())
            }
        }

    val visibleDistanceKm: Double get() = visibleRuns.sumOf { it.distanceKm }

    /**
     * Runs that count toward totals, bests, streaks and challenges.
     *
     * The server classifies an activity it can tell was not covered on foot (a step rate too low
     * for the ground covered, or a pace nobody sustains) and leaves it out of records, streaks and
     * the coach's picture. This page summed everything, so one bike ride logged by accident became
     * the runner's "best pace" here while the website and the coach ignored it — two numbers for
     * one history, and no way to tell which was lying.
     */
    val countedRuns: List<RunDto> get() = runs.filter { it.validity == "VALID" }

    /**
     * This month's challenges, each measured against the next rung above the runner's best
     * *completed* month. Basing the target on finished months rather than the current one is what
     * stops the goal running away from the runner as they progress through it.
     */
    val challenges: List<RunChallenge>
        get() {
            val zone = ZoneId.systemDefault()
            val now = Instant.now().atZone(zone)
            val byMonth = countedRuns.groupBy { run ->
                runCatching { Instant.parse(run.startedAt).atZone(zone) }
                    .getOrNull()
                    ?.let { it.year * 12 + it.monthValue }
            }
            val currentKey = now.year * 12 + now.monthValue
            val past = byMonth.filterKeys { it != null && it != currentKey }.values
            val current = byMonth[currentKey].orEmpty()

            // Strictly greater than the runner's best, always — past the last rung it keeps
            // climbing in `step` increments instead of pinning to the top of the list.
            fun nextRung(ladder: List<Double>, step: Double, best: Double): Double =
                ladder.firstOrNull { it > best }
                    ?: (kotlin.math.floor(best / step) + 1) * step

            return listOf(
                RunChallenge(
                    RunChallengeId.MonthDistance,
                    current = current.sumOf { it.distanceKm },
                    target = nextRung(
                        MONTH_DISTANCE_LADDER,
                        MONTH_DISTANCE_STEP,
                        past.maxOfOrNull { month -> month.sumOf { it.distanceKm } } ?: 0.0,
                    ),
                ),
                RunChallenge(
                    RunChallengeId.MonthRuns,
                    current = current.size.toDouble(),
                    target = nextRung(
                        MONTH_RUNS_LADDER,
                        MONTH_RUNS_STEP,
                        past.maxOfOrNull { month -> month.size.toDouble() } ?: 0.0,
                    ),
                ),
                RunChallenge(
                    RunChallengeId.MonthLongRun,
                    current = current.maxOfOrNull { it.distanceKm } ?: 0.0,
                    target = nextRung(
                        LONG_RUN_LADDER,
                        LONG_RUN_STEP,
                        past.maxOfOrNull { month -> month.maxOfOrNull { it.distanceKm } ?: 0.0 } ?: 0.0,
                    ),
                ),
            )
        }

    val hasFilters: Boolean
        get() = query.isNotBlank() || sourceFilter != RunSourceFilter.All || thisMonthOnly || sportFilter != null

    /** The most recent run, which the overview leads with. */
    val latestRun: RunDto? get() = runs.maxByOrNull { it.startedAt }

    /**
     * This week's totals.
     *
     * The week is ISO (Monday-start) on purpose, not the device locale's. `WeekFields.of(locale)`
     * starts the Arabic week on Saturday, so the very same runner on the very same day saw "1 run"
     * in English and "0 runs" in Arabic — and disagreed with the website, which is Monday-based for
     * every locale. A weekly total must not depend on the language the app is being read in.
     */
    val weekDistanceKm: Double get() = thisWeek().sumOf { it.distanceKm }
    val weekRunCount: Int get() = thisWeek().size
    val weekDurationSeconds: Int get() = thisWeek().sumOf { it.durationSeconds }

    /**
     * Personal bests, mirroring the website's "Personal bests" card.
     *
     * Computed from [runs] rather than fetched: the list is now the caller's complete history (the
     * repository follows the sync cursor to the end), so summing it here agrees with the server by
     * construction and costs no extra request.
     */
    val totalDistanceKm: Double get() = countedRuns.sumOf { it.distanceKm }
    val longestRunKm: Double get() = countedRuns.maxOfOrNull { it.distanceKm } ?: 0.0

    /** Fastest average pace, ignoring runs the server could not derive a pace for. */
    val bestPaceSecondsPerKm: Int?
        get() = countedRuns.mapNotNull { it.averagePaceSecondsPerKm.takeIf { pace -> pace > 0 } }.minOrNull()

    /**
     * Consecutive weeks ending with the current one that contain at least one run. A week the runner
     * has not finished yet does not break the streak, so an empty current week counts from last week.
     */
    val streakWeeks: Int
        get() {
            if (countedRuns.isEmpty()) return 0
            val zone = ZoneId.systemDefault()
            val weeks = countedRuns.mapNotNull { run ->
                runCatching { Instant.parse(run.startedAt).atZone(zone).toLocalDate() }
                    .getOrNull()
                    ?.with(WeekFields.ISO.dayOfWeek(), 1)
            }.toSet()
            if (weeks.isEmpty()) return 0
            var cursor = Instant.now().atZone(zone).toLocalDate()
                .with(WeekFields.ISO.dayOfWeek(), 1)
            if (cursor !in weeks) cursor = cursor.minusWeeks(1)
            var count = 0
            while (cursor in weeks) {
                count++
                cursor = cursor.minusWeeks(1)
            }
            return count
        }

    private fun thisWeek(): List<RunDto> {
        val zone = ZoneId.systemDefault()
        val field = WeekFields.ISO.weekOfWeekBasedYear()
        val now = Instant.now().atZone(zone)
        return countedRuns.filter { run ->
            val at = runCatching { Instant.parse(run.startedAt).atZone(zone) }.getOrNull() ?: return@filter false
            at.year == now.year && at.get(field) == now.get(field)
        }
    }

    private fun RunDto.isThisMonth(): Boolean {
        val zone = ZoneId.systemDefault()
        val at = runCatching { Instant.parse(startedAt).atZone(zone) }.getOrNull() ?: return false
        val now = Instant.now().atZone(zone)
        return at.year == now.year && at.monthValue == now.monthValue
    }
}

/**
 * Backs both the Runs overview and the history list — they are two views of one list, and giving
 * them separate view models would mean fetching twice and letting the two drift out of sync after
 * a save or delete.
 */
class RunsViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(RunsUiState())
    val state: StateFlow<RunsUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.list()) {
                is ApiResult.Success -> _state.update {
                    it.copy(runs = result.value.sortedByDescending { run -> run.startedAt }, loading = false, error = null)
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
        loadBadges()
        loadSafety()
    }

    private fun loadSafety() {
        viewModelScope.launch {
            val result = repository.coachSafety()
            if (result is ApiResult.Success) _state.update { it.copy(safetyAlert = result.value.alert) }
        }
    }

    fun confirmMedicalClearance() {
        if (_state.value.safetyClearing) return
        _state.update { it.copy(safetyClearing = true) }
        viewModelScope.launch {
            when (repository.clearCoachSafety()) {
                is ApiResult.Success -> _state.update { it.copy(safetyAlert = null, safetyClearing = false) }
                is ApiResult.Failure -> _state.update { it.copy(safetyClearing = false) }
            }
        }
    }

    /**
     * Achievements, fetched alongside the runs but never blocking them.
     *
     * Its own coroutine and its own failure handling: badges are an embellishment on a page whose
     * job is to show runs, so a slow or failing endpoint must not delay the list or turn the whole
     * screen into an error. A failure simply leaves the section out.
     */
    private fun loadBadges() {
        viewModelScope.launch {
            val result = repository.badges()
            if (result is ApiResult.Success) _state.update { it.copy(badges = result.value) }
        }
    }

    fun onQueryChange(query: String) = _state.update { it.copy(query = query) }

    fun onSourceFilterChange(filter: RunSourceFilter) = _state.update { it.copy(sourceFilter = filter) }

    fun toggleThisMonth() = _state.update { it.copy(thisMonthOnly = !it.thisMonthOnly) }

    fun onSportFilterChange(sport: String?) = _state.update { it.copy(sportFilter = sport) }

    fun clearFilters() = _state.update {
        it.copy(query = "", sourceFilter = RunSourceFilter.All, thisMonthOnly = false, sportFilter = null)
    }
}
