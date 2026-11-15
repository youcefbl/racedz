package dz.racedz.nativeapp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dz.racedz.nativeapp.core.network.AnonymousTokenProvider
import dz.racedz.nativeapp.core.network.NetworkFactory
import dz.racedz.nativeapp.observability.TelemetryQueue
import dz.racedz.nativeapp.observability.TelemetryUploadWorker
import java.io.File
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import retrofit2.Response

/**
 * Diagnostics never land under the wrong account (review P1): runner A's crash queued offline must
 * not be uploaded with runner B's token after an account switch — it goes anonymously — while B's
 * own report still goes as B, and a report made signed out stays anonymous.
 *
 * Uses a real [TelemetryQueue] on disk (in its own folder, so the app's uploader never sees it) and
 * the real drain; only the HTTP post is captured.
 */
@RunWith(AndroidJUnit4::class)
class DiagnosticsOwnershipDeviceTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val dir = File(context.cacheDir, "telemetry-ownership-test").apply { deleteRecursively() }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private class Post(val anonymous: Boolean, val codes: List<String>)

    @Test
    fun runnerAsOfflineCrashIsNeverUploadedAsRunnerB() = runBlocking {
        val queue = TelemetryQueue(dir)
        fun report(code: String) = JSONObject().put("reportId", code).put("code", code)

        // Runner A, offline: a crash and an issue are queued under A.
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, report("a-crash"), "runner-a")
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, report("a-issue"), "runner-a")
        // Signed out: no owner.
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, report("nobody"), null)
        // Runner B signs in and has an issue of their own.
        queue.enqueue(TelemetryQueue.TYPE_DIAGNOSTIC, report("b-issue"), "runner-b")

        val posts = mutableListOf<Post>()
        val deps = TelemetryUploadWorker.Dependencies(
            api = NetworkFactory.api(NetworkFactory.okHttpClient(AnonymousTokenProvider), "http://127.0.0.1:9/"),
            queue = queue,
            currentUserId = { "runner-b" },
            refreshAccessToken = { "runner-b-token" },
            postDiagnostics = { body, anonymous ->
                val text = Buffer().also { body.writeTo(it) }.readUtf8()
                val reports = JSONObject(text).getJSONArray("reports")
                posts += Post(anonymous, (0 until reports.length()).map { reports.getJSONObject(it).getString("code") })
                Response.success(202, "{}".toResponseBody("application/json".toMediaType()))
            },
        )

        val retry = TelemetryUploadWorker.drainForTest(deps)

        assertEquals(false, retry)
        val asB = posts.filter { !it.anonymous }.flatMap { it.codes }
        val anonymous = posts.filter { it.anonymous }.flatMap { it.codes }
        assertEquals(listOf("b-issue"), asB)
        assertEquals(setOf("a-crash", "a-issue", "nobody"), anonymous.toSet())
        assertTrue("everything sent is removed", queue.isEmpty())
    }

    @Test
    fun routeIsSignedInOnlyForTheOwner() {
        val route = TelemetryUploadWorker.Companion::diagnosticRoute
        assertEquals(TelemetryUploadWorker.DiagnosticRoute.SignedIn, route("a", "a"))
        assertEquals(TelemetryUploadWorker.DiagnosticRoute.Anonymous, route("a", "b"))
        assertEquals(TelemetryUploadWorker.DiagnosticRoute.Anonymous, route("a", null))
        assertEquals(TelemetryUploadWorker.DiagnosticRoute.Anonymous, route(null, "b"))
        assertEquals(TelemetryUploadWorker.DiagnosticRoute.Anonymous, route(null, null))
    }
}
