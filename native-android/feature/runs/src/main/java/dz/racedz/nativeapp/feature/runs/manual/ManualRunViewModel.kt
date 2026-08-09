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
 * rather than throwing away what was entered.
 *
 * The client id is minted once for this entry and reused on every retry — that is what makes a retry
 * after a lost response safe: if the first request reached the server but its reply was lost, the
 * second replays the same row instead of creating a duplicate (the server dedupes on clientId). A new
 * id is only ever minted for a fresh manual entry (a new screen/ViewModel).
 *
 * The server (runCreateSchema) is the authority on what is acceptable; the screen disables Save until
 * its own mirror of those bounds passes, so this only ever sends values that already look valid.
 */
class ManualRunViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(SaveRunUiState())
    val state: StateFlow<SaveRunUiState> = _state.asStateFlow()

    /** Stable for this entry so a lost-response retry replays rather than duplicates. */
    private val clientId: String = UUID.randomUUID().toString()

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
                clientId = clientId,
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
