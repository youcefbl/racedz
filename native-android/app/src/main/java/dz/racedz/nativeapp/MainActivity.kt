package dz.racedz.nativeapp

import android.content.Intent
import dz.racedz.nativeapp.push.PUSH_HREF_KEY
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : ComponentActivity() {

    /**
     * The zidrun:// link that launched or resumed this Activity, tagged with a monotonic id.
     *
     * The id is what makes re-opening the *same* URL work: Compose keys effects by value, so a
     * bare Uri that equals the previous one would not re-trigger handling and the second tap on
     * an identical link would silently do nothing. It also keeps the link one-shot, so a
     * configuration change cannot replay a spent authorization code.
     */
    private var pendingDeepLink by mutableStateOf<DeepLinkEvent?>(null)

    private var deepLinkSequence = 0L

    private fun receive(uri: Uri?) {
        pendingDeepLink = uri?.let { DeepLinkEvent(it, ++deepLinkSequence) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Shows the system splash (Theme.ZidRunNative.Splash) instantly; releases it as soon as the
        // first Compose frame is ready, then SplashRoute continues the branded handoff in-app.
        val splashScreen = installSplashScreen()
        var isReady = false
        splashScreen.setKeepOnScreenCondition { !isReady }

        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        receive(intent?.data ?: pushDestination(intent))
        val container = (application as ZidRunApplication).container

        setContent {
            ZidRunApp(
                container = container,
                pendingDeepLink = pendingDeepLink,
                onDeepLinkHandled = { pendingDeepLink = null },
                onOpenBrowserSignIn = ::openInCustomTab,
            )
        }
        isReady = true
    }

    /**
     * `launchMode="singleTask"` means the browser's redirect resumes this Activity rather than
     * creating a second one, so the callback arrives here instead of through onCreate.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        receive(intent.data)
    }

    /**
     * Opens the authorization URL in a Custom Tab — the real system browser, sharing its cookie jar
     * and password manager. Deliberately not a WebView: a WebView would let the app observe the
     * user's Google credentials, which is exactly what the PKCE/system-browser pattern exists to
     * prevent, and Google rejects OAuth from embedded webviews anyway.
     */
    private fun openInCustomTab(url: String) {
        CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()
            .launchUrl(this, Uri.parse(url))
    }
}

/** One incoming link, with an identity that changes even when the URL repeats. */
data class DeepLinkEvent(val uri: Uri, val id: Long)

/**
 * Turns a tapped notification's `href` into a link the app already knows how to follow.
 *
 * The server addresses notifications with website paths, because that is what email and the web
 * client need. Only some of them have a native screen — `/account/feed` and `/account/groups/...`
 * are still web-only (NATGAP-04/05) — so an unmapped destination deliberately returns null and the
 * app simply opens where it was. Sending the runner somewhere wrong is worse than sending them home.
 */
internal fun pushDestination(intent: Intent?): Uri? {
    val href = intent?.getStringExtra(PUSH_HREF_KEY)?.trim().orEmpty()
    if (href.isEmpty()) return null
    // Absolute or relative — the server sends a path, but a full URL costs nothing to tolerate.
    val path = runCatching { Uri.parse(href).path ?: href }.getOrDefault(href)
    return when {
        path.startsWith("/account/runs") -> Uri.parse("zidrun://runs")
        path.startsWith("/account/registrations") -> Uri.parse("zidrun://registrations")
        path.startsWith("/races/") ->
            path.removePrefix("/races/").takeIf { it.isNotBlank() }?.let { Uri.parse("zidrun://race/$it") }
        else -> null
    }
}
