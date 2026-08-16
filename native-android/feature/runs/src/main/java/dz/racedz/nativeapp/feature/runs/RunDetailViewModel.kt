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
    /** The edit sheet's own error, kept apart from [actionError] so it shows inside the sheet. */
    val editError: String? = null,
    /** Field-level messages from a 422, keyed by request field (`title`, `notes`, `perceivedEffort`). */
    val editFieldErrors: Map<String, String> = emptyMap(),
    /**
     * Set when the last edit was refused because the run had moved on (409). The run is reloaded so
     * the screen shows the newer version, and the sheet stays open with the runner's text so they
     * can decide what to keep — a silent overwrite of the other device's edit is the one outcome
     * this must never produce.
     */
    val editConflict: Boolean = false,
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
            // Splits arrive per the account's unit (NATRUN-06.8); everything else stays metric and is
            // converted for display only.
            val unit = dz.racedz.nativeapp.core.design.ZidRunUnits.current.code
            when (val result = repository.detail(runId, unit)) {
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
     * Edits title, notes and effort after the fact (NATRUN-06.2).
     *
     * Same `baseRevision` rule as [setPublic]: the revision on screen is quoted, and a 409 means
     * another device got there first. On success the server's row is reloaded (it carries the new
     * revision) and [onSaved] fires so the sheet can close; on failure the sheet stays open with
     * the message and, for a conflict, the run underneath is refreshed.
     *
     * Empty title/notes are sent as null so a cleared field actually clears on the server rather
     * than being ignored as "unchanged".
     */
    fun editDetails(title: String, notes: String, perceivedEffort: Int, onSaved: () -> Unit) {
        val current = _state.value.run ?: return
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, editError = null, editFieldErrors = emptyMap(), editConflict = false) }
        viewModelScope.launch {
            val result = repository.update(
                runId,
                UpdateRunRequest(
                    baseRevision = current.revision,
                    title = title.trim().take(120),
                    notes = notes.trim().take(2000),
                    perceivedEffort = perceivedEffort.coerceIn(1, 10),
                ),
            )
            when (result) {
                is ApiResult.Success -> {
                    // Reload rather than patch: the detail DTO carries derived series the update
                    // response does not, and the new revision has to come from the server's row.
                    _state.update { it.copy(mutating = false) }
                    load()
                    onSaved()
                }
                is ApiResult.Failure -> {
                    val conflict = result.error.code == ApiErrorCode.Conflict
                    _state.update {
                        it.copy(
                            mutating = false,
                            editError = result.error.message,
                            editFieldErrors = result.error.fieldErrors,
                            editConflict = conflict,
                        )
                    }
                    if (conflict) load()
                }
            }
        }
    }

    fun clearEditError() = _state.update { it.copy(editError = null, editFieldErrors = emptyMap(), editConflict = false) }

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

    /**
     * Writes the run's GPX to a private cache file and hands the caller its path to share.
     *
     * On-device rather than the old signed web handoff, which bounced the runner into a browser to
     * receive a download they then had to find again. Same cacheDir/export subtree the data export
     * uses, so the existing FileProvider grant covers it and nothing new is exposed.
     */
    fun exportGpx(cacheDir: java.io.File, failedMessage: String, onReady: (java.io.File) -> Unit) {
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            val bytes = repository.runGpx(runId)
            val file = bytes?.let {
                runCatching {
                    val directory = java.io.File(cacheDir, "export").apply { mkdirs() }
                    // Named as the server names it, so an app export and a web export of the same
                    // run land as the same filename rather than two mystery files.
                    java.io.File(directory, "zidrun-${runId.take(6)}.gpx").apply { writeBytes(it) }
                }.getOrNull()
            }
            _state.update { it.copy(mutating = false, actionError = if (file == null) failedMessage else null) }
            if (file != null) onReady(file)
        }
    }

    /**
     * Renders the share card to a private cache file (NATRUN-06.9) and hands it to [onReady] for the
     * system share sheet. Off the main thread inside the renderer; failures surface in the sheet.
     */
    fun renderShareImage(
        context: android.content.Context,
        mode: dz.racedz.nativeapp.core.design.ZidRunThemeMode,
        includeRoute: Boolean,
        stats: dz.racedz.nativeapp.feature.runs.share.RunShareImage.Stats,
        failedMessage: String,
        onReady: (java.io.File) -> Unit,
    ) {
        val run = _state.value.run ?: return
        if (_state.value.mutating) return
        _state.update { it.copy(mutating = true, actionError = null) }
        viewModelScope.launch {
            val file = runCatching {
                dz.racedz.nativeapp.feature.runs.share.RunShareImage.render(
                    context.applicationContext, mode, run.route, includeRoute, stats, run.id.take(8),
                )
            }.getOrNull()
            _state.update { it.copy(mutating = false, actionError = if (file == null) failedMessage else null) }
            if (file != null) onReady(file)
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
