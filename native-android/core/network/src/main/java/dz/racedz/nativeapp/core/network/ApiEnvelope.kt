package dz.racedz.nativeapp.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The one response shape every /api/v1 endpoint uses. Mirrors src/lib/api/v1/http.ts on the server:
 * success is `{ data, meta? }`, failure is `{ error: { code, message, details? } }`. Because it is
 * uniform, error handling lives in exactly one place ([ApiResult] / [ApiCallException]) instead of
 * being re-derived per screen.
 */
@Serializable
data class ApiEnvelope<T>(
    val data: T? = null,
    val meta: PageMeta? = null,
    val error: ApiErrorBody? = null,
)

@Serializable
data class ApiErrorBody(
    val code: String = "INTERNAL",
    val message: String = "",
    val details: Map<String, String> = emptyMap(),
)

@Serializable
data class PageMeta(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 1,
    val hasMore: Boolean = false,
    /**
     * Delta-sync endpoints (runs) page by an opaque `updatedAt` cursor instead of a page number, and
     * send the next one here. Null on the offset-paged endpoints, which use [page] instead.
     */
    val nextCursor: String? = null,
)

/**
 * Server error codes the app reacts to differently. Anything unrecognized becomes [Unknown] and is
 * shown as a generic retryable failure — a new server code must never crash an older build.
 */
enum class ApiErrorCode {
    BadRequest,
    ValidationFailed,
    Unauthenticated,
    InvalidCredentials,
    MfaRequired,
    MfaInvalid,
    EmailNotVerified,
    AccountBlocked,
    SessionExpired,
    RefreshReuseDetected,
    Forbidden,
    NotFound,
    Conflict,
    IdempotencyKeyReused,
    /** Onboarding is incomplete; the caller should be sent to fill it in, not shown field errors. */
    ProfileIncomplete,
    RateLimited,
    Unavailable,
    Internal,

    /**
     * No network at all — synthesized on the client, never sent by the server. Its [ApiCallException]
     * message is therefore an untranslated placeholder; UI must substitute a localized string when
     * it sees this code rather than displaying the message.
     */
    Offline,
    Unknown;

    companion object {
        fun fromWire(code: String): ApiErrorCode = when (code) {
            "BAD_REQUEST" -> BadRequest
            "VALIDATION_FAILED" -> ValidationFailed
            "UNAUTHENTICATED" -> Unauthenticated
            "INVALID_CREDENTIALS" -> InvalidCredentials
            "MFA_REQUIRED" -> MfaRequired
            "MFA_INVALID" -> MfaInvalid
            "EMAIL_NOT_VERIFIED" -> EmailNotVerified
            "ACCOUNT_BLOCKED" -> AccountBlocked
            "SESSION_EXPIRED" -> SessionExpired
            "REFRESH_REUSE_DETECTED" -> RefreshReuseDetected
            "FORBIDDEN" -> Forbidden
            "NOT_FOUND" -> NotFound
            "CONFLICT" -> Conflict
        "PROFILE_INCOMPLETE" -> ProfileIncomplete
        "IDEMPOTENCY_KEY_REUSED" -> IdempotencyKeyReused
            "RATE_LIMITED" -> RateLimited
            "UNAVAILABLE" -> Unavailable
            "INTERNAL" -> Internal
            else -> Unknown
        }
    }
}

/**
 * A failed API call. Carries the server's typed code plus its human message, and the per-field
 * validation details when the server sent them, so a form can highlight the right input.
 */
class ApiCallException(
    val code: ApiErrorCode,
    override val message: String,
    val fieldErrors: Map<String, String> = emptyMap(),
    val requestId: String? = null,
    cause: Throwable? = null,
) : Exception(message, cause) {

    /**
     * True when [message] is a generic fallback the UI should replace with a localized string.
     *
     * The server writes its messages in English. For a specific failure that is fine — a validation
     * message names the field, and no client-side string could say it better. But "Something went
     * wrong. Please try again." carries no information the app does not already have, and rendering
     * it untranslated puts an English sentence in the middle of an Arabic screen.
     */
    val isGeneric: Boolean
        get() = code == ApiErrorCode.Offline ||
            code == ApiErrorCode.Internal ||
            code == ApiErrorCode.Unavailable

    /** Whether retrying the identical request could plausibly succeed. */
    val isRetryable: Boolean
        get() = code == ApiErrorCode.Offline ||
            code == ApiErrorCode.Unavailable ||
            code == ApiErrorCode.Internal ||
            code == ApiErrorCode.RateLimited

    /** Whether the user has to sign in again. */
    val requiresSignIn: Boolean
        get() = code == ApiErrorCode.SessionExpired ||
            code == ApiErrorCode.Unauthenticated ||
            code == ApiErrorCode.RefreshReuseDetected ||
            code == ApiErrorCode.AccountBlocked
}

/** Result of one API call. `Failure` always carries an [ApiCallException], never a raw Throwable. */
sealed interface ApiResult<out T> {
    data class Success<T>(val value: T, val meta: PageMeta? = null) : ApiResult<T>
    data class Failure(val error: ApiCallException) : ApiResult<Nothing>

    fun getOrNull(): T? = (this as? Success)?.value
}

@Serializable
data class PaginatedPayload<T>(
    @SerialName("data") val items: List<T> = emptyList(),
)
