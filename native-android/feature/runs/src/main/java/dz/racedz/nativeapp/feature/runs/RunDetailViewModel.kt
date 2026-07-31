package dz.racedz.nativeapp.feature.runs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.RunsRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.RoutePointDto
import dz.racedz.nativeapp.core.network.RunDto
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One kilometre of a run. [label] is "1", "2" … and finally the fractional last split ("5.72"). */
data class RunSplit(val label: String, val paceSecondsPerKm: Int)

data class RunDetailUiState(
    val run: RunDto? = null,
    val loading: Boolean = true,
    val error: ApiCallException? = null,
    val splits: List<RunSplit> = emptyList(),
    val elevationProfile: List<Double> = emptyList(),
) {
    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline
}

class RunDetailViewModel(
    private val repository: RunsRepository,
    private val runId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RunDetailUiState())
    val state: StateFlow<RunDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            when (val result = repository.detail(runId)) {
                is ApiResult.Success -> {
                    val run = result.value
                    _state.update {
                        it.copy(
                            run = run,
                            loading = false,
                            error = null,
                            splits = computeSplits(run),
                            elevationProfile = sampleElevation(run.route),
                        )
                    }
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = result.error) }
            }
        }
    }
}

/**
 * Per-kilometre pace, derived from the route's own timestamps.
 *
 * Requires timestamps: without them the points say where the runner went but not when, and any
 * "pace" would be invented. In that case there are no splits, which is honest — the alternative is
 * spreading the average evenly and presenting a flat line as if it were measured.
 */
internal fun computeSplits(run: RunDto): List<RunSplit> {
    val route = run.route.orEmpty()
    if (route.size < 2 || route.any { it.t == null }) return emptyList()

    val splits = mutableListOf<RunSplit>()
    var kmStartMs = route.first().t ?: return emptyList()
    var travelled = 0.0
    var nextBoundary = 1.0
    var kmIndex = 1

    for (i in 1 until route.size) {
        val previous = route[i - 1]
        val current = route[i]
        val segment = haversineKm(previous, current)
        if (segment <= 0.0) continue

        val previousMs = previous.t ?: continue
        val currentMs = current.t ?: continue
        val segmentStart = travelled
        travelled += segment

        // A single GPS segment can span a kilometre boundary — and at 1 Hz it usually straddles it
        // rather than landing on it. Interpolating the crossing time keeps each split honest;
        // simply using the timestamp of the point that first exceeded the boundary charges that
        // kilometre for the overshoot and pays it back on the next one, so every split is wrong by
        // a little and the error compounds along the run.
        while (travelled >= nextBoundary) {
            val fraction = (nextBoundary - segmentStart) / segment
            val boundaryMs = previousMs + ((currentMs - previousMs) * fraction).toLong()
            val seconds = ((boundaryMs - kmStartMs) / 1000L).toInt()
            if (seconds > 0) splits += RunSplit(kmIndex.toString(), seconds)
            kmStartMs = boundaryMs
            nextBoundary += 1.0
            kmIndex += 1
        }
    }

    // The final partial kilometre, scaled to a per-km pace so it is comparable with the whole ones
    // above it rather than looking impossibly fast. Ignored when it is a sliver: a few metres of
    // GPS residue is not a split, and showing "5.00" under "5" reads as a duplicate.
    val remainder = travelled - (nextBoundary - 1.0)
    if (remainder >= MIN_TAIL_SPLIT_KM) {
        val seconds = (((route.last().t ?: kmStartMs) - kmStartMs) / 1000L).toInt()
        if (seconds > 0) {
            splits += RunSplit(String.format("%.2f", travelled), (seconds / remainder).toInt())
        }
    }

    return splits
}

/** Below this, the leftover distance is GPS residue rather than a kilometre worth reporting. */
private const val MIN_TAIL_SPLIT_KM = 0.1

/**
 * Elevation samples for the profile chart, thinned to at most [MAX_CHART_POINTS].
 *
 * A 1500-point route drawn into a 120dp-tall chart would put several points on every pixel column;
 * thinning keeps the shape and avoids the overdraw.
 */
internal fun sampleElevation(route: List<RoutePointDto>?, max: Int = MAX_CHART_POINTS): List<Double> {
    val points = route.orEmpty().mapNotNull { it.ele }
    if (points.size <= max) return points
    val step = points.size.toDouble() / max
    return (0 until max).map { points[(it * step).toInt().coerceAtMost(points.size - 1)] }
}

private const val MAX_CHART_POINTS = 120

/** Great-circle distance between two points, in kilometres. */
private fun haversineKm(a: RoutePointDto, b: RoutePointDto): Double {
    val earthRadiusKm = 6371.0
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLng = Math.toRadians(b.lng - a.lng)
    val lat1 = Math.toRadians(a.lat)
    val lat2 = Math.toRadians(b.lat)
    val h = sin(dLat / 2) * sin(dLat / 2) + sin(dLng / 2) * sin(dLng / 2) * cos(lat1) * cos(lat2)
    return 2 * earthRadiusKm * atan2(sqrt(h), sqrt(1 - h))
}
