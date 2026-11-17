package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

/**
 * What the pre-run GPS warm-up has seen so far.
 *
 * [permitted] is false until precise location has been granted, in which case there is nothing to
 * warm up and the Start screen offers "Enable GPS" instead of bars.
 */
internal data class GpsWarmupState(
    val permitted: Boolean,
    val accuracyM: Float?,
    val latitude: Double? = null,
    val longitude: Double? = null,
    /** Latest satellite picture; null until the first GNSS status arrives (or never, without permission). */
    val gnss: GnssSnapshot? = null,
    /** True when the last fix is recent enough to describe the signal now (see [GPS_FIX_STALE_MS]). */
    val fixFresh: Boolean = accuracyM != null,
    /** How long the warm-up has gone without a recordable signal; 0 while it has one. */
    val searchingForMs: Long = 0,
) {
    /** Bars for the Start screen: the fresh fix's accuracy, else satellite strength. */
    val signal: GpsSignalLevel get() = GpsSignalLevel.of(accuracyM?.takeIf { fixFresh }, gnss)

    /** Offer tips once the search has dragged on without a recordable signal. */
    val showTips: Boolean get() = permitted && shouldShowGpsTips(signal, searchingForMs)

    /** True once a fix good enough to record from has arrived — the recorder's own threshold. */
    val ready: Boolean get() = accuracyM != null && GpsQuality.isUsableFix(accuracyM)

    /**
     * True once there is a position good enough to name the town the run starts in. Far looser than
     * [ready]: a 300 m fix cannot record a route but places the runner in the right town.
     */
    val placeable: Boolean
        get() = latitude != null && longitude != null && (accuracyM == null || accuracyM <= PLACE_ACCURACY_M)
}

private const val PLACE_ACCURACY_M = 1_000f

/**
 * Keeps the GPS searching while the Start screen is visible, so the receiver has a fix by the time
 * the runner starts.
 *
 * The recorder only turned the GPS on at start, so every second of time-to-first-fix was spent
 * inside the run with the clock running and no distance counted. On the Galaxy M21 (GPS-only,
 * 4 satellites, TTFF ~74 s) the 2026-11-15 walk got its first usable fix 3 min 22 s after start and
 * lost its first ~190 m. A warm receiver hands the recorder a fix within a second or two.
 *
 * Raw [LocationManager.GPS_PROVIDER] at 1 s, the same request the recording service makes, so the
 * engine the run uses is the one that is warm. Only while the screen is at least STARTED: a runner
 * who leaves the app on this screen does not keep the GPS on in the background. Removed on leaving
 * the screen; by then the recording service has registered its own request, so the receiver never
 * goes cold in between.
 */
@SuppressLint("MissingPermission")
@Composable
internal fun rememberGpsWarmup(
    /** Bumped by the screen when a permission request returns, so a grant starts the warm-up at once. */
    permissionRefresh: Int = 0,
): GpsWarmupState {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    // Re-read on every return to the screen too: location may have been allowed in Settings.
    var permitted by remember { mutableStateOf(hasPreciseLocation(context)) }
    LaunchedEffect(permissionRefresh) { permitted = hasPreciseLocation(context) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) permitted = hasPreciseLocation(context)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    var accuracy by remember { mutableStateOf<Float?>(null) }
    var position by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var fixAtMs by remember { mutableStateOf<Long?>(null) }
    var gnss by remember { mutableStateOf<GnssSnapshot?>(null) }
    // When the current stretch without a recordable signal began; reset whenever one arrives.
    var searchStartMs by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    // A 1 s clock, so a fix going stale and the tips' delay show up even if no callback fires.
    var nowMs by remember { mutableStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(permitted) {
        while (true) {
            nowMs = SystemClock.elapsedRealtime()
            kotlinx.coroutines.delay(1_000)
        }
    }

    DisposableEffect(lifecycleOwner, permitted) {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (!permitted || manager == null) return@DisposableEffect onDispose {}

        val listener = LocationListener { location: Location ->
            accuracy = if (location.hasAccuracy()) location.accuracy else null
            position = location.latitude to location.longitude
            fixAtMs = SystemClock.elapsedRealtime()
        }
        // Satellite signal strength, so the indicator has something true to say before the first
        // fix — which on a weak receiver can be minutes away, or never.
        val gnssCallback = object : GnssStatus.Callback() {
            override fun onSatelliteStatusChanged(status: GnssStatus) {
                var inView = 0
                var used = 0
                val cn0 = ArrayList<Float>(status.satelliteCount)
                for (i in 0 until status.satelliteCount) {
                    val c = status.getCn0DbHz(i)
                    if (c > 0f) { inView++; cn0 += c }
                    if (status.usedInFix(i)) used++
                }
                cn0.sortDescending()
                gnss = GnssSnapshot(inView, used, cn0.take(GNSS_STRONGEST_KEPT))
            }

            override fun onStopped() {
                gnss = null
            }
        }
        var registered = false
        fun register() {
            if (registered) return
            registered = runCatching {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, WARMUP_INTERVAL_MS, 0f, listener, Looper.getMainLooper())
            }.isSuccess
            // Best effort: the bars fall back to fix accuracy alone if this is refused.
            if (registered) runCatching { manager.registerGnssStatusCallback(gnssCallback, Handler(Looper.getMainLooper())) }
        }
        fun unregister() {
            if (!registered) return
            runCatching { manager.removeUpdates(listener) }
            runCatching { manager.unregisterGnssStatusCallback(gnssCallback) }
            registered = false
        }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> register()
                Lifecycle.Event.ON_STOP -> unregister()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) register()
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            unregister()
        }
    }
    val fixFresh = fixAtMs?.let { nowMs - it <= GPS_FIX_STALE_MS } ?: false
    val recordableNow = GpsSignalLevel.of(accuracy?.takeIf { fixFresh }, gnss).recordable
    LaunchedEffect(recordableNow) {
        if (recordableNow) searchStartMs = SystemClock.elapsedRealtime()
    }
    return GpsWarmupState(
        permitted = permitted,
        accuracyM = accuracy,
        latitude = position?.first,
        longitude = position?.second,
        gnss = gnss,
        fixFresh = fixFresh,
        searchingForMs = if (recordableNow) 0 else (nowMs - searchStartMs).coerceAtLeast(0),
    )
}

private fun hasPreciseLocation(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private const val WARMUP_INTERVAL_MS = 1_000L

/** Satellites kept per GNSS snapshot — enough for [GpsSignalLevel.CLOSE_TO_FIX_SATELLITES]. */
private const val GNSS_STRONGEST_KEPT = 8
