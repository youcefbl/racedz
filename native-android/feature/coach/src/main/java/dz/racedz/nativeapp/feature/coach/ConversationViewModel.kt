package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AskCoachRequest
import dz.racedz.nativeapp.core.network.CoachConversationDto
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ConversationUiState(
    val conversation: CoachConversationDto = CoachConversationDto(),
    val loading: Boolean = true,
    val sending: Boolean = false,
    val error: ApiCallException? = null,
    val sendError: String? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
    val hasCoaching: Boolean get() = conversation.entitlement.tier != "NONE"

    /** A reply still being generated. The composer stays disabled until it lands. */
    val awaitingReply: Boolean get() = conversation.messages.any { it.status == "PENDING" }
}

/**
 * The coach conversation.
 *
 * Replies are generated asynchronously, so sending is "accepted, not answered": after a successful
 * POST the transcript is polled until the PENDING row resolves. Polling rather than holding a
 * request open matters on a phone — a long-held connection dies the moment the screen sleeps, and
 * the runner would never see the answer they paid a credit for.
 */
class ConversationViewModel(private val repository: CoachRepository) : ViewModel() {

    private val _state = MutableStateFlow(ConversationUiState())
    val state: StateFlow<ConversationUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.conversation()) {
                is ApiResult.Success -> {
                    _state.update { it.copy(conversation = result.value, loading = false, error = null) }
                    if (result.value.messages.any { m -> m.status == "PENDING" }) pollForReply()
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    fun send(message: String) {
        val trimmed = message.trim()
        if (trimmed.isEmpty() || _state.value.sending) return

        _state.update { it.copy(sending = true, sendError = null) }
        viewModelScope.launch {
            when (val result = repository.ask(AskCoachRequest(type = "CHAT", message = trimmed))) {
                is ApiResult.Success -> {
                    _state.update { it.copy(sending = false) }
                    // Reload rather than appending locally: the server decides what the transcript
                    // says, including whether the message was blocked on safety grounds.
                    reload()
                    pollForReply()
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(sending = false, sendError = result.error.message)
                }
            }
        }
    }

    private suspend fun reload() {
        when (val result = repository.conversation()) {
            is ApiResult.Success -> _state.update { it.copy(conversation = result.value, error = null) }
            is ApiResult.Failure -> Unit
        }
    }

    /**
     * Polls until the pending reply resolves, then stops.
     *
     * Bounded: generation that has not finished in about a minute has almost certainly failed, and
     * a poll loop with no ceiling would keep waking the radio for as long as the screen is open.
     */
    private fun pollForReply() {
        viewModelScope.launch {
            repeat(MAX_POLLS) {
                delay(POLL_INTERVAL_MS)
                reload()
                if (!_state.value.awaitingReply) return@launch
            }
        }
    }

    private companion object {
        const val POLL_INTERVAL_MS = 3_000L
        const val MAX_POLLS = 20
    }
}
