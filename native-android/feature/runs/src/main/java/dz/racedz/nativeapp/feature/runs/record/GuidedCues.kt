package dz.racedz.nativeapp.feature.runs.record

import dz.racedz.nativeapp.core.network.GuidedStepDto

/**
 * The coaching cues a guided run speaks *between* step announcements (NATGAP-15).
 *
 * Native spoke three things — the step you entered, each kilometre split, and "done" — while the
 * website's audio coach also talks you through the inside of a step: ease into the warm-up, one
 * minute left, halfway through the rep, last one, halfway, last kilometre. That commentary is most
 * of what makes a guided run feel coached rather than narrated, and it was the follow-up NATRUN-03
 * named.
 *
 * ## What is ported and what is not
 *
 * These are the families that need nothing the app does not already have: they are all functions of
 * the current step, its role, and how far into it the runner is. Two families are deliberately left
 * out rather than approximated:
 *
 *  - **Pace guidance** ("ease off", "pick it up") needs the runner's 28-day average pace as a
 *    reference band. Guessing a band from the current run would tell people to speed up on a
 *    recovery day, which is worse than saying nothing.
 *  - **Check-in and form pools** are rotating personality copy. They are a large translated surface
 *    whose value is variety, and half a pool repeated every session reads worse than silence.
 *
 * Both are recorded in EXECUTION_PLAN.md rather than half-built here.
 *
 * ## Why a class with explicit "fired" flags
 *
 * Every cue must fire at most once per step. The recorder ticks this several times a second, so
 * without per-step latches the runner would hear "one minute left" continuously for the last
 * minute. The flags reset when the step index changes, which is the only state this needs.
 */
class GuidedCueEngine {

    private var stepIndex: Int = -1
    private var firedInStep = mutableSetOf<Cue>()
    /** Seconds into the run when the current step began, for the rep-split timing. */
    private var stepStartedAt: Int = 0

    /**
     * The role of the step currently in progress.
     *
     * Tracked in [onTick], not in [onStepChanged]. It was originally only assigned on a transition,
     * which meant the role of the step that had just *finished* was never actually known — so no
     * rep split was ever emitted. Caught by GuidedCueEngineTest, not by running.
     */
    private var currentRole: String? = null

    /** A cue to speak. The caller resolves it to localized text. */
    enum class Cue {
        WarmupTip,
        WarmupLastMinute,
        CooldownTip,
        OneMinuteLeft,
        MidStep,
        LastRep,
        Halfway,
        LastKm,
        Hydrate,
    }

    /** A finished work rep, with how long it took. Emitted once, on the transition out of it. */
    data class RepSplit(val seconds: Int)

    /**
     * Cues due right now, in the order they should be spoken.
     *
     * Returns an empty list on the vast majority of ticks; the caller speaks whatever comes back.
     */
    fun onTick(
        step: GuidedStepDto?,
        elapsedSecondsInStep: Int,
        metersInStep: Double,
        totalElapsedSeconds: Int,
    ): List<Cue> {
        if (step == null) return emptyList()
        if (step.index != stepIndex) {
            stepIndex = step.index
            firedInStep = mutableSetOf()
            stepStartedAt = totalElapsedSeconds
        }
        currentRole = step.role

        val due = mutableListOf<Cue>()
        fun fire(cue: Cue) {
            if (firedInStep.add(cue)) due += cue
        }

        val targetSeconds = step.seconds
        val targetMeters = step.meters
        val remainingSeconds = targetSeconds?.let { it - elapsedSecondsInStep }
        val remainingMeters = targetMeters?.let { it - metersInStep }

        when (step.role) {
            "WARMUP" -> {
                // A few seconds in, not immediately: the step announcement is still being spoken.
                if (elapsedSecondsInStep >= PHASE_TIP_DELAY_SEC) fire(Cue.WarmupTip)
                if (remainingSeconds != null && remainingSeconds in 1..60) fire(Cue.WarmupLastMinute)
            }
            "COOLDOWN" -> {
                if (elapsedSecondsInStep >= PHASE_TIP_DELAY_SEC) fire(Cue.CooldownTip)
            }
        }

        // "One minute left" only earns its place on a step long enough for a minute to be news.
        if ((step.role == "WORK" || step.role == "STEADY") &&
            targetSeconds != null && targetSeconds >= MIN_STEP_FOR_MINUTE_WARNING_SEC &&
            remainingSeconds != null && remainingSeconds in 1..60
        ) {
            fire(Cue.OneMinuteLeft)
        }

        // Mid-rep control check, on work reps long enough to have a middle.
        if (step.role == "WORK" && targetSeconds != null && targetSeconds >= MIN_STEP_FOR_MID_SEC &&
            elapsedSecondsInStep >= targetSeconds / 2
        ) {
            fire(Cue.MidStep)
        }

        // The final rep of a set, announced as it starts.
        if (step.role == "WORK" && step.repTotal != null && step.repCurrent == step.repTotal) {
            fire(Cue.LastRep)
        }

        if (step.role == "STEADY") {
            val halfway = when {
                targetSeconds != null && targetSeconds > 0 -> elapsedSecondsInStep >= targetSeconds / 2
                targetMeters != null && targetMeters > 0 -> metersInStep >= targetMeters / 2.0
                else -> false
            }
            if (halfway) fire(Cue.Halfway)

            // Only on a block long enough for a last kilometre to mean anything.
            if (targetMeters != null && targetMeters > LAST_KM_MIN_METERS &&
                remainingMeters != null && remainingMeters in 1.0..1000.0
            ) {
                fire(Cue.LastKm)
            }

            // One hydration reminder on a long steady block.
            if (targetSeconds != null && targetSeconds >= HYDRATE_MIN_SEC &&
                elapsedSecondsInStep >= HYDRATE_AFTER_SEC
            ) {
                fire(Cue.Hydrate)
            }
        }

        return due
    }

    /**
     * The rep split for a WORK step that just ended, or null.
     *
     * Called by the caller at the moment it advances the session, because only it knows a
     * transition happened. Short reps are skipped: "rep done in 8 seconds" is noise.
     */
    fun onStepChanged(enteredStep: GuidedStepDto?, totalElapsedSeconds: Int): RepSplit? {
        val finishedRole = currentRole
        val repSeconds = totalElapsedSeconds - stepStartedAt
        // The entered step starts now, whether or not a split was worth announcing.
        stepStartedAt = totalElapsedSeconds
        currentRole = enteredStep?.role
        if (finishedRole != "WORK" || repSeconds < MIN_REP_SPLIT_SEC) return null
        return RepSplit(repSeconds)
    }

    fun reset() {
        stepIndex = -1
        firedInStep = mutableSetOf()
        stepStartedAt = 0
        currentRole = null
    }

    private companion object {
        /** Long enough after entering a phase that the step announcement has finished. */
        const val PHASE_TIP_DELAY_SEC = 8
        const val MIN_STEP_FOR_MINUTE_WARNING_SEC = 180
        const val MIN_STEP_FOR_MID_SEC = 90
        const val MIN_REP_SPLIT_SEC = 20
        const val LAST_KM_MIN_METERS = 3000.0
        const val HYDRATE_MIN_SEC = 1800
        const val HYDRATE_AFTER_SEC = 900
    }
}
