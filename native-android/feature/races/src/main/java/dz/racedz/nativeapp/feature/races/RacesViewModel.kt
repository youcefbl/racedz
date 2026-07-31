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

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            when (val result = repository.detail(idOrSlug)) {
                is ApiResult.Success -> _state.update { it.copy(race = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }
}
