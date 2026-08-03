package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CoachMemoryActionRequest
import dz.racedz.nativeapp.core.network.CoachMemoryItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CoachMemoryUiState(
    val items: List<CoachMemoryItemDto> = emptyList(),
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    /** The id whose confirm/forget call is in flight, so only that row shows as busy. */
    val pendingId: String? = null,
    val actionError: String? = null,
    val deleting: Boolean = false,
    /** Set after a successful delete-all so the screen can confirm without a toast. */
    val deletedAt: Long? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

class CoachMemoryViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(CoachMemoryUiState())
    val state: StateFlow<CoachMemoryUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.memory()) {
                is ApiResult.Success -> _state.update {
                    it.copy(items = result.value.items, loading = false, error = null)
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    /** "Still true" — resets the fact's staleness clock server-side. */
    fun confirm(id: String) = act(id, "confirm")

    /** "Forget" — dismisses the fact; the server guarantees it is never re-learned automatically. */
    fun forget(id: String) = act(id, "dismiss")

    private fun act(id: String, action: String) {
        if (_state.value.pendingId != null || _state.value.deleting) return
        _state.update { it.copy(pendingId = id, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.memoryAction(CoachMemoryActionRequest(id = id, action = action))) {
                is ApiResult.Success -> {
                    _state.update { it.copy(pendingId = null) }
                    // Reload rather than mutating locally: what stays remembered (and each fact's
                    // freshness) is the server's call, and the list is small.
                    load()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(pendingId = null, actionError = result.error.message)
                }
            }
        }
    }

    fun deleteAll(onDeleted: () -> Unit) {
        if (_state.value.deleting || _state.value.pendingId != null) return
        _state.update { it.copy(deleting = true, actionError = null) }
        viewModelScope.launch {
            when (val result = repository.deleteMemory()) {
                is ApiResult.Success -> {
                    _state.update {
                        it.copy(deleting = false, items = emptyList(), deletedAt = System.currentTimeMillis())
                    }
                    onDeleted()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(deleting = false, actionError = result.error.message)
                }
            }
        }
    }
}
