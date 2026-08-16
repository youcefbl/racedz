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
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
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
class RunTrackingService : Service(), LocationListener, SensorEventListener {

    private var scope: CoroutineScope? = null
    private var ticker: Job? = null

    /** Held while the step counter is registered, so it can be unregistered on stop. */
    private var sensorManager: SensorManager? = null

    /** One-time setup, kept so the per-second ticker does not redo it 3,600 times an hour. */
    private var channelReady = false
    private var contentIntent: PendingIntent? = null

    /** The last text actually posted, so an unchanged banner is not re-posted. */
    private var lastNotificationText: String? = null

    /** The action buttons, built once each. */
    private var pauseAction: NotificationCompat.Action? = null
    private var resumeAction: NotificationCompat.Action? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                return START_NOT_STICKY
            }
            // Pause/Resume from the notification (Strava parity, P0-6). The recorder is the single
            // source of truth; the next tick re-posts the notification with the other action.
            ACTION_PAUSE -> {
                RunRecorder.pause()
                lastNotificationText = null
                updateNotificationIfChanged()
                return START_STICKY
            }
            ACTION_RESUME -> {
                RunRecorder.resume()
                lastNotificationText = null
                updateNotificationIfChanged()
                return START_STICKY
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

        startStepCounter()
        startBarometer()
        startHeartRate()

        val serviceScope = CoroutineScope(Dispatchers.Main).also { scope = it }
        ticker = serviceScope.launch {
            // Fixes can be seconds apart; the clock on screen has to keep moving between them.
            while (isActive) {
                RunRecorder.tick()
                // Rate-limited inside the recorder; this only offers the opportunity.
                RunRecorder.snapshot()
                updateNotificationIfChanged()
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
        stopStepCounter()
        stopHeartRate()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        ticker?.cancel()
        runCatching {
            (getSystemService(Context.LOCATION_SERVICE) as LocationManager).removeUpdates(this)
        }
        stopStepCounter()
        stopHeartRate()
        super.onDestroy()
    }

    override fun onLocationChanged(location: Location) {
        RunRecorder.onLocation(location)
    }

    /**
     * Subscribes to the hardware step counter so the recorder can measure cadence.
     *
     * Best-effort: a device with no step counter, or a runner who declined activity recognition,
     * simply records a run with no cadence — the server then falls back to speed alone. The
     * ACTIVITY_RECOGNITION runtime permission only exists on API 29+; below that the sensor needs
     * none. Never a reason to fail the run, so every branch here just returns quietly.
     */
    private fun startStepCounter() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val manager = getSystemService(SensorManager::class.java) ?: return
        val counter = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return
        manager.registerListener(this, counter, SensorManager.SENSOR_DELAY_NORMAL)
        sensorManager = manager
    }

    /**
     * BLE heart rate (NATRUN-07.3): connect the paired sensor for the life of the recording; the
     * monitor reconnects with backoff on its own and the recorder only ever sees real samples.
     */
    private fun startHeartRate() {
        val address = RunSettings.hrSensorAddress ?: return
        val monitor = dz.racedz.nativeapp.feature.runs.record.hr.HeartRateMonitor.shared(this)
        monitor.onSample = { bpm -> RunRecorder.onHeartRate(bpm) }
        monitor.connect(address)
    }

    private fun stopHeartRate() {
        val monitor = dz.racedz.nativeapp.feature.runs.record.hr.HeartRateMonitor.shared(this)
        monitor.onSample = null
        monitor.disconnect()
        RunRecorder.onHeartRateLost()
    }

    /**
     * Barometer (NATRUN-07.6): pressure at a gentle rate for climb that GPS altitude cannot give
     * honestly. Absent on many phones (the M21 among them) — then nothing changes.
     */
    private fun startBarometer() {
        val manager = getSystemService(SensorManager::class.java) ?: return
        val pressure = manager.getDefaultSensor(Sensor.TYPE_PRESSURE) ?: return
        if (manager.registerListener(this, pressure, SensorManager.SENSOR_DELAY_NORMAL)) {
            sensorManager = manager
            RunRecorder.enableBarometer()
        }
    }

    private fun stopStepCounter() {
        runCatching { sensorManager?.unregisterListener(this) }
        sensorManager = null
        RunRecorder.disableBarometer()
    }

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                // values[0] is the cumulative step count since the device last booted.
                val cumulative = event.values.firstOrNull()?.toLong() ?: return
                RunRecorder.onSteps(cumulative)
            }
            Sensor.TYPE_PRESSURE -> event.values.firstOrNull()?.let { RunRecorder.onPressure(it) }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    /** Required by LocationListener on older API levels; the modern callbacks are no-ops here. */
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit

    override fun onProviderEnabled(provider: String) = Unit

    override fun onProviderDisabled(provider: String) = Unit

    private fun notificationManager() = getSystemService(NotificationManager::class.java)

    /**
     * The channel, created once per service instance rather than once per second.
     */
    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || channelReady) return
        notificationManager().createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.runs_notification_channel),
                // Low: this notification exists so the OS keeps us alive and the runner can see
                // recording is on. It should never buzz mid-run.
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) }
        )
        channelReady = true
    }

    /** Built once. The launch target never changes for the life of the service. */
    private fun launchIntent(): PendingIntent? = contentIntent ?: packageManager
        .getLaunchIntentForPackage(packageName)
        ?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
        ?.also { contentIntent = it }

    /**
     * Re-posts the notification only when its visible text has actually changed.
     *
     * The ticker runs every second for the whole run — an hour is 3,600 iterations — and this used
     * to rebuild the channel, mint a PendingIntent, and hand the notification manager a fresh
     * Notification on every one of them. Almost all of that work produced an identical banner. The
     * text is the distance to two decimals and the clock, so it genuinely changes about once a
     * second while running, but not at all while paused or waiting for a first fix, and skipping
     * those is free.
     */
    private fun updateNotificationIfChanged() {
        val text = notificationText()
        if (text == lastNotificationText) return
        lastNotificationText = text
        notificationManager().notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun notificationText(): String {
        val state = RunRecorder.state.value
        // In the account's unit (NATRUN-06.8), like every other place the distance is shown.
        val distance = String.format("%.2f", dz.racedz.nativeapp.core.design.ZidRunUnits.fromKm(state.distanceKm))
        val minutes = state.elapsedSeconds / 60
        val seconds = state.elapsedSeconds % 60
        val body = getString(
            R.string.runs_notification_body,
            distance,
            String.format("%d:%02d", minutes, seconds),
            dz.racedz.nativeapp.core.design.ZidRunUnits.label(this),
        )
        // The paused state is part of the text on purpose: it is what flips the action button, and
        // keying the re-post on the text keeps the "only when changed" rule in one place.
        return if (state.status == RecordingStatus.Paused) "$body · ${getString(R.string.runs_paused)}" else body
    }

    private fun serviceAction(action: String, requestCode: Int): PendingIntent = PendingIntent.getService(
        this,
        requestCode,
        Intent(this, RunTrackingService::class.java).apply { this.action = action },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun pauseAction(): NotificationCompat.Action = pauseAction ?: NotificationCompat.Action.Builder(
        android.R.drawable.ic_media_pause,
        getString(R.string.runs_pause),
        serviceAction(ACTION_PAUSE, 1),
    ).build().also { pauseAction = it }

    private fun resumeAction(): NotificationCompat.Action = resumeAction ?: NotificationCompat.Action.Builder(
        android.R.drawable.ic_media_play,
        getString(R.string.runs_resume),
        serviceAction(ACTION_RESUME, 2),
    ).build().also { resumeAction = it }

    private fun buildNotification(text: String = notificationText()): Notification {
        ensureChannel()
        val launch = launchIntent()

        val paused = RunRecorder.state.value.status == RecordingStatus.Paused
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(getString(R.string.runs_notification_title))
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(launch)
            .addAction(if (paused) resumeAction() else pauseAction())
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
        const val ACTION_PAUSE = "dz.racedz.nativeapp.PAUSE_RUN_TRACKING"
        const val ACTION_RESUME = "dz.racedz.nativeapp.RESUME_RUN_TRACKING"

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
