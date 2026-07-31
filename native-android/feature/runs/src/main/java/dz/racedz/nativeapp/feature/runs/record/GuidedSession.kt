package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.GuidedSessionDto
import dz.racedz.nativeapp.core.network.GuidedStepDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** What the runner chose on the start screen. */
enum class RunMode { Free, Guided }

data class GuidedProgress(
    val session: GuidedSessionDto? = null,
    val stepIndex: Int = 0,
) {
    val currentStep: GuidedStepDto? get() = session?.steps?.getOrNull(stepIndex)
    val isComplete: Boolean get() = session != null && stepIndex >= session.steps.size

    /** How far into the current step the runner is, 0..1, for the progress ring. */
    fun stepFraction(elapsedSecondsInStep: Int, metersInStep: Double): Float {
        val step = currentStep ?: return 0f
        step.seconds?.takeIf { it > 0 }?.let { return (elapsedSecondsInStep.toFloat() / it).coerceIn(0f, 1f) }
        step.meters?.takeIf { it > 0 }?.let { return (metersInStep / it).toFloat().coerceIn(0f, 1f) }
        return 0f
    }
}

/**
 * Advances a guided session as the run progresses.
 *
 * Kept beside [RunRecorder] rather than inside it: the recorder measures, this interprets. A free
 * run leaves this untouched, and a guided run that loses its session (offline at start) simply
 * behaves like a free one rather than blocking the run.
 */
object GuidedSessionController {

    private val _state = MutableStateFlow(GuidedProgress())
    val state: StateFlow<GuidedProgress> = _state.asStateFlow()

    private var stepStartedAtSeconds: Int = 0
    private var stepStartedAtMeters: Double = 0.0

    fun start(session: GuidedSessionDto?) {
        _state.value = GuidedProgress(session = session, stepIndex = 0)
        stepStartedAtSeconds = 0
        stepStartedAtMeters = 0.0
    }

    fun clear() {
        _state.value = GuidedProgress()
    }

    fun elapsedInStep(totalElapsedSeconds: Int): Int = (totalElapsedSeconds - stepStartedAtSeconds).coerceAtLeast(0)

    fun metersInStep(totalMeters: Double): Double = (totalMeters - stepStartedAtMeters).coerceAtLeast(0.0)

    /**
     * Advances to the next step when the current one's target is met.
     *
     * Returns the step just entered so the caller can announce it, or null when nothing changed —
     * which is what keeps the voice from repeating itself every tick.
     */
    fun advanceIfDue(totalElapsedSeconds: Int, totalMeters: Double): GuidedStepDto? {
        val current = _state.value
        val step = current.currentStep ?: return null

        val doneBySeconds = step.seconds?.let { elapsedInStep(totalElapsedSeconds) >= it } ?: false
        val doneByMeters = step.meters?.let { metersInStep(totalMeters) >= it } ?: false
        if (!doneBySeconds && !doneByMeters) return null

        stepStartedAtSeconds = totalElapsedSeconds
        stepStartedAtMeters = totalMeters
        _state.value = current.copy(stepIndex = current.stepIndex + 1)
        return _state.value.currentStep
    }
}
