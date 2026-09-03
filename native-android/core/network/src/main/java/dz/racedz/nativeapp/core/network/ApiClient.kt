package dz.racedz.nativeapp.core.network

import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Response
import retrofit2.Retrofit

/**
 * Supplies the current access token and knows how to renew it. Implemented in :core:auth — this
 * interface exists so the network module never has to depend on the session/token storage layer,
 * which would be a dependency cycle.
 */
interface AuthTokenProvider {
    /** Current access token, or null when signed out. Must not block on the network. */
    fun currentAccessToken(): String?

    /**
     * Called once after a 401. Returns the new access token, or null when the session is truly
     * gone and the user has to sign in again. Implementations must serialize concurrent callers so
     * a burst of 401s triggers a single refresh, not one per request.
     */
    suspend fun refreshAccessToken(): String?
}

/** Provider used before sign-in and in tests: always anonymous, never refreshes. */
object AnonymousTokenProvider : AuthTokenProvider {
    override fun currentAccessToken(): String? = null
    override suspend fun refreshAccessToken(): String? = null
}

/**
 * Wraps [ZidRunApi] with the parts every call needs: the Bearer header, a per-request correlation
 * id, one transparent retry after a token refresh, and translation of every failure mode into an
 * [ApiCallException] with a typed code. Screens therefore only ever see [ApiResult].
 */
class ApiClient(
    private val api: ZidRunApi,
    private val tokenProvider: AuthTokenProvider,
    /**
     * The client [api] was built on. Optional only so existing tests/call sites that predate this
     * parameter keep compiling — every real caller should pass the one it built, so failure
     * recovery below actually has a pool to clear.
     */
    private val okHttpClient: OkHttpClient? = null,
) {

    /**
     * Runs an API call, and on a 401 refreshes the session once and replays it.
     *
     * The replay is deliberately limited to one attempt and only for 401: retrying a write on any
     * other failure risks performing it twice, and the registration endpoint's idempotency key —
     * not a blind retry here — is what makes that particular call safe to repeat.
     */
    suspend fun <T> call(block: suspend () -> Response<ApiEnvelope<T>>): ApiResult<T> {
        return try {
            val first = block()
            if (first.code() != 401) {
                return interpret(first)
            }

            val refreshed = tokenProvider.refreshAccessToken()
            if (refreshed == null) {
                // Preserve the server's own reason (session expired vs. reuse detected vs. blocked)
                // so the app can explain why the user is being signed out.
                interpret(first)
            } else {
                interpret(block())
            }
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (io: IOException) {
            // Every pooled connection this client is holding may be the reason this failed — a
            // route that quietly went bad (an edge IP that stopped answering, a socket half-closed
            // by a middlebox after the app sat backgrounded for hours) fails the same way on every
            // retry, because OkHttp's own reuse keeps offering the same broken connection back.
            // Found for real (2026-09-04): a build left running unattended for ~26h stopped
            // reaching a server that was never actually down — proven by the same request working
            // instantly from the device's own browser — and no amount of tapping "Try again" inside
            // the app recovered; only force-stopping it did, which drops every socket the process
            // holds. Evicting here gives every later attempt (the runner's next tap, or an
            // automatic retry) a guaranteed-fresh connection instead, without the runner ever
            // needing to know a restart was the fix. Safe to call unconditionally: on a build that
            // predates this parameter, or when genuinely offline, there is nothing to evict and
            // this is a no-op either way.
            okHttpClient?.connectionPool?.evictAll()
            ApiResult.Failure(
                ApiCallException(ApiErrorCode.Offline, "You appear to be offline. Check your connection.", cause = io)
            )
        } catch (error: Throwable) {
            ApiResult.Failure(
                ApiCallException(ApiErrorCode.Unknown, "Something went wrong. Please try again.", cause = error)
            )
        }
    }

    private fun <T> interpret(response: Response<ApiEnvelope<T>>): ApiResult<T> {
        val requestId = response.headers()["X-Request-Id"]
        val body = response.body()

        if (response.isSuccessful) {
            val data = body?.data
                ?: return ApiResult.Failure(
                    ApiCallException(ApiErrorCode.Internal, "The server sent an unexpected response.", requestId = requestId)
                )
            return ApiResult.Success(data, body.meta)
        }

        // A non-2xx from our own API carries the typed envelope in errorBody(); anything else
        // (a proxy error page, an HTML 502) falls back to a status-derived code.
        val parsed = runCatching {
            response.errorBody()?.string()?.takeIf { it.isNotBlank() }?.let {
                lenientJson.decodeFromString(ApiEnvelope.serializer(UnitSerializerStub), it)
            }
        }.getOrNull()

        val error = parsed?.error
        return ApiResult.Failure(
            ApiCallException(
                code = error?.code?.let(ApiErrorCode::fromWire) ?: statusToCode(response.code()),
                message = error?.message?.takeIf { it.isNotBlank() } ?: defaultMessage(response.code()),
                fieldErrors = error?.details?.fields.orEmpty(),
                requestId = requestId,
            )
        )
    }

    private fun statusToCode(status: Int): ApiErrorCode = when (status) {
        400 -> ApiErrorCode.BadRequest
        401 -> ApiErrorCode.SessionExpired
        403 -> ApiErrorCode.Forbidden
        404 -> ApiErrorCode.NotFound
        409 -> ApiErrorCode.Conflict
        422 -> ApiErrorCode.ValidationFailed
        429 -> ApiErrorCode.RateLimited
        503 -> ApiErrorCode.Unavailable
        else -> if (status >= 500) ApiErrorCode.Internal else ApiErrorCode.Unknown
    }

    private fun defaultMessage(status: Int): String = when {
        status == 404 -> "That is no longer available."
        status == 429 -> "Too many requests. Please wait a moment."
        status >= 500 -> "ZidRun is having trouble right now. Please try again."
        else -> "Something went wrong. Please try again."
    }

    companion object {
        private val lenientJson = Json { ignoreUnknownKeys = true; isLenient = true }

        /**
         * Error envelopes never carry a `data` payload, so the element type is irrelevant when
         * parsing one — this stands in for it rather than making [interpret] generic over a
         * serializer it does not have at runtime.
         */
        private val UnitSerializerStub = kotlinx.serialization.serializer<String?>()
    }
}

/**
 * Adds the Bearer token and an `X-Request-Id` to every request. The id is generated per attempt so
 * a client-side report ("this failed") can be matched to one server log line.
 *
 * The token is read fresh on each call rather than captured, so a refresh that happened between
 * building the client and issuing the request is picked up.
 */
internal class AuthHeaderInterceptor(private val tokenProvider: AuthTokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): okhttp3.Response {
        val original = chain.request()
        val builder: Request.Builder = original.newBuilder()
            .header("X-Request-Id", UUID.randomUUID().toString())
            .header("Accept", "application/json")

        tokenProvider.currentAccessToken()?.let { token ->
            builder.header("Authorization", "Bearer $token")
        }

        // A marker the app puts on calls whose server work happens inside the request. It is a local
        // convention only, so it is removed before the request goes out rather than being sent to a
        // server that has no idea what it means.
        val slow = original.header(SLOW_CALL_HEADER) != null
        if (slow) builder.removeHeader(SLOW_CALL_HEADER)

        val request = builder.build()
        return if (slow) {
            chain.withReadTimeout(SLOW_CALL_READ_TIMEOUT_SECONDS_INT, TimeUnit.SECONDS).proceed(request)
        } else {
            chain.proceed(request)
        }
    }
}

/**
 * Marks a call whose response waits on real server-side work (today: coach generation).
 *
 * Aborting such a call client-side does not cancel the work — the server finishes it and, for the
 * coach, still counts it against the runner's daily quota. So the timeout has to be sized for the
 * work, not for the network.
 */
const val SLOW_CALL_HEADER: String = "X-ZidRun-Slow-Call"

/** Long enough for a slow generation, short enough that a genuinely dead request still ends. */
internal const val SLOW_CALL_READ_TIMEOUT_SECONDS_INT: Int = 120

object NetworkFactory {

    /**
     * Shared JSON config.
     *
     * `encodeDefaults = true` is load-bearing, not tidiness: kotlinx-serialization omits any
     * property whose value equals its declared default, so `acceptedTerms = true` would never
     * reach the wire and the server's `z.coerce.boolean().refine(Boolean)` would read the missing
     * field as false and reject the registration. Any request DTO with a default is affected.
     *
     * `explicitNulls = false` still omits nulls, which is what optional fields want.
     * `ignoreUnknownKeys` means a server deploy that adds a field cannot break an installed app.
     */
    val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        encodeDefaults = true
    }

    fun okHttpClient(tokenProvider: AuthTokenProvider): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthHeaderInterceptor(tokenProvider))
            .connectTimeout(java.time.Duration.ofSeconds(15))
            .readTimeout(java.time.Duration.ofSeconds(30))
            .writeTimeout(java.time.Duration.ofSeconds(30))
            // Deliberately no logging interceptor even in debug: request bodies here contain
            // passwords, tokens, and payment proofs, and logcat is readable by adb.
            .build()

    /** Base URL for this build type. Debug points at the dev machine (10.0.2.2 is the emulator's
     *  alias for the host); release is HTTPS production and is not overridable at runtime. */
    val baseUrl: String get() = BuildConfig.API_BASE_URL

    fun api(client: OkHttpClient, baseUrl: String = NetworkFactory.baseUrl): ZidRunApi =
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ZidRunApi::class.java)
}

/**
 * Turns an image path from the API into something an image loader can fetch.
 *
 * The server stores uploads as site-relative paths (`/uploads/race/2026-08/x.jpg`) because that is
 * what the website renders. A native client has no page origin to resolve them against, so Coil
 * would silently fail and leave a blank card. Absolute URLs are passed through untouched.
 */
fun resolveMediaUrl(path: String?): String? {
    if (path.isNullOrBlank()) return null
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    return NetworkFactory.baseUrl.trimEnd('/') + "/" + path.trimStart('/')
}
