package dz.racedz.nativeapp.feature.runs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
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

data class RunsUiState(
    val runs: List<RunDto> = emptyList(),
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    val query: String = "",
    val sourceFilter: RunSourceFilter = RunSourceFilter.All,
    val thisMonthOnly: Boolean = false,
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
                matchesQuery && matchesSource && (!thisMonthOnly || run.isThisMonth())
            }
        }

    val visibleDistanceKm: Double get() = visibleRuns.sumOf { it.distanceKm }

    val hasFilters: Boolean
        get() = query.isNotBlank() || sourceFilter != RunSourceFilter.All || thisMonthOnly

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
    val totalDistanceKm: Double get() = runs.sumOf { it.distanceKm }
    val longestRunKm: Double get() = runs.maxOfOrNull { it.distanceKm } ?: 0.0

    /** Fastest average pace, ignoring runs the server could not derive a pace for. */
    val bestPaceSecondsPerKm: Int?
        get() = runs.mapNotNull { it.averagePaceSecondsPerKm.takeIf { pace -> pace > 0 } }.minOrNull()

    /**
     * Consecutive weeks ending with the current one that contain at least one run. A week the runner
     * has not finished yet does not break the streak, so an empty current week counts from last week.
     */
    val streakWeeks: Int
        get() {
            if (runs.isEmpty()) return 0
            val zone = ZoneId.systemDefault()
            val weeks = runs.mapNotNull { run ->
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
        return runs.filter { run ->
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
    }

    fun onQueryChange(query: String) = _state.update { it.copy(query = query) }

    fun onSourceFilterChange(filter: RunSourceFilter) = _state.update { it.copy(sourceFilter = filter) }

    fun toggleThisMonth() = _state.update { it.copy(thisMonthOnly = !it.thisMonthOnly) }

    fun clearFilters() = _state.update {
        it.copy(query = "", sourceFilter = RunSourceFilter.All, thisMonthOnly = false)
    }
}
