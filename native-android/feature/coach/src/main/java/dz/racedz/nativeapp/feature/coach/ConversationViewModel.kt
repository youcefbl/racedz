package dz.racedz.nativeapp.feature.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.AskCoachRequest
import dz.racedz.nativeapp.core.network.CoachConversationDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ConversationUiState(
    val conversation: CoachConversationDto = CoachConversationDto(),
    val loading: Boolean = true,
    /** True from the moment the question is sent until the coach's reply comes back. */
    val generating: Boolean = false,
    /** Echoed locally so the question the runner just asked stays on screen while it is answered. */
    val pendingQuestion: String? = null,
    val error: ApiCallException? = null,
    val sendError: String? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
    val hasCoaching: Boolean get() = conversation.entitlement.tier != "NONE"

    /**
     * True when the runner arrived from a run's "Analyze run" and that run has not been analysed
     * yet. The analysis is offered, never taken automatically: it spends one of the runner's daily
     * coach messages, and spending it because they tapped through to a screen would be theft of a
     * credit they did not choose to use.
     */
    fun canAnalyseRun(runId: String?): Boolean =
        runId != null && hasCoaching && !generating && conversation.messages.none { it.runId == runId }
}

/**
 * The coach conversation.
 *
 * Sending is a single request that waits: the server generates the reply before responding, and the
 * 201 carries it. An earlier version of this class assumed generation was asynchronous and polled
 * the transcript for a `PENDING` row — but `getConversationHistory` only ever returns COMPLETED and
 * BLOCKED rows, so no pending row could exist, the poll always stopped on its first pass, and the
 * "generating" state never engaged. The question simply disappeared until the runner left and came
 * back. The state is local now, which is the only place it can honestly live.
 */
class ConversationViewModel(
    private val repository: CoachRepository,
    /** The run this conversation is about, when it was opened from "Analyze run". */
    val runId: String? = null,
) : ViewModel() {

    private val _state = MutableStateFlow(ConversationUiState())
    val state: StateFlow<ConversationUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.conversation()) {
                is ApiResult.Success -> _state.update {
                    it.copy(conversation = result.value, loading = false, error = null)
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    fun send(message: String) {
        val trimmed = message.trim()
        if (trimmed.isEmpty() || _state.value.generating) return

        _state.update { it.copy(generating = true, pendingQuestion = trimmed, sendError = null) }
        viewModelScope.launch {
            when (val result = repository.ask(AskCoachRequest(type = "CHAT", message = trimmed))) {
                is ApiResult.Success -> {
                    // Refetched rather than appended: the server decides what the transcript says,
                    // including whether the message was refused on safety grounds and what the reply
                    // is finally stored as.
                    reload()
                    _state.update { it.copy(generating = false, pendingQuestion = null) }
                }
                is ApiResult.Failure -> _state.update {
                    // The question is kept in [pendingQuestion] so the runner can see what they
                    // asked; the composer is re-enabled so they can retry.
                    it.copy(generating = false, sendError = result.error.message)
                }
            }
        }
    }

    /**
     * Asks the coach to review [runId].
     *
     * A POST_RUN interaction, not a chat message: the server builds a different context for it (the
     * run's splits, effort, and weather) and the reply is the post-run review the design flow
     * describes. Sending the same thing as free text would get an answer about running in general.
     */
    fun analyseRun() {
        val run = runId ?: return
        if (_state.value.generating) return
        _state.update { it.copy(generating = true, pendingQuestion = null, sendError = null) }
        viewModelScope.launch {
            when (val result = repository.ask(AskCoachRequest(type = "POST_RUN", runId = run))) {
                is ApiResult.Success -> {
                    reload()
                    _state.update { it.copy(generating = false) }
                }
                is ApiResult.Failure -> _state.update {
                    it.copy(generating = false, sendError = result.error.message)
                }
            }
        }
    }

    /** Clears a failed attempt once the runner has acknowledged it by typing again. */
    fun dismissSendError() {
        if (_state.value.sendError != null) _state.update { it.copy(sendError = null, pendingQuestion = null) }
    }

    private suspend fun reload() {
        when (val result = repository.conversation()) {
            is ApiResult.Success -> _state.update { it.copy(conversation = result.value, error = null) }
            is ApiResult.Failure -> Unit
        }
    }
}
