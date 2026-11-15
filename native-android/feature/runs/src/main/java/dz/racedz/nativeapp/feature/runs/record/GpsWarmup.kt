package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
 * [permitted] is false until precise location has been granted (it is first asked for at
 * hold-to-begin), in which case there is nothing to warm up and the screen keeps its old wording.
 */
internal data class GpsWarmupState(
    val permitted: Boolean,
    val accuracyM: Float?,
    val latitude: Double? = null,
    val longitude: Double? = null,
) {
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
internal fun rememberGpsWarmup(): GpsWarmupState {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val permitted = hasPreciseLocation(context)
    var accuracy by remember { mutableStateOf<Float?>(null) }
    var position by remember { mutableStateOf<Pair<Double, Double>?>(null) }

    DisposableEffect(lifecycleOwner, permitted) {
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (!permitted || manager == null) return@DisposableEffect onDispose {}

        val listener = LocationListener { location: Location ->
            accuracy = if (location.hasAccuracy()) location.accuracy else null
            position = location.latitude to location.longitude
        }
        var registered = false
        fun register() {
            if (registered) return
            registered = runCatching {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, WARMUP_INTERVAL_MS, 0f, listener, Looper.getMainLooper())
            }.isSuccess
        }
        fun unregister() {
            if (!registered) return
            runCatching { manager.removeUpdates(listener) }
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
    return GpsWarmupState(
        permitted = permitted,
        accuracyM = accuracy,
        latitude = position?.first,
        longitude = position?.second,
    )
}

private fun hasPreciseLocation(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private const val WARMUP_INTERVAL_MS = 1_000L
