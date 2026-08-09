package dz.racedz.nativeapp

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import okhttp3.OkHttpClient

/**
 * App-wide entry point. Builds the dependency graph and starts crash reporting.
 *
 * Crash reporting (NATGAP-16) is deliberately the only SDK initialised here, and it sends no user
 * identifier — see CrashReporting for what is and is not collected. Analytics stays first-party
 * (POST /api/v1/track) rather than a third-party SDK, so there is nothing else to start.
 */
class ZidRunApplication : Application(), ImageLoaderFactory {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(
            this,
            BuildConfig.VERSION_NAME,
            AppInfo(
                versionName = BuildConfig.VERSION_NAME,
                versionCode = BuildConfig.VERSION_CODE,
                releaseDate = BuildConfig.RELEASE_DATE,
            ),
        )
        // Before restore(), so a crash inside session restoration is itself reported.
        dz.racedz.nativeapp.observability.CrashReporting.initialise(
            context = this,
            versionName = BuildConfig.VERSION_NAME,
            versionCode = BuildConfig.VERSION_CODE,
        )
        container.sessionManager.restore()
    }

    /**
     * Coil's shared loader, with an identifying User-Agent on every image request.
     *
     * OpenStreetMap's tile usage policy requires apps to identify themselves, and their servers
     * answer a generic HTTP-client User-Agent with a "Access blocked — not following the tile usage
     * policy" image instead of a tile. Coil's default is exactly such a generic agent, so the run
     * map rendered that refusal on every tile until this existed.
     */
    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .okHttpClient {
                OkHttpClient.Builder()
                    .addInterceptor { chain ->
                        chain.proceed(
                            chain.request().newBuilder()
                                .header("User-Agent", "ZidRun/${BuildConfig.VERSION_NAME} (Android; https://zidrun.com)")
                                .build()
                        )
                    }
                    .build()
            }
            .build()
}
