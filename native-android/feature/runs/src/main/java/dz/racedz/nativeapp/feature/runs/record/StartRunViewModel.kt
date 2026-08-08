package dz.racedz.nativeapp.feature.runs.record

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.CoachRepository
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
    /** The city/town the runner is in, reverse-geocoded from their fix; null when unknown. */
    val placeName: String? = null,
    /** The workout type the runner picked on a Free run, or null for a plain free run. */
    val selectedType: String? = null,
    /** The structure for [selectedType], used to audio-guide a Free run; null for a plain free run. */
    val freeStructure: GuidedSessionDto? = null,
    val structureLoading: Boolean = false,
    /** The tunable values for [selectedType], keyed as the server expects them (reps, repMeters…). */
    val typeParams: Map<String, Int> = emptyMap(),
    /**
     * Whether the runner may pick and customize a guided workout type. Structured guided workouts
     * are a subscriber feature; everyone else can still run Free, so the chips are shown disabled
     * with a prompt to subscribe rather than hidden.
     */
    val canCustomize: Boolean = false,
    val entitlementKnown: Boolean = false,
)

/** One adjustable value on a workout type: bounds and the step for the +/- control. */
data class WorkoutParamSpec(val key: String, val min: Int, val max: Int, val step: Int, val default: Int)

/**
 * The tunables each workout type exposes, mirroring the server's GUIDED_SESSION_TEMPLATES so the
 * +/- controls match exactly what the endpoint will clamp to. Order is display order.
 */
val WORKOUT_TYPE_PARAMS: Map<String, List<WorkoutParamSpec>> = mapOf(
    "long_run" to listOf(WorkoutParamSpec("distanceKm", 6, 32, 1, 12)),
    "intervals" to listOf(
        WorkoutParamSpec("reps", 4, 10, 1, 6),
        WorkoutParamSpec("repMeters", 200, 1000, 100, 400),
        WorkoutParamSpec("recoverySeconds", 30, 180, 15, 90),
    ),
    "strides" to listOf(
        WorkoutParamSpec("easyMinutes", 10, 40, 5, 20),
        WorkoutParamSpec("reps", 4, 8, 1, 6),
        WorkoutParamSpec("recoverySeconds", 30, 120, 15, 60),
    ),
    "norwegian" to listOf(
        WorkoutParamSpec("reps", 3, 5, 1, 4),
        WorkoutParamSpec("workMinutes", 3, 6, 1, 4),
        WorkoutParamSpec("recoverySeconds", 60, 300, 30, 180),
    ),
)

/**
 * Fetches the guided session up front so the runner can see what it asks of them before choosing it.
 *
 * A failure is silent: the session is simply absent, the guided card says so, and starting still
 * works as a free run. Being unable to reach the server is not a reason to stop someone running.
 */
class StartRunViewModel(
    private val repository: RunsRepository,
    private val coach: CoachRepository,
) : ViewModel() {

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
        viewModelScope.launch {
            // Structured guided workouts are a subscriber feature. Unknown entitlement (a failed
            // fetch) locks it, which is the safe default — the server enforces it regardless.
            val subscribed = when (val result = coach.overview()) {
                is ApiResult.Success -> result.value.entitlement.tier == "SUBSCRIBED"
                is ApiResult.Failure -> false
            }
            _state.update { it.copy(canCustomize = subscribed, entitlementKnown = true) }
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

    /** The reverse-geocoded city/town, shown above the temperature. Best-effort; null is fine. */
    fun setPlaceName(name: String?) = _state.update { it.copy(placeName = name?.takeIf { n -> n.isNotBlank() }) }

    /**
     * Loads the step structure for a runner-chosen workout type (intervals, norwegian, strides,
     * recovery, long_run) so a Free run can be audio-guided without a plan. A blank/"easy" type is a
     * plain free run: clear any structure. A failure keeps the plain free run rather than blocking.
     */
    fun selectWorkoutType(type: String?) {
        if (type.isNullOrBlank() || type == FREE_RUN_TYPE) {
            _state.update { it.copy(selectedType = null, freeStructure = null, structureLoading = false, typeParams = emptyMap()) }
            return
        }
        // Only subscribers may run a structured workout; everyone else stays on a plain free run.
        if (!_state.value.canCustomize) return
        val params = (WORKOUT_TYPE_PARAMS[type] ?: emptyList()).associate { it.key to it.default }
        _state.update { it.copy(selectedType = type, typeParams = params, structureLoading = true) }
        fetchStructure(type, params)
    }

    /** Adjusts one tunable (clamped to its bounds) and re-fetches the structure to preview. */
    fun updateParam(key: String, delta: Int) {
        val type = _state.value.selectedType ?: return
        val spec = WORKOUT_TYPE_PARAMS[type]?.firstOrNull { it.key == key } ?: return
        val current = _state.value.typeParams[key] ?: spec.default
        val next = (current + delta * spec.step).coerceIn(spec.min, spec.max)
        if (next == current) return
        val params = _state.value.typeParams.toMutableMap().apply { put(key, next) }
        _state.update { it.copy(typeParams = params, structureLoading = true) }
        fetchStructure(type, params)
    }

    private fun fetchStructure(type: String, params: Map<String, Int>) {
        viewModelScope.launch {
            when (val result = repository.runStructure(type, params)) {
                is ApiResult.Success ->
                    // Ignore a stale response if the runner has since changed the type.
                    _state.update { if (it.selectedType == type) it.copy(freeStructure = result.value, structureLoading = false) else it }
                is ApiResult.Failure ->
                    _state.update { if (it.selectedType == type) it.copy(structureLoading = false) else it }
            }
        }
    }
}

/** The "no structure, just run" option in the Free-mode workout-type picker. */
const val FREE_RUN_TYPE = "easy"

/** The workout types the Free-run picker offers, in display order. Values match the endpoint's ids. */
val FREE_RUN_WORKOUT_TYPES = listOf(FREE_RUN_TYPE, "long_run", "intervals", "strides", "norwegian")

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
        // Sub-minute steps (a stride's 20 s work rep) must not collapse to "0 min"; show seconds.
        seconds != null && seconds < 60 -> stringResource(R.string.runs_step_seconds, ZidRunFormat.count(seconds, locale))
        seconds != null -> stringResource(R.string.runs_step_minutes, ZidRunFormat.count(seconds / 60, locale))
        meters != null -> stringResource(R.string.runs_step_metres, ZidRunFormat.count(meters, locale))
        else -> ""
    }
}
