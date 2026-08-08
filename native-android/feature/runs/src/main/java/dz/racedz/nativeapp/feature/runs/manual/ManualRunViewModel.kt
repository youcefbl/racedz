package dz.racedz.nativeapp.feature.runs.manual

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.feature.runs.record.SaveRunUiState
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Saves a run the runner typed in by hand — no GPS, no route (NATRUN-01).
 *
 * Mirrors [dz.racedz.nativeapp.feature.runs.record.RecordRunViewModel]: a single saving flag guards
 * against a double tap, and a failed request leaves the form untouched with an error to retry from,
 * rather than throwing away what was entered. A fresh [UUID] per attempt is fine here — unlike a
 * recorded run there is no half-sent copy on disk to reconcile against, so each Save is its own
 * create.
 *
 * The server (runCreateSchema) is the authority on what is acceptable; the screen disables Save until
 * its own mirror of those bounds passes, so this only ever sends values that already look valid.
 */
class ManualRunViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(SaveRunUiState())
    val state: StateFlow<SaveRunUiState> = _state.asStateFlow()

    fun save(
        title: String?,
        startedAtEpochMs: Long,
        distanceKm: Double,
        durationSeconds: Int,
        perceivedEffort: Int,
        notes: String?,
        onSaved: (String) -> Unit,
    ) {
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            val request = CreateRunRequest(
                clientId = UUID.randomUUID().toString(),
                startedAt = Instant.ofEpochMilli(startedAtEpochMs).toString(),
                distanceKm = distanceKm,
                durationSeconds = durationSeconds,
                perceivedEffort = perceivedEffort,
                title = title,
                notes = notes,
                // No route: a hand-entered run has no GPS trace, which is exactly what MANUAL means
                // to the server.
                source = "MANUAL",
            )

            when (val result = repository.create(request)) {
                is ApiResult.Success -> {
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
