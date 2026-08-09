package dz.racedz.nativeapp.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.AccountRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.NotificationDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotificationsUiState(
    val notifications: List<NotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

/** Backs the notification inbox and the unread badge on the Account tab. */
class NotificationsViewModel(private val repository: AccountRepository) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    /*
     * Deliberately no `init { load() }`.
     *
     * This is created by the app shell, which exists before anyone has signed in, so loading on
     * construction fired an unauthenticated request and — worse — left whatever it loaded in place
     * across a sign-out. The caller loads it when there is a session, and the instance is keyed by
     * account so one runner's inbox can never be shown to the next.
     */

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            when (val result = repository.notifications()) {
                is ApiResult.Success -> _state.update {
                    it.copy(
                        notifications = result.value.notifications,
                        unreadCount = result.value.unreadCount,
                        loading = false,
                        error = null,
                    )
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }

    /**
     * Opens one notification: marked read locally at once, then confirmed with the server.
     *
     * Optimistic on purpose. The runner is navigating away as they tap, so waiting for a round trip
     * would leave the row looking unread for the moment they can still see it — and the reload on
     * the next resume reconciles anything the request got wrong.
     */
    fun open(id: String) {
        val current = _state.value
        if (current.notifications.none { it.id == id && !it.read }) return
        _state.update { state ->
            state.copy(
                notifications = state.notifications.map { if (it.id == id) it.copy(read = true) else it },
                unreadCount = (state.unreadCount - 1).coerceAtLeast(0),
            )
        }
        viewModelScope.launch { repository.markNotificationRead(id) }
    }

    fun markAllRead() {
        if (_state.value.unreadCount == 0) return
        _state.update { state ->
            state.copy(
                notifications = state.notifications.map { it.copy(read = true) },
                unreadCount = 0,
            )
        }
        viewModelScope.launch {
            // Reload rather than trusting the local sweep: a notification that arrived between the
            // tap and the request is still unread, and only the server knows that.
            if (repository.markAllNotificationsRead()) load()
        }
    }
}
