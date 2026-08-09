package dz.racedz.nativeapp.observability

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * Crash and non-fatal reporting (NATGAP-16).
 *
 * Until this existed a native crash was invisible: the website and the Capacitor app both report to
 * Sentry, the native module reported nowhere, and `PR-049` expects a Crashlytics event before
 * rollout. A staged release with no crash signal is a release you cannot judge.
 *
 * Crashlytics rather than Sentry because Firebase is already configured for push, so this is a
 * dependency rather than a second vendor, an extra SDK and another credential to hold.
 *
 * ## What is deliberately NOT sent
 *
 * Crashlytics is given no user identifier. `setUserId` would tie every stack trace to an account
 * and make the crash log a second, unreviewed store of who uses the app — for a runner whose route
 * data is the most sensitive thing here, that is not a trade worth making to group crashes. Custom
 * keys are limited to build/runtime facts (theme, locale, whether a run is recording) that explain
 * a crash without describing the person: no email, no coordinates, no run contents, no tokens.
 */
object CrashReporting {

    /**
     * True when Firebase is configured for this build.
     *
     * `google-services.json` is git-ignored, so a fresh clone and CI have none and the SDK never
     * initialises. Every call here is a no-op in that case rather than an exception.
     */
    private fun isAvailable(context: Context): Boolean = FirebaseApp.getApps(context).isNotEmpty()

    private const val PREFS = "zidrun-observability"
    private const val KEY_ENABLED = "crash-reporting-enabled"

    /**
     * Whether the runner has left crash reporting on. Defaults to on, and is theirs to change.
     *
     * Notice-and-choice, the same model the web uses for cookies: reporting starts enabled because
     * a crash signal is what makes the app fixable, and it is disclosed in `docs/DATA_INVENTORY.md`
     * and switchable in Privacy & data. What makes that defensible is what is NOT sent — no user
     * id, no run data, no location (see the class note). If that ever changes, this becomes an
     * opt-IN and the default here has to move with it.
     */
    fun isEnabled(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ENABLED, true)

    /** Applies the runner's choice immediately — the SDK honours this without a restart. */
    fun setEnabled(context: Context, enabled: Boolean) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_ENABLED, enabled).apply()
        if (!isAvailable(context)) return
        runCatching { FirebaseCrashlytics.getInstance().isCrashlyticsCollectionEnabled = enabled }
    }

    /**
     * Applies the stored choice and records the build's identity.
     *
     * Collection is set explicitly rather than left to the manifest default, so this call is the
     * single place the decision lives instead of being split between the SDK's defaults and here.
     */
    fun initialise(context: Context, versionName: String, versionCode: Int) {
        if (!isAvailable(context)) return
        val enabled = isEnabled(context)
        runCatching {
            FirebaseCrashlytics.getInstance().apply {
                isCrashlyticsCollectionEnabled = enabled
                setCustomKey("versionName", versionName)
                setCustomKey("versionCode", versionCode)
            }
        }
    }

    /**
     * Records a handled failure that the runner did not see as a crash.
     *
     * The interesting native failures are mostly these rather than fatals: a run that would not
     * save, a snapshot that would not write. [where] is a short call-site tag, never a message
     * built from user data.
     */
    fun recordNonFatal(context: Context, where: String, error: Throwable) {
        if (!isAvailable(context)) return
        runCatching {
            FirebaseCrashlytics.getInstance().apply {
                setCustomKey("where", where)
                recordException(error)
            }
        }
    }

    /**
     * A breadcrumb attached to whatever crashes next.
     *
     * Same rule as everything else here: describe what the app was doing, never what the runner's
     * data contains.
     */
    fun log(context: Context, message: String) {
        if (!isAvailable(context)) return
        runCatching { FirebaseCrashlytics.getInstance().log(message) }
    }

    /**
     * Forces a crash. Debug builds only — this is how `PR-049` gets its verifying event, and it
     * must be impossible to reach from a release build.
     */
    fun forceTestCrash() {
        throw IllegalStateException("ZidRun native Crashlytics verification crash (PR-049)")
    }
}
