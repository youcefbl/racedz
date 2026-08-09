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

    /**
     * Turns collection on and records the build's identity.
     *
     * Collection is enabled explicitly rather than left to the manifest default so that this call
     * is the single place the decision lives — if a consent gate is added later it belongs here,
     * not scattered across the SDK's own defaults.
     */
    fun initialise(context: Context, versionName: String, versionCode: Int) {
        if (!isAvailable(context)) return
        runCatching {
            FirebaseCrashlytics.getInstance().apply {
                isCrashlyticsCollectionEnabled = true
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
