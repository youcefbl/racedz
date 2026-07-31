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
import java.util.Locale
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

    /** This calendar week's totals, for the overview ring. Local week, matching the runner's own. */
    val weekDistanceKm: Double get() = thisWeek().sumOf { it.distanceKm }
    val weekRunCount: Int get() = thisWeek().size
    val weekDurationSeconds: Int get() = thisWeek().sumOf { it.durationSeconds }

    private fun thisWeek(): List<RunDto> {
        val zone = ZoneId.systemDefault()
        val field = WeekFields.of(Locale.getDefault()).weekOfWeekBasedYear()
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
