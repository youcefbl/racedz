package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachOnboardingStateDto
import dz.racedz.nativeapp.core.network.CreateCoachGoalRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CoachOnboardingUiState(
    val gaps: CoachOnboardingStateDto = CoachOnboardingStateDto(),
    val loading: Boolean = true,
    val submitting: Boolean = false,
    val error: String? = null,
)

/**
 * Backs the coach onboarding form.
 *
 * Asks the server what it still needs before drawing anything: sex and birth date live on the User
 * record, so a runner who already gave them to the website is not asked again.
 */
class CoachOnboardingViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(CoachOnboardingUiState())
    val state: StateFlow<CoachOnboardingUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = repository.onboardingState()) {
                is ApiResult.Success -> _state.update { it.copy(gaps = result.value, loading = false) }
                // A failure here only costs us the ability to skip questions, so ask them all
                // rather than blocking the form.
                is ApiResult.Failure -> _state.update {
                    it.copy(gaps = CoachOnboardingStateDto(needsSex = true, needsBirthDate = true), loading = false)
                }
            }
        }
    }

    /**
     * Saves the form.
     *
     * [editing] picks between two genuinely different server behaviours: creating a goal supersedes
     * the active plan, editing one leaves it in place. Sending the same body down the wrong path
     * would silently throw away the week the runner is in.
     */
    fun submit(request: CreateCoachGoalRequest, editing: Boolean = false, onCreated: () -> Unit) {
        if (_state.value.submitting) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            val call = if (editing) repository.updateGoal(request) else repository.createGoal(request)
            when (val result = call) {
                is ApiResult.Success -> {
                    _state.update { it.copy(submitting = false, error = null) }
                    onCreated()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(submitting = false, error = result.error.message)
                }
            }
        }
    }
}
