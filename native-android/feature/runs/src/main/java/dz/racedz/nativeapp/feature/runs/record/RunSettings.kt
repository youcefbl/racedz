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
    private const val KEY_COUNTDOWN = "countdown"

    /**
     * Distance between spoken progress cues, as a multiple of the account's distance unit (0.5 / 1 /
     * 2 km, or 0.5 / 1 / 2 mi for an account set to miles — NATRUN-06.8). Persisted by its stored
     * key, so a runner who switches unit keeps "every 1" and simply hears it per mile.
     */
    enum class CueInterval(val units: Double, private val storedKey: Int) {
        Off(0.0, 0),
        Half(0.5, 500),
        One(1.0, 1_000),
        Two(2.0, 2_000);

        /** Metres between cues under the current unit; 0 when off. */
        val meters: Double get() = units * dz.racedz.nativeapp.core.design.ZidRunUnits.current.meters

        internal val stored: Int get() = storedKey

        companion object {
            fun fromMeters(meters: Int): CueInterval = entries.firstOrNull { it.storedKey == meters } ?: One
        }
    }

    private var prefs: SharedPreferences? = null

    fun attach(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
    }

    var audioCuesEnabled: Boolean = true

    // In-memory fallbacks for when no prefs are attached (unit tests, previews).
    private var autoPauseFallback = true
    private var cueIntervalFallback = CueInterval.One
    private var countdownFallback = false

    /** Pause the clock automatically while the runner is standing still (traffic light, a stop). */
    var autoPauseEnabled: Boolean
        get() = prefs?.getBoolean(KEY_AUTO_PAUSE, true) ?: autoPauseFallback
        set(value) {
            autoPauseFallback = value
            prefs?.edit()?.putBoolean(KEY_AUTO_PAUSE, value)?.apply()
        }

    /** A 3-2-1 after the hold before anything starts (NATRUN-06.7). Off by default. */
    var countdownEnabled: Boolean
        get() = prefs?.getBoolean(KEY_COUNTDOWN, false) ?: countdownFallback
        set(value) {
            countdownFallback = value
            prefs?.edit()?.putBoolean(KEY_COUNTDOWN, value)?.apply()
        }

    var cueInterval: CueInterval
        get() = prefs?.let { CueInterval.fromMeters(it.getInt(KEY_CUE_INTERVAL_M, CueInterval.One.stored)) }
            ?: cueIntervalFallback
        set(value) {
            cueIntervalFallback = value
            prefs?.edit()?.putInt(KEY_CUE_INTERVAL_M, value.stored)?.apply()
        }
}
