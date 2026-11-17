package dz.racedz.nativeapp.feature.runs.record

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.localeOf

/**
 * Tells the runner their recording stopped because the app died, and what they can do about it.
 *
 * Why a notification and not an automatic restart: on Android 12+ a service the OS restarts after
 * killing the app in the background is not allowed back into the foreground and gets no location
 * (measured on the M21, 2026-11-17: the sticky restart was scheduled and then cancelled "due to
 * app idle"; `allowStartForeground=DENIED`, `allowWhileInUsePermissionInFgs=false`). This app does
 * not hold background location on purpose, so a recording can only continue once the runner brings
 * the app back. Tapping this does exactly that, and [RecordingRecovery] continues the same run if
 * it is within its window — or offers what was recorded for saving if not.
 *
 * Posted from the crash handler as the process dies (crashes only: a process the OS kills outright
 * runs no code), and from the service when Android does restart it. Never promised for force-stop.
 */
object RunInterruptionNotice {

    private const val CHANNEL_ID = "run_interruptions"
    private const val NOTIFICATION_ID = 4202

    /**
     * Called from the uncaught-exception handler before the process dies. Makes the run durable
     * and posts the notice; must never throw (it runs inside a crash).
     */
    fun onProcessCrash(context: Context) {
        runCatching {
            val status = RunRecorder.state.value.status
            if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring && status != RecordingStatus.Paused) return
            RunRecorder.snapshot(force = true)
            post(context, System.currentTimeMillis(), canContinue = true)
        }
    }

    /**
     * Whether this notice can reach the runner at all: notifications allowed for the app (Android
     * 13+ asks; any version lets the runner switch them off) and this channel not silenced. When
     * not, a process death mid-run is silent again — the Start screen warns about exactly this
     * before a run begins (review P1, 2026-11-17).
     */
    fun canNotify(context: Context): Boolean {
        val compat = androidx.core.app.NotificationManagerCompat.from(context)
        if (!compat.areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = context.getSystemService(NotificationManager::class.java)?.getNotificationChannel(CHANNEL_ID)
            if (channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE) return false
        }
        return true
    }

    /**
     * @param canContinue true when opening the app now would continue the run (within the window);
     *   false when only saving what was recorded is left.
     */
    fun post(context: Context, stoppedAtEpochMs: Long, canContinue: Boolean) {
        runCatching {
            if (!canNotify(context)) {
                // Nothing will reach the runner; at least the loss is visible in diagnostics.
                RunTelemetry.emit { issue("recorder.interruption_notice_unavailable", context = mapOf("canContinue" to canContinue)) }
                return
            }
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    // High, unlike the silent recording notification: the phone is usually in a
                    // pocket, and the runner has a couple of minutes to act before only salvage is left.
                    NotificationChannel(CHANNEL_ID, context.getString(R.string.runs_interrupted_channel), NotificationManager.IMPORTANCE_HIGH),
                )
            }
            val time = ZidRunFormat.clockTime(stoppedAtEpochMs, localeOf(context))
            val text = context.getString(if (canContinue) R.string.runs_interrupted_continue_notice else R.string.runs_interrupted_notice, time)
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
                PendingIntent.getActivity(context, NOTIFICATION_ID, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            }
            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(context.getString(R.string.runs_interrupted_title))
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(launch)
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()
            manager.notify(NOTIFICATION_ID, notification)
        }
    }

    /** The run was continued, saved or discarded: the notice no longer applies. */
    fun cancel(context: Context) {
        runCatching { context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID) }
    }
}
