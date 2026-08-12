package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachPlanWeekDto
import dz.racedz.nativeapp.core.network.CoachSafetyAlertDto
import dz.racedz.nativeapp.core.network.WorkoutActionRequest
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PlanWeekUiState(
    val week: CoachPlanWeekDto = CoachPlanWeekDto(),
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    /** The workout a skip/move is currently in flight for, so only its own row shows a spinner. */
    val pendingWorkoutId: String? = null,
    val actionError: String? = null,
    /** Set for one read after a change lands, so the screen can confirm what actually happened. */
    val confirmation: PlanChange? = null,
    val safetyAlert: CoachSafetyAlertDto? = null,
    val safetyClearing: Boolean = false,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

/** What just changed, for the confirmation message. */
enum class PlanChange { Skipped, Moved }

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

    /**
     * "I can't today". The reason is optional — being made to justify a missed session before you
     * are allowed to skip it is the pressure the design flow explicitly rules out.
     */
    fun skip(workoutId: String, reason: String?) =
        mutate(workoutId, WorkoutActionRequest(action = "skip", reason = reason), PlanChange.Skipped)

    /** "Move" — to a day the server will accept, which is why the picker is built from the plan. */
    fun move(workoutId: String, scheduledFor: Instant) = mutate(
        workoutId,
        WorkoutActionRequest(action = "reschedule", scheduledFor = scheduledFor.toString()),
        PlanChange.Moved,
    )

    fun dismissActionError() = _state.update { it.copy(actionError = null) }

    fun consumeConfirmation() = _state.update { it.copy(confirmation = null) }

    /**
     * Nothing is applied locally first.
     *
     * An optimistic tick would have to be rolled back on failure, and a plan that appears to change
     * and then changes back is worse than one that takes a moment: the runner cannot tell whether
     * the session is skipped or not. So the week is reloaded from the server and whatever it says
     * is what the screen shows.
     */
    private fun mutate(workoutId: String, request: WorkoutActionRequest, change: PlanChange) {
        if (_state.value.pendingWorkoutId != null) return
        _state.update { it.copy(pendingWorkoutId = workoutId, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.workoutAction(workoutId, request)) {
                is ApiResult.Success -> {
                    reload()
                    _state.update { it.copy(pendingWorkoutId = null, confirmation = change) }
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(pendingWorkoutId = null, actionError = result.error.message)
                }
            }
        }
    }

    private suspend fun reload() {
        when (val result = repository.planWeek()) {
            is ApiResult.Success -> _state.update { it.copy(week = result.value, error = null) }
            is ApiResult.Failure -> Unit
        }
    }
}
