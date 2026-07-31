package dz.racedz.nativeapp.core.network

import kotlinx.serialization.Serializable

// Wire models for /api/v1. Every field here has a counterpart in src/lib/api/v1/dto.ts on the
// server; nothing is invented client-side. All are declared with defaults so a response missing a
// newly-added optional field still parses on an older build.

@Serializable
data class TokenPairDto(
    val accessToken: String = "",
    val expiresIn: Long = 0,
    val refreshToken: String = "",
    val refreshExpiresAt: String = "",
    val sessionId: String = "",
)

@Serializable
data class AuthSessionDto(
    val tokens: TokenPairDto = TokenPairDto(),
    val user: UserDto = UserDto(),
)

@Serializable
data class RefreshResponseDto(val tokens: TokenPairDto = TokenPairDto())

@Serializable
data class UserPreferencesDto(
    val language: String? = null,
    val theme: String? = null,
    val profilePrivate: Boolean = false,
)

@Serializable
data class SeasonDto(
    val races: Int = 0,
    val runs: Int = 0,
    val totalDistanceKm: Double = 0.0,
)

@Serializable
data class UserDto(
    val id: String = "",
    val email: String = "",
    val firstName: String = "",
    val lastName: String = "",
    val displayName: String = "",
    val role: String = "RUNNER",
    val avatarUrl: String? = null,
    val phone: String? = null,
    val gender: String? = null,
    val dateOfBirth: String? = null,
    val wilaya: String? = null,
    val city: String? = null,
    val emailVerified: Boolean = false,
    val mfaEnabled: Boolean = false,
    val preferences: UserPreferencesDto = UserPreferencesDto(),
    val season: SeasonDto = SeasonDto(),
)

@Serializable
data class RaceSummaryDto(
    val id: String = "",
    val slug: String = "",
    val title: String = "",
    val raceType: String = "OTHER",
    val registrationStatus: String = "NOT_OPEN",
    val startDate: String = "",
    val endDate: String? = null,
    val wilaya: String = "",
    val city: String = "",
    val mainImageUrl: String? = null,
    val organizerName: String = "",
    val distancesKm: List<Double> = emptyList(),
    val minPriceDzd: Int? = null,
    val availablePlaces: Int? = null,
)

@Serializable
data class RaceCategoryDto(
    val id: String = "",
    val name: String = "",
    val distanceKm: Double = 0.0,
    val elevationGainM: Int? = null,
    val priceDzd: Int? = null,
    val maxParticipants: Int? = null,
    val startTime: String? = null,
    val cutoffTimeMin: Int? = null,
)

@Serializable
data class RaceAnnouncementDto(
    val id: String = "",
    val title: String = "",
    val body: String = "",
    val publishedAt: String = "",
)

@Serializable
data class MyRegistrationRefDto(
    val id: String = "",
    val status: String = "",
    val paymentStatus: String = "",
    val raceCategoryId: String = "",
)

@Serializable
data class RaceDetailDto(
    val id: String = "",
    val slug: String = "",
    val title: String = "",
    val raceType: String = "OTHER",
    val registrationStatus: String = "NOT_OPEN",
    val startDate: String = "",
    val endDate: String? = null,
    val wilaya: String = "",
    val city: String = "",
    val commune: String? = null,
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val mainImageUrl: String? = null,
    val organizerName: String = "",
    val distancesKm: List<Double> = emptyList(),
    val minPriceDzd: Int? = null,
    val availablePlaces: Int? = null,
    val description: String = "",
    val registrationOpenAt: String? = null,
    val registrationCloseAt: String? = null,
    val rules: String? = null,
    val requiredDocuments: String? = null,
    val elevationGainText: String? = null,
    val conditions: String? = null,
    val shirtEnabled: Boolean = false,
    val contactEmail: String? = null,
    val contactPhone: String? = null,
    val maxParticipants: Int? = null,
    val categories: List<RaceCategoryDto> = emptyList(),
    val announcements: List<RaceAnnouncementDto> = emptyList(),
    val myRegistration: MyRegistrationRefDto? = null,
)

@Serializable
data class PaymentInstructionsDto(
    val baridiMobNumber: String? = null,
    val ccpAccount: String? = null,
    val ccpKey: String? = null,
    val note: String? = null,
)

@Serializable
data class RegistrationRaceDto(
    val id: String = "",
    val slug: String = "",
    val title: String = "",
    val startDate: String = "",
    val wilaya: String = "",
    val city: String = "",
)

@Serializable
data class RegistrationCategoryDto(
    val id: String = "",
    val name: String = "",
    val distanceKm: Double = 0.0,
    val priceDzd: Int? = null,
)

@Serializable
data class RegistrationDto(
    val id: String = "",
    val status: String = "",
    val paymentStatus: String = "",
    val paymentMethod: String? = null,
    val hasPaymentProof: Boolean = false,
    val bibNumber: String? = null,
    val createdAt: String = "",
    val race: RegistrationRaceDto = RegistrationRaceDto(),
    val category: RegistrationCategoryDto = RegistrationCategoryDto(),
    val paymentInstructions: PaymentInstructionsDto? = null,
)

@Serializable
data class DeviceSessionDto(
    val id: String = "",
    val platform: String = "",
    val appVersion: String? = null,
    val deviceName: String? = null,
    val createdAt: String = "",
    val lastUsedAt: String = "",
    val current: Boolean = false,
)

@Serializable
data class AppConfigDto(
    val apiVersion: Int = 1,
    val minimumVersionCode: Int = 1,
    val recommendedVersionCode: Int = 1,
    val maintenance: Boolean = false,
    val features: AppFeaturesDto = AppFeaturesDto(),
)

@Serializable
data class AppFeaturesDto(
    val runs: Boolean = false,
    val coach: Boolean = false,
    val registration: Boolean = true,
    val googleSignIn: Boolean = false,
)

@Serializable
data class RegisterAccountResultDto(
    val email: String = "",
    val verificationEmailSent: Boolean = false,
    val requiresEmailVerification: Boolean = true,
)

// ---- request bodies --------------------------------------------------------------------------

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    val totp: String? = null,
    val platform: String = "android",
    val appVersion: String? = null,
    val deviceName: String? = null,
)

@Serializable
data class RegisterRequest(
    val fullName: String,
    val email: String,
    val password: String,
    val acceptedTerms: Boolean,
    val language: String? = null,
)

@Serializable
data class RefreshRequest(
    val refreshToken: String,
    val platform: String = "android",
    val appVersion: String? = null,
    val deviceName: String? = null,
)

@Serializable
data class LogoutRequest(val refreshToken: String)

@Serializable
data class ResendVerificationRequest(val email: String, val language: String? = null)

@Serializable
data class PkceTokenRequest(
    val code: String,
    val codeVerifier: String,
    val platform: String = "android",
    val appVersion: String? = null,
    val deviceName: String? = null,
)

@Serializable
data class PreferencesRequest(
    val language: String? = null,
    val theme: String? = null,
    val profilePrivate: Boolean? = null,
)

@Serializable
data class ProfileRequest(
    val firstName: String? = null,
    val lastName: String? = null,
    val phone: String? = null,
    val gender: String? = null,
    val dateOfBirth: String? = null,
    val wilaya: String? = null,
    val city: String? = null,
)

@Serializable
data class CreateRegistrationRequest(
    val firstName: String,
    val lastName: String,
    val phone: String,
    val dateOfBirth: String,
    val gender: String,
    val wilaya: String,
    val city: String,
    val emergencyContactName: String,
    val emergencyContactPhone: String,
    val clubName: String? = null,
    val raceCategoryId: String,
    val tshirtSize: String? = null,
    val acceptedTerms: Boolean = true,
)

@Serializable
data class DeletionRequestBody(val reason: String? = null)

@Serializable
data class SignedOutDto(val signedOut: Boolean = true, val revokedSessions: Int = 0)

@Serializable
data class SentDto(val sent: Boolean = true)

@Serializable
data class SubmittedDto(val submitted: Boolean = true)

// ---- runs -------------------------------------------------------------------------------------

/**
 * One point of a recorded route, in the website's own shape (runRoutePointSchema) rather than a
 * mobile-specific one — the shared create helper parses routes with that schema, so any key it does
 * not know is silently dropped on upload.
 *
 * [ele] is metres above sea level. [t] is a timestamp in MILLISECONDS, not seconds. Both are
 * optional: a manual entry has no track, and an imported GPX may carry neither.
 */
@Serializable
data class RoutePointDto(
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val ele: Double? = null,
    val t: Long? = null,
)

/**
 * A run as the sync contract returns it (docs/NATIVE_ANDROID_OPTION_PLAN.md §3).
 *
 * A tombstone arrives with `deleted = true` and nothing but its identity — the client's only job is
 * to drop it locally, so every other field defaults rather than being non-null.
 */
@Serializable
data class RunDto(
    val id: String = "",
    val clientId: String? = null,
    val revision: Int = 1,
    val deleted: Boolean = false,
    val startedAt: String = "",
    val distanceKm: Double = 0.0,
    val durationSeconds: Int = 0,
    val movingTimeSeconds: Int? = null,
    val averagePaceSecondsPerKm: Int = 0,
    val elevationGainM: Int? = null,
    val averageHeartRate: Int? = null,
    val avgCadence: Int? = null,
    val calories: Int? = null,
    val perceivedEffort: Int = 5,
    val fatigueLevel: Int = 0,
    val painLevel: Int = 0,
    val title: String? = null,
    val notes: String? = null,
    val isPublic: Boolean = false,
    val source: String = "GPS",
    val validity: String = "VALID",
    val validityReason: String? = null,
    val goalId: String? = null,
    val workoutId: String? = null,
    val createdAt: String = "",
    val updatedAt: String = "",
    /** Present only on the single-run endpoint; lists omit it because a route dwarfs the row. */
    val route: List<RoutePointDto>? = null,
    /**
     * A thinned version of the route (64 points) that list rows carry instead of the full track, so
     * a row can still show the run's recognisable shape without downloading 50 complete routes.
     */
    val routePreview: List<RoutePointDto>? = null,
)

/** The best route available on this DTO: the full track if it was fetched, otherwise the preview. */
val RunDto.displayRoute: List<RoutePointDto>?
    get() = route ?: routePreview

@Serializable
data class CreateRunRequest(
    val clientId: String,
    val startedAt: String,
    val distanceKm: Double,
    val durationSeconds: Int,
    val perceivedEffort: Int,
    val movingTimeSeconds: Int? = null,
    val elevationGainM: Int? = null,
    val route: List<RoutePointDto>? = null,
    val title: String? = null,
    val notes: String? = null,
    val isPublic: Boolean? = null,
    val source: String? = null,
)

/** Only runner-typed fields; every measurement is server-owned. */
@Serializable
data class UpdateRunRequest(
    val baseRevision: Int,
    val title: String? = null,
    val notes: String? = null,
    val isPublic: Boolean? = null,
    val perceivedEffort: Int? = null,
)
