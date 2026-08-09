package dz.racedz.nativeapp.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dz.racedz.nativeapp.MainActivity
import dz.racedz.nativeapp.R
import dz.racedz.nativeapp.core.design.R as DesignR
import dz.racedz.nativeapp.ZidRunApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The key the server puts the destination path under, and the extra it is forwarded to the Activity
 * as. `sendFirebasePush` sets `data.href` on every message; a payload without one is still shown,
 * it just opens the app where it left off.
 */
const val PUSH_HREF_KEY = "href"

/** One channel: these are all "something happened in your training or your race". */
private const val CHANNEL_ID = "zidrun_general"

/**
 * Receives pushes and keeps this device's FCM token registered.
 *
 * Registration is deliberately not tied to a screen. The server's three dispatch crons (training
 * reminder, inactivity nudge, broadcast) have always selected from `PushSubscription`, and until
 * this existed a native-only runner had no row in it — every one of those messages was addressed to
 * nobody. The token is therefore refreshed on every launch of a signed-in app, not just at sign-in.
 */
class ZidRunMessagingService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * FCM rotates tokens (app restore, data clear, its own schedule). A stale token silently stops
     * delivering, so the new one is registered immediately rather than at the next sign-in.
     */
    override fun onNewToken(token: String) {
        val container = (application as? ZidRunApplication)?.container ?: return
        scope.launch { container.pushRegistrar.register(token) }
    }

    /**
     * Only fires while the app is in the FOREGROUND.
     *
     * The server sends a `notification` block, which the system tray renders by itself when the app
     * is backgrounded or dead — and in that case this method is never called. So this is not the
     * main delivery path; it exists so a message arriving while the runner is looking at the app is
     * not silently swallowed, which is what happens if you leave it unimplemented.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: return
        val body = message.notification?.body.orEmpty()
        showNotification(this, title, body, message.data[PUSH_HREF_KEY])
    }
}

/** Creates the channel. Safe to call repeatedly — the system ignores a channel it already has. */
fun ensurePushChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
        CHANNEL_ID,
        context.getString(DesignR.string.push_channel_name),
        NotificationManager.IMPORTANCE_DEFAULT,
    ).apply { description = context.getString(DesignR.string.push_channel_description) }
    ContextCompat.getSystemService(context, NotificationManager::class.java)
        ?.createNotificationChannel(channel)
}

private fun showNotification(context: Context, title: String, body: String, href: String?) {
    ensurePushChannel(context)

    // From API 33 posting is a runtime permission. Without this check the notify() below is a
    // silent no-op, which is indistinguishable from a delivery failure when debugging.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
        PackageManager.PERMISSION_GRANTED
    ) {
        return
    }

    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        if (!href.isNullOrBlank()) putExtra(PUSH_HREF_KEY, href)
    }
    val pending = PendingIntent.getActivity(
        context,
        // Keyed on the destination so two notifications for different places do not overwrite each
        // other's extras — the classic bug where every notification opens whatever the last one was.
        href.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_zidrun)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setContentIntent(pending)
        .build()

    NotificationManagerCompat.from(context).notify(href.hashCode(), notification)
}

/**
 * Registers and revokes this device's token against the server.
 *
 * Every call is best-effort and silent. Push is an enhancement: a runner whose token failed to
 * register still has a working app, and an error dialog about it would be noise they cannot act on.
 */
class PushRegistrar(
    private val context: Context,
    private val registerToken: suspend (String, String?) -> Boolean,
    private val revokeToken: suspend (String) -> Boolean,
) {

    /** False when this build has no Firebase config, so nothing here can work. */
    val isAvailable: Boolean get() = FirebaseApp.getApps(context).isNotEmpty()

    suspend fun register(token: String) {
        if (!isAvailable) return
        runCatching { registerToken(token, deviceLabel()) }
    }

    /** Asks FCM for the current token and registers it. Called once per launch when signed in. */
    suspend fun registerCurrentToken() {
        if (!isAvailable) return
        val token = runCatching { currentToken() }.getOrNull() ?: return
        register(token)
    }

    /**
     * Revokes the token on sign-out.
     *
     * Without this the row stays active and the *next* person to sign in on this device would keep
     * receiving the previous account's reminders — the token belongs to the app install, not to the
     * account.
     */
    suspend fun revokeCurrentToken() {
        if (!isAvailable) return
        val token = runCatching { currentToken() }.getOrNull() ?: return
        runCatching { revokeToken(token) }
    }

    /**
     * Stops this device receiving, without needing a valid session.
     *
     * The authenticated revoke above is the clean path, but it is unavailable exactly when it is
     * most needed: an expired refresh token or a server-side revocation clears the tokens, so
     * there is nothing left to authenticate with — and the subscription row would stay active with
     * the previous account's notifications still arriving on this phone.
     *
     * Deleting the token at FCM works regardless. Delivery stops immediately, and the server row
     * self-heals: the next send gets NOT_FOUND / INVALID_ARGUMENT, which sendFirebasePush already
     * reports as shouldRevokeToken. A new token is minted and registered on the next sign-in.
     */
    fun invalidateLocalToken() {
        if (!isAvailable) return
        runCatching { FirebaseMessaging.getInstance().deleteToken() }
    }

    private suspend fun currentToken(): String =
        kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token -> if (continuation.isActive) continuation.resume(token) { _, _, _ -> } }
                .addOnFailureListener { error -> if (continuation.isActive) continuation.cancel(error) }
        }

    /** What the runner sees in "Signed-in devices". Model only — never anything identifying. */
    private fun deviceLabel(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
}
