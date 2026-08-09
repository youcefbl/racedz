package dz.racedz.nativeapp.feature.races

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RacesRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.RaceDetailDto
import dz.racedz.nativeapp.core.network.RaceSummaryDto
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RacesUiState(
    val races: List<RaceSummaryDto> = emptyList(),
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val refreshing: Boolean = false,
    val error: ApiCallException? = null,
    val query: String = "",
    val wilaya: String? = null,
    val page: Int = 1,
    val hasMore: Boolean = false,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
    val isEmpty: Boolean get() = !loading && error == null && races.isEmpty()
    val hasFilters: Boolean get() = query.isNotBlank() || wilaya != null
}

class RacesViewModel(private val repository: RacesRepository) : ViewModel() {

    private val _state = MutableStateFlow(RacesUiState())
    val state: StateFlow<RacesUiState> = _state.asStateFlow()

    /** Cancelled and restarted on every keystroke so only the last query reaches the network. */
    private var searchJob: Job? = null

    init {
        load(page = 1)
    }

    fun onQueryChange(value: String) {
        _state.update { it.copy(query = value) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            // Debounce: typing "Algiers" is one request, not seven.
            delay(SEARCH_DEBOUNCE_MS)
            load(page = 1)
        }
    }

    fun onWilayaChange(wilaya: String?) {
        _state.update { it.copy(wilaya = wilaya) }
        load(page = 1)
    }

    fun clearFilters() {
        searchJob?.cancel()
        _state.update { it.copy(query = "", wilaya = null) }
        load(page = 1)
    }

    fun refresh() = load(page = 1, refreshing = true)

    fun retry() = load(page = 1)

    /** Called when the list reaches its end. Ignored while a page is already in flight. */
    fun loadNextPage() {
        val snapshot = _state.value
        if (snapshot.loading || snapshot.loadingMore || !snapshot.hasMore) return
        load(page = snapshot.page + 1)
    }

    private fun load(page: Int, refreshing: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    loading = page == 1 && !refreshing && it.races.isEmpty(),
                    refreshing = refreshing,
                    loadingMore = page > 1,
                    error = if (page == 1) null else it.error,
                )
            }

            val snapshot = _state.value
            when (val result = repository.list(page = page, query = snapshot.query, wilaya = snapshot.wilaya)) {
                is ApiResult.Success -> _state.update { current ->
                    current.copy(
                        // Page 1 replaces (a new search); later pages append.
                        races = if (page == 1) result.value else current.races + result.value,
                        loading = false,
                        loadingMore = false,
                        refreshing = false,
                        error = null,
                        page = page,
                        hasMore = result.meta?.hasMore ?: false,
                    )
                }
                is ApiResult.Failure -> _state.update { current ->
                    current.copy(
                        loading = false,
                        loadingMore = false,
                        refreshing = false,
                        // A failed "load more" keeps the pages already on screen — losing them
                        // would punish the user for scrolling.
                        error = if (page == 1) result.error else current.error,
                    )
                }
            }
        }
    }

    private companion object {
        const val SEARCH_DEBOUNCE_MS = 350L
    }
}

data class RaceDetailUiState(
    val race: RaceDetailDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    /** True while the report sheet is open. */
    val reporting: Boolean = false,
    val submittingReport: Boolean = false,
    /** Why the last report was refused ("already reported", for instance), or null. */
    val reportError: String? = null,
    /** Set once a report is accepted, so the sheet can close on a confirmation. */
    val reportSent: Boolean = false,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
    val notFound: Boolean get() = error?.code == ApiErrorCode.NotFound
}

class RaceDetailViewModel(
    private val repository: RacesRepository,
    private val idOrSlug: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RaceDetailUiState())
    val state: StateFlow<RaceDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun openReport() = _state.update { it.copy(reporting = true, reportError = null, reportSent = false) }

    fun dismissReport() = _state.update { it.copy(reporting = false, reportError = null) }

    fun acknowledgeReportSent() = _state.update { it.copy(reportSent = false) }

    /**
     * Files a moderation report against this race.
     *
     * The server's message is surfaced rather than replaced: "you have already reported this" and
     * "this race no longer exists" are different facts, and a generic failure would leave the
     * reporter unsure whether to try again.
     */
    fun submitReport(category: String, details: String?) {
        val raceId = _state.value.race?.id ?: return
        if (_state.value.submittingReport) return
        _state.update { it.copy(submittingReport = true, reportError = null) }
        viewModelScope.launch {
            when (val result = repository.report(raceId, category, details)) {
                is ApiResult.Success -> _state.update {
                    it.copy(submittingReport = false, reporting = false, reportSent = true)
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(submittingReport = false, reportError = result.error.message)
                }
            }
        }
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            when (val result = repository.detail(idOrSlug)) {
                is ApiResult.Success -> _state.update { it.copy(race = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    /**
     * Refetches in place, keeping whatever is already on screen. Coming back from a finished
     * registration left the stale "Register" call to action on a race the runner had just entered,
     * and tapping it started a second entry; but a resume must not flash the page spinner or
     * replace a good screen with an error just because the refetch failed.
     */
    fun reload() {
        viewModelScope.launch {
            when (val result = repository.detail(idOrSlug)) {
                is ApiResult.Success -> _state.update { it.copy(race = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { if (it.race != null) it else it.copy(error = result.error) }
            }
        }
    }
}
