package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import dz.racedz.nativeapp.core.design.DistanceUnit
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunUnits
import dz.racedz.nativeapp.core.design.localeOf
import kotlin.math.roundToInt

/**
 * Something the run voice says, as data rather than a sentence.
 *
 * Kept structured so one cue can be spoken two ways: composed from the bundled voice clips
 * ([CueComposer], the default on every phone) or, when a value falls outside the clip vocabulary,
 * rendered to localized text ([text]) for the device speech engine.
 */
sealed interface RunCue {
    data object Started : RunCue
    data object Paused : RunCue
    data object Resumed : RunCue
    data object SessionDone : RunCue
    data class Tip(val tip: GuidedCueEngine.Cue) : RunCue

    /** Distance so far (a multiple of the cue interval, in [unit]), elapsed time, interval pace. */
    data class Progress(
        val distanceUnits: Double,
        val elapsedSeconds: Int,
        val paceSecondsPerUnit: Int?,
        val unit: DistanceUnit,
    ) : RunCue

    data class Step(val role: String, val seconds: Int?, val meters: Int?) : RunCue
    data class RepSplit(val seconds: Int) : RunCue
    data class Finished(val distanceKm: Double, val elapsedSeconds: Int, val unit: DistanceUnit) : RunCue

    /** Free text (a coach reply). Never clip-composed; device speech only. */
    data class FreeText(val text: String) : RunCue
}

/**
 * Turns a [RunCue] into the sequence of bundled clip keys that speaks it, or null when a value is
 * outside the vocabulary (the caller then uses device speech). Keys are a contract with
 * `scripts/run-cue-vocabulary.ts`; `CueComposerTest` checks every emitted key exists in the
 * generated manifests.
 *
 * Darija joins parts of a duration with "و", which is baked into the following clip
 * (`min_and_*`, `sec_and_*`) because a lone "و" is read as the letter's name.
 */
object CueComposer {
    private const val NUMBER_MAX = 100
    private const val HOUR_MAX = 9
    private val METRE_STEPS = (50..950 step 50).toSet()

    fun clips(cue: RunCue, language: String): List<String>? {
        val ar = language == "ar"
        return when (cue) {
            RunCue.Started -> listOf("started")
            RunCue.Paused -> listOf("paused")
            RunCue.Resumed -> listOf("resumed")
            RunCue.SessionDone -> listOf("done")
            is RunCue.Tip -> listOf(tipKey(cue.tip))
            is RunCue.Progress -> {
                val distance = distance((cue.distanceUnits * 10).roundToInt(), cue.unit) ?: return null
                val time = duration(cue.elapsedSeconds, ar) ?: return null
                val pace = cue.paceSecondsPerUnit?.let { pace(it, cue.unit, ar) ?: return null }.orEmpty()
                distance + "word_time" + time + pace
            }
            is RunCue.Step -> listOf(stepKey(cue.role)) + stepTarget(cue, ar)
            is RunCue.RepSplit -> listOf("rep_done") + (duration(cue.seconds, ar) ?: return null)
            is RunCue.Finished -> {
                val units = ZidRunUnits.fromKm(cue.distanceKm, cue.unit)
                val distance = distance((units * 10).roundToInt(), cue.unit) ?: return null
                listOf("run_finished") + distance + "word_in" + (duration(cue.elapsedSeconds, ar) ?: return null)
            }
            is RunCue.FreeText -> null
        }
    }

    /** "5 kilometres", "5 point 5 kilometres", "1 kilometre". */
    internal fun distance(tenths: Int, unit: DistanceUnit): List<String>? {
        if (tenths < 0) return null
        val whole = tenths / 10
        val decimal = tenths % 10
        if (whole > NUMBER_MAX) return null
        val unitKey = if (unit == DistanceUnit.MI) "unit_mi" else "unit_km"
        return if (decimal == 0) {
            listOf("num_$whole", if (whole == 1) "${unitKey}_one" else unitKey)
        } else {
            listOf("num_$whole", "word_point", "num_$decimal", unitKey)
        }
    }

    /** "27 minutes 30 seconds", "1 hour 2 minutes"; Darija joins with و. */
    internal fun duration(totalSeconds: Int, ar: Boolean): List<String>? {
        if (totalSeconds <= 0) return null
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        if (hours > HOUR_MAX) return null
        val out = mutableListOf<String>()
        if (hours > 0) out += "hr_$hours"
        if (minutes > 0) out += if (ar && out.isNotEmpty()) "min_and_$minutes" else "min_$minutes"
        if (seconds > 0) out += if (ar && out.isNotEmpty()) "sec_and_$seconds" else "sec_$seconds"
        return out
    }

    /** "Pace 5 minutes 30 seconds per kilometre". */
    internal fun pace(secondsPerUnit: Int, unit: DistanceUnit, ar: Boolean): List<String>? {
        val minutes = secondsPerUnit / 60
        val seconds = secondsPerUnit % 60
        if (minutes !in 1..59) return null
        val out = mutableListOf("word_pace", "min_$minutes")
        if (seconds > 0) out += if (ar) "sec_and_$seconds" else "sec_$seconds"
        out += if (unit == DistanceUnit.MI) "per_mi" else "per_km"
        return out
    }

    /**
     * The step's target. An unrepresentable one (a 1,234 m rep) still announces the role —
     * "Work." beats silence — rather than dropping the whole cue to a speech engine that may
     * not exist.
     */
    private fun stepTarget(step: RunCue.Step, ar: Boolean): List<String> {
        val seconds = step.seconds
        val meters = step.meters
        return when {
            seconds != null && seconds in 1..59 -> listOf("sec_$seconds")
            seconds != null -> duration(seconds, ar).orEmpty()
            meters != null && meters in METRE_STEPS -> listOf("m_$meters")
            meters != null && meters >= 1000 && meters % 100 == 0 ->
                distance(meters / 100, DistanceUnit.KM).orEmpty()
            else -> emptyList()
        }
    }

    private fun stepKey(role: String) = when (role) {
        "WARMUP" -> "step_warmup"
        "WORK" -> "step_work"
        "RECOVERY" -> "step_recovery"
        "COOLDOWN" -> "step_cooldown"
        else -> "step_steady"
    }

    private fun tipKey(tip: GuidedCueEngine.Cue) = when (tip) {
        GuidedCueEngine.Cue.WarmupTip -> "tip_warmup"
        GuidedCueEngine.Cue.WarmupLastMinute -> "tip_warmup_last_minute"
        GuidedCueEngine.Cue.CooldownTip -> "tip_cooldown"
        GuidedCueEngine.Cue.OneMinuteLeft -> "tip_one_minute_left"
        GuidedCueEngine.Cue.MidStep -> "tip_mid_step"
        GuidedCueEngine.Cue.LastRep -> "tip_last_rep"
        GuidedCueEngine.Cue.Halfway -> "tip_halfway"
        GuidedCueEngine.Cue.LastKm -> "tip_last_km"
        GuidedCueEngine.Cue.Hydrate -> "tip_hydrate"
    }
}

/** The cue as localized text, for the device speech engine. [context] carries the run's language. */
fun RunCue.text(context: Context): String {
    val locale = localeOf(context)
    return when (this) {
        RunCue.Started -> context.getString(R.string.runs_cue_started)
        RunCue.Paused -> context.getString(R.string.runs_cue_paused)
        RunCue.Resumed -> context.getString(R.string.runs_cue_resumed)
        RunCue.SessionDone -> context.getString(R.string.runs_cue_done)
        is RunCue.Tip -> context.getString(
            when (tip) {
                GuidedCueEngine.Cue.WarmupTip -> R.string.runs_cue_warmup_tip
                GuidedCueEngine.Cue.WarmupLastMinute -> R.string.runs_cue_warmup_last_minute
                GuidedCueEngine.Cue.CooldownTip -> R.string.runs_cue_cooldown_tip
                GuidedCueEngine.Cue.OneMinuteLeft -> R.string.runs_cue_one_minute_left
                GuidedCueEngine.Cue.MidStep -> R.string.runs_cue_mid_step
                GuidedCueEngine.Cue.LastRep -> R.string.runs_cue_last_rep
                GuidedCueEngine.Cue.Halfway -> R.string.runs_cue_halfway
                GuidedCueEngine.Cue.LastKm -> R.string.runs_cue_last_km
                GuidedCueEngine.Cue.Hydrate -> R.string.runs_cue_hydrate
            }
        )
        is RunCue.Progress -> {
            // Whole values read as a count, halves with one decimal — never "three point zero zero".
            val value = if (distanceUnits % 1.0 == 0.0) {
                ZidRunFormat.count(distanceUnits.toInt(), locale)
            } else {
                ZidRunFormat.decimal(distanceUnits, locale, digits = 1)
            }
            context.getString(
                R.string.runs_cue_progress,
                value,
                ZidRunFormat.duration(elapsedSeconds),
                paceSecondsPerUnit?.let { ZidRunFormat.pace(it) } ?: "—",
                ZidRunUnits.spokenLabel(context, unit),
            )
        }
        is RunCue.Step -> {
            val roleText = context.getString(
                when (role) {
                    "WARMUP" -> R.string.runs_step_warmup
                    "WORK" -> R.string.runs_step_work
                    "RECOVERY" -> R.string.runs_step_recovery
                    "COOLDOWN" -> R.string.runs_step_cooldown
                    else -> R.string.runs_step_steady
                }
            )
            val target = when {
                // A stride's 20 s rep must be spoken as seconds, not "0 minutes".
                seconds != null && seconds < 60 ->
                    context.getString(R.string.runs_step_seconds, ZidRunFormat.count(seconds, locale))
                seconds != null ->
                    context.getString(R.string.runs_step_minutes, ZidRunFormat.count(seconds / 60, locale))
                meters != null ->
                    context.getString(R.string.runs_step_metres, ZidRunFormat.count(meters, locale))
                else -> ""
            }
            context.getString(R.string.runs_cue_step, roleText, target)
        }
        is RunCue.RepSplit -> context.getString(R.string.runs_cue_rep_split, ZidRunFormat.duration(seconds))
        is RunCue.Finished -> context.getString(
            R.string.runs_cue_finished,
            ZidRunFormat.distanceValue(distanceKm, locale),
            ZidRunFormat.duration(elapsedSeconds),
            ZidRunUnits.spokenLabel(context, unit),
        )
        is RunCue.FreeText -> text
    }
}
