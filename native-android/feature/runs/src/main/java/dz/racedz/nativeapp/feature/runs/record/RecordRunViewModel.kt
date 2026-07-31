package dz.racedz.nativeapp.feature.runs.record

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRunRequest
import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SaveRunUiState(val saving: Boolean = false, val error: String? = null)

/**
 * Saves a finished recording.
 *
 * The recorder's `clientId` is reused on every attempt rather than regenerated, which is what makes
 * a retry safe: if the first request reached the server but its response was lost, the second gets
 * the original run back instead of creating a duplicate.
 *
 * On failure the recording is deliberately NOT cleared. The runner still has their run, and can try
 * again once they have signal — losing an hour's effort to a dropped request would be the worst
 * thing this screen could do.
 */
class RecordRunViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(SaveRunUiState())
    val state: StateFlow<SaveRunUiState> = _state.asStateFlow()

    fun save(
        title: String? = null,
        notes: String? = null,
        perceivedEffort: Int = 5,
        onSaved: (String) -> Unit,
    ) {
        val recording = RunRecorder.state.value
        if (_state.value.saving) return

        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val request = CreateRunRequest(
                clientId = recording.clientId,
                startedAt = Instant.ofEpochMilli(recording.startedAtEpochMs).toString(),
                distanceKm = recording.distanceKm,
                durationSeconds = recording.elapsedSeconds.coerceAtLeast(1),
                perceivedEffort = perceivedEffort,
                title = title,
                notes = notes,
                movingTimeSeconds = recording.movingSeconds.takeIf { it > 0 },
                elevationGainM = recording.elevationGainM.toInt().takeIf { it > 0 },
                route = recording.route.takeIf { it.size >= 2 },
                source = "GPS",
            )

            when (val result = repository.create(request)) {
                is ApiResult.Success -> {
                    RunRecorder.reset()
                    // Otherwise the next free run would inherit this session's steps.
                    GuidedSessionController.clear()
                    _state.update { it.copy(saving = false, error = null) }
                    onSaved(result.value.id)
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(saving = false, error = result.error.message)
                }
            }
        }
    }
}
