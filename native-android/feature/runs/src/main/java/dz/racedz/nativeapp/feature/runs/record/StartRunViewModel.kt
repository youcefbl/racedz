package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.GuidedSessionDto
import dz.racedz.nativeapp.core.network.GuidedStepDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StartRunUiState(
    val session: GuidedSessionDto? = null,
    val loading: Boolean = true,
)

/**
 * Fetches the guided session up front so the runner can see what it asks of them before choosing it.
 *
 * A failure is silent: the session is simply absent, the guided card says so, and starting still
 * works as a free run. Being unable to reach the server is not a reason to stop someone running.
 */
class StartRunViewModel(private val repository: RunsRepository) : ViewModel() {

    private val _state = MutableStateFlow(StartRunUiState())
    val state: StateFlow<StartRunUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = repository.guidedSession()) {
                is ApiResult.Success -> _state.update { it.copy(session = result.value, loading = false) }
                is ApiResult.Failure -> _state.update { it.copy(session = null, loading = false) }
            }
        }
    }
}

/** Human label for a step's role, e.g. "Warm up". */
@Composable
fun stepRoleLabel(role: String): String = when (role) {
    "WARMUP" -> stringResource(R.string.runs_step_warmup)
    "WORK" -> stringResource(R.string.runs_step_work)
    "RECOVERY" -> stringResource(R.string.runs_step_recovery)
    "COOLDOWN" -> stringResource(R.string.runs_step_cooldown)
    else -> stringResource(R.string.runs_step_steady)
}

/** "10 min" or "400 m", whichever this step counts down. */
@Composable
fun stepTargetLabel(step: GuidedStepDto): String {
    val seconds = step.seconds
    val meters = step.meters
    return when {
        seconds != null -> stringResource(R.string.runs_step_minutes, seconds / 60)
        meters != null -> stringResource(R.string.runs_step_metres, meters)
        else -> ""
    }
}
