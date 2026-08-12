package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachOverviewDto
import dz.racedz.nativeapp.core.network.CoachSafetyAlertDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CoachUiState(
    val overview: CoachOverviewDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    val safetyAlert: CoachSafetyAlertDto? = null,
    val safetyClearing: Boolean = false,
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
        fetch(showSpinner = true)
        fetchSafety()
    }

    /**
     * Re-reads the overview without blanking the screen.
     *
     * Called when the tab comes back to the foreground, which is what makes finishing onboarding
     * (or skipping a workout, or logging a run) show up. Without it the view model loaded once when
     * the tab was first composed and never again — so a runner who completed setup came back to the
     * very "Set up your coach" prompt they had just finished, and the only way out was to kill the
     * app. A spinner would be its own bug here: the screen already has correct content, and
     * replacing it with a loader on every resume makes the tab flicker.
     */
    fun refresh() {
        fetch(showSpinner = _state.value.overview == null)
        fetchSafety()
    }

    private fun fetchSafety() {
        viewModelScope.launch {
            val result = repository.safety()
            if (result is ApiResult.Success) _state.update { it.copy(safetyAlert = result.value.alert) }
        }
    }

    fun confirmMedicalClearance() {
        if (_state.value.safetyClearing) return
        _state.update { it.copy(safetyClearing = true) }
        viewModelScope.launch {
            when (repository.clearSafety()) {
                is ApiResult.Success -> _state.update { it.copy(safetyAlert = null, safetyClearing = false) }
                is ApiResult.Failure -> _state.update { it.copy(safetyClearing = false) }
            }
        }
    }

    private fun fetch(showSpinner: Boolean) {
        if (showSpinner) _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.overview()) {
                is ApiResult.Success -> _state.update { it.copy(overview = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update {
                    // A refresh that fails leaves the last good overview on screen rather than
                    // replacing a working dashboard with an error the runner did not ask for.
                    if (it.overview != null) it.copy(loading = false) else it.copy(loading = false, error = result.error)
                }
            }
        }
    }
}
