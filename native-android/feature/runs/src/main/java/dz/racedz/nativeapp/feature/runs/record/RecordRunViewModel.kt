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

data class SaveRunUiState(
    val saving: Boolean = false,
    val error: String? = null,
    /** URLs of photos already stored on the server, in the order the runner picked them. */
    val photos: List<String> = emptyList(),
    /** True while at least one picked image is still being uploaded. */
    val uploadingPhotos: Boolean = false,
    /** Why the last photo did not upload, if it did not. Cleared on the next attempt. */
    val photoError: String? = null,
)

/** How many photos one run may carry. Matches the server's own cap (runPhotosSchema). */
const val MAX_RUN_PHOTOS = 6

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

    /**
     * Uploads picked images, one at a time, appending each URL as it lands.
     *
     * Uploading here rather than at save time is deliberate. A run's create request already carries
     * its whole route and must stay small enough to retry on a bad connection; bolting several
     * megabytes of JPEG onto it would put the run itself at the mercy of the photos. Sequential
     * rather than concurrent for the same reason — a phone on a weak mobile signal finishes four
     * uploads in a row far more reliably than four at once.
     *
     * A failure stops the batch and keeps whatever already uploaded. The runner can retry or simply
     * save without them; a photo is never worth blocking the run.
     */
    fun addPhotos(files: List<Pair<java.io.File, String>>) {
        if (files.isEmpty() || _state.value.uploadingPhotos) return
        _state.update { it.copy(uploadingPhotos = true, photoError = null) }
        viewModelScope.launch {
            for ((file, mimeType) in files) {
                if (_state.value.photos.size >= MAX_RUN_PHOTOS) break
                val result = repository.uploadPhoto(file, mimeType)
                // The picked image was copied into the cache to be uploaded; it has no reason to
                // survive the attempt either way.
                runCatching { file.delete() }
                if (result is ApiResult.Success) {
                    _state.update { it.copy(photos = it.photos + result.value.url) }
                } else if (result is ApiResult.Failure) {
                    _state.update { it.copy(photoError = result.error.message) }
                    break
                }
            }
            _state.update { it.copy(uploadingPhotos = false) }
        }
    }

    fun removePhoto(url: String) = _state.update { it.copy(photos = it.photos - url) }

    fun dismissPhotoError() = _state.update { it.copy(photoError = null) }

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
                photos = _state.value.photos.takeIf { it.isNotEmpty() },
                movingTimeSeconds = recording.movingSeconds.takeIf { it > 0 },
                elevationGainM = recording.elevationGainM.toInt().takeIf { it > 0 },
                route = recording.route.takeIf { it.size >= 2 },
                source = "GPS",
                // Carried from "Log this run" on the coach's plan. Dropping it here would be the
                // silent half of the bug: the run saves fine, but never counts toward the session.
                workoutId = recording.workoutId,
                // Lets the server tell a run from a ride; null on devices with no step counter.
                avgCadence = recording.avgCadenceSpm,
                // Coach questions asked mid-run, for the server to link to this run once it exists.
                coachInteractionIds = recording.askedCoachIds.takeIf { it.isNotEmpty() },
                // The summary screen's choice, from the recording state so a retry (or a restore
                // after process death) posts the same value. Never public for a flagged activity;
                // the server enforces the same rule.
                isPublic = recording.draftIsPublic && recording.nonFootReason == null,
                // Manual laps pressed during the run; the outbox carries the same list.
                laps = recording.laps.takeIf { it.isNotEmpty() },
            )

            when (val result = repository.create(request)) {
                is ApiResult.Success -> {
                    // Clears the outbox too: the server has it, so the local copy is no longer the
                    // only one. Nothing else is allowed to call this.
                    RunRecorder.reset()
                    // Otherwise the next free run would inherit this session's steps.
                    GuidedSessionController.clear()
                    _state.update { it.copy(saving = false, error = null) }
                    onSaved(result.value.id)
                }
                is ApiResult.Failure -> _state.update {
                    // Deliberately does NOT clear the recording or the outbox. The run is still on
                    // disk and still sendable; losing an hour's effort to a dropped request would be
                    // the worst thing this screen could do.
                    it.copy(saving = false, error = result.error.message)
                }
            }
        }
    }
}
