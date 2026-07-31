package dz.racedz.nativeapp.core.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** What the app persists about a signed-in session. Never logged, never put in a Bundle. */
data class StoredSession(
    val accessToken: String,
    val refreshToken: String,
    /** Wall-clock ms when the access token stops being accepted. */
    val accessExpiresAtMs: Long,
    val userId: String,
    val email: String,
    val displayName: String,
)

/**
 * Persistent token storage backed by [EncryptedSharedPreferences] — AES-256-GCM with the key held
 * in the Android Keystore, so the file on disk is useless without the device's hardware-backed key.
 *
 * Why not plain SharedPreferences: on a rooted or backed-up device the plaintext file is readable,
 * and a refresh token is a 60-day credential. `android:allowBackup="false"` in the manifest keeps
 * these out of cloud backup as well.
 *
 * If the Keystore entry is ever unusable (key invalidated by a lock-screen change, restored backup
 * from another device), the file is discarded and the user signs in again — the alternative,
 * silently falling back to unencrypted storage, would quietly downgrade the guarantee.
 */
class TokenStore(context: Context) {

    private val appContext = context.applicationContext
    private var cached: StoredSession? = null

    private val prefs: SharedPreferences by lazy { openPrefs() }

    private fun openPrefs(): SharedPreferences = try {
        create(appContext)
    } catch (error: Throwable) {
        appContext.deleteSharedPreferences(FILE_NAME)
        create(appContext)
    }

    private fun create(context: Context): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    @Synchronized
    fun read(): StoredSession? {
        cached?.let { return it }
        val access = prefs.getString(KEY_ACCESS, null) ?: return null
        val refresh = prefs.getString(KEY_REFRESH, null) ?: return null
        val session = StoredSession(
            accessToken = access,
            refreshToken = refresh,
            accessExpiresAtMs = prefs.getLong(KEY_ACCESS_EXPIRES, 0L),
            userId = prefs.getString(KEY_USER_ID, "").orEmpty(),
            email = prefs.getString(KEY_EMAIL, "").orEmpty(),
            displayName = prefs.getString(KEY_DISPLAY_NAME, "").orEmpty(),
        )
        cached = session
        return session
    }

    @Synchronized
    fun write(session: StoredSession) {
        cached = session
        prefs.edit()
            .putString(KEY_ACCESS, session.accessToken)
            .putString(KEY_REFRESH, session.refreshToken)
            .putLong(KEY_ACCESS_EXPIRES, session.accessExpiresAtMs)
            .putString(KEY_USER_ID, session.userId)
            .putString(KEY_EMAIL, session.email)
            .putString(KEY_DISPLAY_NAME, session.displayName)
            .apply()
    }

    @Synchronized
    fun clear() {
        cached = null
        prefs.edit().clear().apply()
    }

    private companion object {
        const val FILE_NAME = "zidrun_session"
        const val KEY_ACCESS = "access_token"
        const val KEY_REFRESH = "refresh_token"
        const val KEY_ACCESS_EXPIRES = "access_expires_at"
        const val KEY_USER_ID = "user_id"
        const val KEY_EMAIL = "email"
        const val KEY_DISPLAY_NAME = "display_name"
    }
}
