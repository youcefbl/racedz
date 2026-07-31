package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.LogSleepRequest
import dz.racedz.nativeapp.core.network.SleepEntryDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SleepUiState(
    val entries: List<SleepEntryDto> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: ApiCallException? = null,
    val saveError: String? = null,
    /** Set after a successful log so the form can confirm without a toast. */
    val savedAt: Long? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

class SleepViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(SleepUiState())
    val state: StateFlow<SleepUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.sleepHistory()) {
                is ApiResult.Success -> _state.update {
                    it.copy(entries = result.value.entries, loading = false, error = null)
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    fun log(hours: Double?, note: String?, onLogged: () -> Unit) {
        if (hours == null || _state.value.saving) return
        _state.update { it.copy(saving = true, saveError = null, savedAt = null) }
        viewModelScope.launch {
            when (val result = repository.logSleep(LogSleepRequest(durationHours = hours, note = note))) {
                is ApiResult.Success -> {
                    _state.update { it.copy(saving = false, savedAt = System.currentTimeMillis()) }
                    onLogged()
                    // Reload rather than prepending locally: the server owns the one-per-night rule,
                    // so a second entry for the same night replaces rather than adds.
                    load()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(saving = false, saveError = result.error.message)
                }
            }
        }
    }
}
