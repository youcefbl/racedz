package dz.racedz.nativeapp.feature.runs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.RunDetailDto
import dz.racedz.nativeapp.core.network.UpdateRunRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RunDetailUiState(
    val run: RunDetailDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    /** A privacy change or a delete is in flight; both controls wait for it. */
    val mutating: Boolean = false,
    val actionError: String? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

/**
 * Loads one run with its derived metrics.
 *
 * Splits, the pace series, and the elevation series arrive from the server (src/lib/coach/run-stats.ts,
 * covered by test:run-stats) rather than being recomputed here. An earlier native version derived
 * splits on the phone and got them wrong — it charged each kilometre for the segment that overshot
 * its boundary instead of interpolating the crossing, so every split drifted and the error
 * compounded. One implementation also means the phone and the website can never disagree about the
 * same run.
 */
class RunDetailViewModel(
    private val repository: RunsRepository,
    private val runId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RunDetailUiState())
    val state: StateFlow<RunDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.detail(runId)) {
                is ApiResult.Success -> _state.update { it.copy(run = result.value, loading = false, error = null) }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    /**
     * Publishes or unpublishes the run.
     *
     * `baseRevision` is the revision this screen is looking at, so an edit made from another device
     * in the meantime is refused rather than silently overwritten — and unpublishing in particular
     * must not be lost, because it is the control a runner reaches for when a route is out in public
     * that should not be.
     */
    fun setPublic(isPublic: Boolean) {
        val current = _state.value.run ?: return
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            val result = repository.update(
                runId,
                UpdateRunRequest(baseRevision = current.revision, isPublic = isPublic),
            )
            when (result) {
                // The server's row wins, not the value that was asked for: it carries the new
                // revision the next edit has to quote.
                is ApiResult.Success -> {
                    _state.update { it.copy(mutating = false) }
                    load()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(mutating = false, actionError = result.error.message)
                }
            }
        }
    }

    /**
     * Accepts the suggested link between this run and a planned session.
     *
     * Reloads rather than patching state locally: confirming also flips the workout to COMPLETED
     * and recomputes adherence server-side, so the screen should show what the server now holds
     * rather than an optimistic guess at it.
     */
    fun confirmWorkoutMatch(workoutId: String) {
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.confirmWorkoutMatch(runId, workoutId)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(mutating = false) }
                    load()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(mutating = false, actionError = result.error.message)
                }
            }
        }
    }

    /** "It was a free run": detaches this run from its workout and reopens that session. */
    fun unlinkWorkoutMatch() {
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.unlinkWorkoutMatch(runId)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(mutating = false) }
                    load()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(mutating = false, actionError = result.error.message)
                }
            }
        }
    }

    /** Deletes the run. [onDeleted] runs only after the server has actually accepted it. */
    fun delete(onDeleted: () -> Unit) {
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.delete(runId)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(mutating = false) }
                    onDeleted()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(mutating = false, actionError = result.error.message)
                }
            }
        }
    }
}
