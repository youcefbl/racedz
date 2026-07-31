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
