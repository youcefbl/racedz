package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachPlanWeekDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PlanWeekUiState(
    val week: CoachPlanWeekDto = CoachPlanWeekDto(),
    val loading: Boolean = true,
    val error: ApiCallException? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

class PlanWeekViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(PlanWeekUiState())
    val state: StateFlow<PlanWeekUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.planWeek()) {
                is ApiResult.Success -> _state.update { it.copy(week = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }
}
