package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.GuidedSessionDto
import dz.racedz.nativeapp.core.network.GuidedStepDto
import dz.racedz.nativeapp.core.network.WeatherDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StartRunUiState(
    val session: GuidedSessionDto? = null,
    val loading: Boolean = true,
    /** Live conditions for the start screen, or null while loading / when unavailable. */
    val weather: WeatherDto? = null,
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
                // A dropped request is not a missing plan: the server always has a session (an easy
                // run bookended by a warm-up and cool-down). Fall back to that same default locally
                // so a runner who taps "Guided" offline still gets spoken warm-up and cool-down
                // cues, instead of the guided card reading "unavailable" and recording a bare run.
                is ApiResult.Failure -> _state.update { it.copy(session = OFFLINE_GUIDED_SESSION, loading = false) }
            }
        }
    }

    /**
     * Loads live conditions for the start screen. Coordinates come from the runner's last known
     * position when location is already granted; passing null lets the server fall back to their
     * wilaya. A failure is silent — weather is a nicety, never a reason to hold up starting a run.
     */
    fun loadWeather(lat: Double?, lng: Double?) {
        viewModelScope.launch {
            when (val result = repository.weather(lat, lng)) {
                is ApiResult.Success -> _state.update { it.copy(weather = result.value) }
                is ApiResult.Failure -> Unit
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

/**
 * "10 min" or "400 m", whichever this step counts down.
 *
 * Counts go through [ZidRunFormat.count] rather than a `%d` placeholder: `%d` formats with the
 * *resource* locale, which for bare `ar` is Arabic-Indic (٤٠٠ م) — beside distances formatted
 * through [currentLocale]'s `ar-DZ` normalisation that put two numeral systems on one surface.
 */
@Composable
fun stepTargetLabel(step: GuidedStepDto): String {
    val seconds = step.seconds
    val meters = step.meters
    val locale = currentLocale()
    return when {
        seconds != null -> stringResource(R.string.runs_step_minutes, ZidRunFormat.count(seconds / 60, locale))
        meters != null -> stringResource(R.string.runs_step_metres, ZidRunFormat.count(meters, locale))
        else -> ""
    }
}
