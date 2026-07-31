package dz.racedz.nativeapp.feature.runs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.RunDetailDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RunDetailUiState(
    val run: RunDetailDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
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
}
