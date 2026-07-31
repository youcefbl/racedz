package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import dz.racedz.nativeapp.core.design.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Keeps GPS running while a run is being recorded.
 *
 * A foreground service is what makes recording survive the screen turning off and the app being
 * backgrounded — which is the normal way a run is recorded. It deliberately does NOT request
 * ACCESS_BACKGROUND_LOCATION: that permission is for collecting location when the app is not in use
 * at all, Android grades it far more harshly, and a foreground service with a visible notification
 * covers this case without it. See docs/MOBILE_ANDROID.md; the Capacitor app made the same choice.
 *
 * Uses the platform LocationManager rather than Play Services' fused provider so the app carries no
 * Google Play dependency for its core feature and runs on a device without Play Services.
 */
class RunTrackingService : Service(), LocationListener {

    private var scope: CoroutineScope? = null
    private var ticker: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                return START_NOT_STICKY
            }
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        startTracking()
        // START_STICKY: if the OS kills us under memory pressure mid-run, come back and keep
        // recording rather than silently ending someone's run.
        return START_STICKY
    }

    // Lint cannot follow the guard below across the early return, so it is suppressed rather than
    // worked around: permission IS checked immediately above the call, and the call is additionally
    // wrapped in a SecurityException catch so a revoked-mid-run permission stops the service
    // instead of crashing the app.
    @SuppressLint("MissingPermission")
    private fun startTracking() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            // Should be unreachable — the UI requests permission before starting — but a service
            // that assumes it has permission crashes the whole app if it is ever wrong.
            stopSelf()
            return
        }

        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            manager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                MIN_UPDATE_INTERVAL_MS,
                MIN_UPDATE_DISTANCE_M,
                this,
                Looper.getMainLooper(),
            )
        } catch (error: SecurityException) {
            stopSelf()
            return
        }

        val serviceScope = CoroutineScope(Dispatchers.Main).also { scope = it }
        ticker = serviceScope.launch {
            // Fixes can be seconds apart; the clock on screen has to keep moving between them.
            while (isActive) {
                RunRecorder.tick()
                // Rate-limited inside the recorder; this only offers the opportunity.
                RunRecorder.snapshot()
                notificationManager().notify(NOTIFICATION_ID, buildNotification())
                delay(1_000)
            }
        }
    }

    private fun stopTracking() {
        ticker?.cancel()
        ticker = null
        scope = null
        runCatching {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        ticker?.cancel()
        runCatching {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        }
        super.onDestroy()
    }

    override fun onLocationChanged(location: Location) {
        RunRecorder.onLocation(location)
    }

    /** Required by LocationListener on older API levels; the modern callbacks are no-ops here. */
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) = Unit

    private fun notificationManager() = getSystemService(NotificationManager::class.java)

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationManager().createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    getString(R.string.runs_notification_channel),
                    // Low: this notification exists so the OS keeps us alive and the runner can see
                    // recording is on. It should never buzz mid-run.
                    NotificationManager.IMPORTANCE_LOW,
                ).apply { setShowBadge(false) }
            )
        }

        val state = RunRecorder.state.value
        val distance = String.format("%.2f", state.distanceKm)
        val minutes = state.elapsedSeconds / 60
        val seconds = state.elapsedSeconds % 60

        val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.runs_notification_title))
            .setContentText(
                getString(R.string.runs_notification_body, distance, String.format("%d:%02d", minutes, seconds))
            )
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(launch)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "run_tracking"
        private const val NOTIFICATION_ID = 4201

        /** 1 Hz is what the route resolution and pace smoothing assume. */
        private const val MIN_UPDATE_INTERVAL_MS = 1_000L

        /** 0 so the provider reports even while nearly stationary; the quality rules filter drift. */
        private const val MIN_UPDATE_DISTANCE_M = 0f

        const val ACTION_STOP = "dz.racedz.nativeapp.STOP_RUN_TRACKING"

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, RunTrackingService::class.java))
        }

        fun stop(context: Context) {
            context.startService(
                Intent(context, RunTrackingService::class.java).apply { action = ACTION_STOP }
            )
        }
    }
}
