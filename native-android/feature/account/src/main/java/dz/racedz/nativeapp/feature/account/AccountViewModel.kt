package dz.racedz.nativeapp.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.AccountRepository
import dz.racedz.nativeapp.core.auth.SessionManager
import dz.racedz.nativeapp.core.auth.SignOutReason
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.DeviceSessionDto
import dz.racedz.nativeapp.core.network.PreferencesRequest
import dz.racedz.nativeapp.core.network.ProfileRequest
import dz.racedz.nativeapp.core.network.RegistrationDto
import dz.racedz.nativeapp.core.network.UserDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AccountUiState(
    val user: UserDto? = null,
    val registrations: List<RegistrationDto> = emptyList(),
    val devices: List<DeviceSessionDto> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: ApiCallException? = null,
    val toast: String? = null,
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

/**
 * Backs the Account tab and its sub-screens (profile & preferences, privacy & data, registrations).
 * One view model rather than four because they all read the same `/api/v1/me` snapshot and a save
 * on one screen should be visible on the others without a refetch.
 */
class AccountViewModel(
    private val repository: AccountRepository,
    private val session: SessionManager,
    /** Applies a saved theme/language to the running app. The server is still the source of truth;
     *  this just makes the change visible immediately instead of after the next launch. */
    private val applyAppearance: (theme: String?, language: String?) -> Unit,
    /** Clears device-local traces of the signed-out account (currently the theme mirror). */
    private val onSignedOutCleanup: () -> Unit,
) : ViewModel() {

    private val _state = MutableStateFlow(AccountUiState())
    val state: StateFlow<AccountUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            when (val profile = repository.profile()) {
                is ApiResult.Success -> {
                    _state.update { it.copy(user = profile.value, loading = false, error = null) }
                    // Reconcile with the account: the local mirror may be stale (theme changed on
                    // the website, or this is a fresh install). Language is left alone here —
                    // the OS locale is authoritative once set, and re-applying it would restart
                    // the Activity on every profile load.
                    applyAppearance(profile.value.preferences.theme, null)
                    loadRegistrations()
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = profile.error) }
            }
        }
    }

    fun loadRegistrations() {
        viewModelScope.launch {
            when (val result = repository.registrations()) {
                is ApiResult.Success -> _state.update { it.copy(registrations = result.value) }
                // A registrations failure must not blank the profile that already loaded; the
                // Account screen simply shows no "next race" card.
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun loadDevices() {
        viewModelScope.launch {
            when (val result = repository.devices()) {
                is ApiResult.Success -> _state.update { it.copy(devices = result.value) }
                is ApiResult.Failure -> _state.update { it.copy(error = result.error) }
            }
        }
    }

    fun saveProfile(request: ProfileRequest, savedMessage: String) {
        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null) }
            when (val result = repository.updateProfile(request)) {
                is ApiResult.Success -> _state.update {
                    it.copy(user = result.value, saving = false, toast = savedMessage)
                }
                is ApiResult.Failure -> _state.update { it.copy(saving = false, error = result.error) }
            }
        }
    }

    fun setTheme(theme: String, savedMessage: String) = savePreferences(PreferencesRequest(theme = theme), savedMessage)

    fun setLanguage(language: String, savedMessage: String) =
        savePreferences(PreferencesRequest(language = language), savedMessage)

    fun setProfilePrivate(private: Boolean, savedMessage: String) =
        savePreferences(PreferencesRequest(profilePrivate = private), savedMessage)

    private fun savePreferences(request: PreferencesRequest, savedMessage: String) {
        // Apply locally first so the switch/theme responds instantly; a failed save surfaces as an
        // error banner and the next load() reconciles with what the server actually stored.
        applyAppearance(request.theme, request.language)

        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null) }
            when (val result = repository.updatePreferences(request)) {
                is ApiResult.Success -> _state.update { current ->
                    current.copy(
                        saving = false,
                        toast = savedMessage,
                        user = current.user?.copy(preferences = result.value),
                    )
                }
                is ApiResult.Failure -> _state.update { it.copy(saving = false, error = result.error) }
            }
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            session.signOut(SignOutReason.UserAction)
            onSignedOutCleanup()
            onDone()
        }
    }

    fun signOutEverywhere(onDone: () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(saving = true) }
            repository.signOutEverywhere()
            onSignedOutCleanup()
            onDone()
        }
    }

    fun requestAccountDeletion(sentMessage: String) {
        viewModelScope.launch {
            _state.update { it.copy(saving = true, error = null) }
            when (val result = repository.requestAccountDeletion(null)) {
                is ApiResult.Success -> _state.update { it.copy(saving = false, toast = sentMessage) }
                is ApiResult.Failure -> _state.update { it.copy(saving = false, error = result.error) }
            }
        }
    }

    fun dismissToast() = _state.update { it.copy(toast = null) }
    fun dismissError() = _state.update { it.copy(error = null) }
}
