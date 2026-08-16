package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.content.SharedPreferences

/**
 * Recording preferences.
 *
 * Two kinds live here, deliberately treated differently:
 *
 * - [audioCuesEnabled] is chosen fresh on the start screen for every run and never persisted: a
 *   stale "audio off" from a run three weeks ago silently muting today's would be worse than
 *   asking again.
 * - [autoPauseEnabled] and [cueIntervalKm] are *how the app records*, not a per-run mood, so they
 *   persist across runs (Strava keeps the same two under Record → Settings). Stored in plain
 *   [SharedPreferences]; nothing here is sensitive.
 *
 * Reads work before [attach] is called (unit tests, previews) and simply return the defaults.
 */
object RunSettings {
    private const val FILE_NAME = "run_settings"
    private const val KEY_AUTO_PAUSE = "auto_pause"
    private const val KEY_CUE_INTERVAL_M = "cue_interval_m"

    /** Distance between spoken progress cues, in metres. Also the sole source of the choices offered. */
    enum class CueInterval(val meters: Int) {
        Off(0),
        HalfKm(500),
        OneKm(1_000),
        TwoKm(2_000);

        companion object {
            fun fromMeters(meters: Int): CueInterval = entries.firstOrNull { it.meters == meters } ?: OneKm
        }
    }

    private var prefs: SharedPreferences? = null

    fun attach(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
    }

    var audioCuesEnabled: Boolean = true

    // In-memory fallbacks for when no prefs are attached (unit tests, previews).
    private var autoPauseFallback = true
    private var cueIntervalFallback = CueInterval.OneKm

    /** Pause the clock automatically while the runner is standing still (traffic light, a stop). */
    var autoPauseEnabled: Boolean
        get() = prefs?.getBoolean(KEY_AUTO_PAUSE, true) ?: autoPauseFallback
        set(value) {
            autoPauseFallback = value
            prefs?.edit()?.putBoolean(KEY_AUTO_PAUSE, value)?.apply()
        }

    var cueInterval: CueInterval
        get() = prefs?.let { CueInterval.fromMeters(it.getInt(KEY_CUE_INTERVAL_M, CueInterval.OneKm.meters)) }
            ?: cueIntervalFallback
        set(value) {
            cueIntervalFallback = value
            prefs?.edit()?.putInt(KEY_CUE_INTERVAL_M, value.meters)?.apply()
        }
}
