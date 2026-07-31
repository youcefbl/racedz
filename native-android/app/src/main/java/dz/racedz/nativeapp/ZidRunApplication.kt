package dz.racedz.nativeapp

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import okhttp3.OkHttpClient

/**
 * App-wide entry point. Builds the dependency graph and nothing else — no crash reporting and no
 * analytics SDK is wired up yet; those arrive with their own privacy/security review per
 * docs/NATIVE_ANDROID_OPTION_PLAN.md rather than being added speculatively.
 */
class ZidRunApplication : Application(), ImageLoaderFactory {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this, BuildConfig.VERSION_NAME)
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
