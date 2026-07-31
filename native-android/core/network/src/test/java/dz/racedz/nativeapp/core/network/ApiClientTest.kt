package dz.racedz.nativeapp.core.network

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers the parts of [ApiClient] a screen depends on being right: that a typed server error keeps
 * its code and message, that an unparseable failure still becomes a typed error rather than an
 * exception, and — most importantly — that a 401 triggers exactly one refresh-and-replay.
 */
class ApiClientTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun api(provider: AuthTokenProvider = AnonymousTokenProvider): Pair<ZidRunApi, ApiClient> {
        val okHttp: OkHttpClient = NetworkFactory.okHttpClient(provider)
        val api = NetworkFactory.api(okHttp, server.url("/").toString())
        return api to ApiClient(api, provider)
    }

    @Test
    fun `success envelope is unwrapped with its pagination meta`() = runBlocking {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """{"data":[{"id":"r1","slug":"algiers","title":"Algiers Night Run"}],
                       "meta":{"page":1,"limit":20,"total":1,"totalPages":1,"hasMore":false}}"""
                )
        )

        val (api, client) = api()
        val result = client.call { api.races() }

        assertTrue(result is ApiResult.Success)
        val success = result as ApiResult.Success
        assertEquals("Algiers Night Run", success.value.single().title)
        assertEquals(1, success.meta?.total)
        assertEquals(false, success.meta?.hasMore)
    }

    @Test
    fun `typed error body keeps its code, message, and field details`() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(422)
                .setHeader("Content-Type", "application/json")
                .setHeader("X-Request-Id", "req-123")
                .setBody(
                    """{"error":{"code":"VALIDATION_FAILED","message":"Check the highlighted fields.",
                       "details":{"email":"Enter a valid email address."}}}"""
                )
        )

        val (api, client) = api()
        val result = client.call { api.races() }

        val failure = result as ApiResult.Failure
        assertEquals(ApiErrorCode.ValidationFailed, failure.error.code)
        assertEquals("Check the highlighted fields.", failure.error.message)
        assertEquals("Enter a valid email address.", failure.error.fieldErrors["email"])
        assertEquals("req-123", failure.error.requestId)
    }

    @Test
    fun `a non-JSON failure still becomes a typed error rather than throwing`() = runBlocking {
        // What a misconfigured proxy in front of the API would actually return.
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad Gateway</html>"))

        val (api, client) = api()
        val result = client.call { api.races() }

        val failure = result as ApiResult.Failure
        assertEquals(ApiErrorCode.Internal, failure.error.code)
        assertTrue(failure.error.isRetryable)
    }

    @Test
    fun `a dead server surfaces as Offline, not as a crash`() = runBlocking {
        server.shutdown()

        val (api, client) = api()
        val result = client.call { api.races() }

        val failure = result as ApiResult.Failure
        assertEquals(ApiErrorCode.Offline, failure.error.code)
        assertTrue(failure.error.isRetryable)
    }

    @Test
    fun `a 401 refreshes once and replays the request with the new token`() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"error":{"code":"SESSION_EXPIRED","message":"expired"}}""")
        )
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""{"data":{"id":"u1","email":"runner@example.test","displayName":"Runner"}}""")
        )

        var refreshCalls = 0
        val provider = object : AuthTokenProvider {
            var token: String? = "stale-token"
            override fun currentAccessToken(): String? = token
            override suspend fun refreshAccessToken(): String? {
                refreshCalls += 1
                token = "fresh-token"
                return token
            }
        }

        val (api, client) = api(provider)
        val result = client.call { api.me() }

        assertTrue(result is ApiResult.Success)
        assertEquals("runner@example.test", (result as ApiResult.Success).value.email)
        assertEquals(1, refreshCalls)

        assertEquals("Bearer stale-token", server.takeRequest().getHeader("Authorization"))
        // The replay must carry the refreshed token — replaying with the stale one would 401 again.
        assertEquals("Bearer fresh-token", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `when the refresh fails the original 401 reason is preserved`() = runBlocking {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"error":{"code":"REFRESH_REUSE_DETECTED","message":"Signed out for security."}}""")
        )

        val provider = object : AuthTokenProvider {
            override fun currentAccessToken(): String = "stale"
            override suspend fun refreshAccessToken(): String? = null
        }

        val (api, client) = api(provider)
        val failure = client.call { api.me() } as ApiResult.Failure

        // The app shows "signed out for security", not a generic expiry — the distinction matters.
        assertEquals(ApiErrorCode.RefreshReuseDetected, failure.error.code)
        assertTrue(failure.error.requiresSignIn)
    }

    @Test
    fun `every request carries a correlation id and no token when signed out`() = runBlocking {
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody("""{"data":[]}"""))

        val (api, client) = api()
        client.call { api.races() }

        val request = server.takeRequest()
        assertNull(request.getHeader("Authorization"))
        assertTrue(request.getHeader("X-Request-Id")!!.isNotBlank())
    }

    @Test
    fun `unknown server error codes degrade to Unknown instead of failing to parse`() {
        // A newer server may introduce a code this build has never heard of.
        assertEquals(ApiErrorCode.Unknown, ApiErrorCode.fromWire("SOME_FUTURE_CODE"))
        assertEquals(ApiErrorCode.RateLimited, ApiErrorCode.fromWire("RATE_LIMITED"))
    }
}

/**
 * Request encoding, pinned separately because a default-valued field silently vanishing from the
 * payload is invisible in the client and only shows up as a server-side validation error.
 */
class RequestEncodingTest {

    @Test
    fun `fields equal to their default are still sent`() {
        val json = NetworkFactory.json.encodeToString(
            CreateRegistrationRequest.serializer(),
            CreateRegistrationRequest(
                firstName = "Yacine",
                lastName = "Benali",
                phone = "0555123456",
                dateOfBirth = "1995-05-12",
                gender = "MALE",
                wilaya = "Alger",
                city = "Algiers",
                emergencyContactName = "Amina",
                emergencyContactPhone = "0555987654",
                raceCategoryId = "cat-1",
                acceptedTerms = true,
            )
        )

        // The server reads a missing acceptedTerms as false and refuses the registration.
        assertTrue("acceptedTerms must be on the wire: $json", json.contains("\"acceptedTerms\":true"))
    }

    @Test
    fun `optional nulls are omitted rather than sent as null`() {
        val json = NetworkFactory.json.encodeToString(
            LoginRequest.serializer(),
            LoginRequest(email = "runner@example.test", password = "secret"),
        )

        assertTrue("platform default must be sent: $json", json.contains("\"platform\":\"android\""))
        // totp is genuinely absent, not "no second factor supplied as null".
        assertTrue("null totp should be omitted: $json", !json.contains("totp"))
    }
}
