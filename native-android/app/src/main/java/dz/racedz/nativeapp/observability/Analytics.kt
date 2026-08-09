package dz.racedz.nativeapp.observability

import android.content.Context
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * First-party screen-view tracking (NATGAP-17).
 *
 * The admin funnel and search-insight dashboards count `PageView` rows, and native sent none — so
 * as native adoption grows the dashboards silently under-report rather than showing a gap. This
 * makes the app visible in them as `platform = "android"`.
 *
 * ## Why ids are minted here rather than by the server
 *
 * The website identifies a visitor by first-party cookie. A native client has no cookie jar, so
 * had it simply posted to the same endpoint every beacon would have minted a *new* visitor and
 * every screen view would have counted as a unique visitor — worse than not tracking at all,
 * because the number would look plausible. The device therefore holds the two ids, with the same
 * lifetimes the cookies have.
 *
 * Both are random UUIDs, stored in the app's own preferences. Deliberately NOT `ANDROID_ID` or any
 * hardware identifier: this must not survive a reinstall, must not be correlatable with any other
 * app, and must be something the runner can clear by clearing app data.
 *
 * No third-party analytics SDK is involved, so there is nothing here that phones home to anyone
 * but this project's own server.
 */
class Analytics(
    private val context: Context,
    private val send: suspend (path: String, locale: String?, visitorId: String, sessionId: String) -> Unit,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefs by lazy {
        context.applicationContext.getSharedPreferences("zidrun-analytics", Context.MODE_PRIVATE)
    }

    /** Stable across launches, cleared with app data. */
    private val visitorId: String
        get() = prefs.getString(KEY_VISITOR, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(KEY_VISITOR, it).apply()
        }

    /**
     * The current session, rotated after [SESSION_IDLE_MS] of inactivity.
     *
     * Matches the website's 30-minute rolling session cookie so "sessions" means the same thing in
     * the dashboard whichever client produced the row.
     */
    private fun currentSessionId(): String {
        val now = System.currentTimeMillis()
        val lastSeen = prefs.getLong(KEY_SESSION_AT, 0L)
        val existing = prefs.getString(KEY_SESSION, null)
        val id = if (existing == null || now - lastSeen > SESSION_IDLE_MS) {
            UUID.randomUUID().toString()
        } else {
            existing
        }
        prefs.edit().putString(KEY_SESSION, id).putLong(KEY_SESSION_AT, now).apply()
        return id
    }

    /**
     * Records one screen view. Fire-and-forget and silent by design.
     *
     * [path] is a website-shaped path ("/account/runs") rather than a native route name, so a
     * screen and the web page it mirrors aggregate to one row in the dashboard instead of two
     * spellings of the same thing.
     */
    fun screen(path: String, locale: String? = null) {
        scope.launch { runCatching { send(path, locale, visitorId, currentSessionId()) } }
    }

    private companion object {
        const val KEY_VISITOR = "visitor-id"
        const val KEY_SESSION = "session-id"
        const val KEY_SESSION_AT = "session-at"
        const val SESSION_IDLE_MS = 30 * 60 * 1000L
    }
}
