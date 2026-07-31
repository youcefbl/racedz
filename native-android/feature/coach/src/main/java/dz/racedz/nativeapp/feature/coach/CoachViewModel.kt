package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachOverviewDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CoachUiState(
    val overview: CoachOverviewDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline

    /**
     * Whether the runner has coaching. A NONE tier is a normal, successful response — the screen
     * shows the subscribe prompt rather than an error, because not having subscribed is not a fault.
     */
    val hasCoaching: Boolean get() = overview?.entitlement?.tier?.let { it != "NONE" } ?: false

    val isTrial: Boolean get() = overview?.entitlement?.tier == "TRIAL"
}

class CoachViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(CoachUiState())
    val state: StateFlow<CoachUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.overview()) {
                is ApiResult.Success -> _state.update { it.copy(overview = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }
}
