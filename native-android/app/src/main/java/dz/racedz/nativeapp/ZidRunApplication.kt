package dz.racedz.nativeapp

import android.app.Application

/**
 * App-wide entry point. Builds the dependency graph and nothing else — no crash reporting and no
 * analytics SDK is wired up yet; those arrive with their own privacy/security review per
 * docs/NATIVE_ANDROID_OPTION_PLAN.md rather than being added speculatively.
 */
class ZidRunApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this, BuildConfig.VERSION_NAME)
        container.sessionManager.restore()
    }
}
