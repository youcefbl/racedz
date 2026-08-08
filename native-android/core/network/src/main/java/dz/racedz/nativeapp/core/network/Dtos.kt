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
    /** Server-computed: true when the profile carries every field a race registration needs. */
    val profileComplete: Boolean = false,
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

/** A minted single-use web-handoff link (NATPAR-002): open `path` on the website immediately. */
@Serializable
data class WebHandoffDto(
    val path: String = "",
    val expiresInSeconds: Int = 300,
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

/** Where the web handoff should land after the browser is signed in (internal path only). */
@Serializable
data class WebHandoffRequest(
    val next: String,
    /**
     * The app's current language, so the confirmation page speaks it (F234-R07). Without it the
     * browser decided from its own cookie or Accept-Language, which can differ from the app.
     */
    val locale: String? = null,
)

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

/** One kilometre of a run, as computed by the server's run-stats helpers. */
@Serializable
data class RunSplitDto(
    val index: Int = 0,
    val meters: Double = 0.0,
    val seconds: Int = 0,
    val paceSecondsPerKm: Int = 0,
    val elevationGainM: Int = 0,
    val fastest: Boolean = false,
    val slowest: Boolean = false,
)

/** A point on the pace or elevation profile: a value at a distance along the run. */
@Serializable
data class SeriesPointDto(val distanceKm: Double = 0.0, val value: Double = 0.0)

/**
 * A run plus the derived metrics the detail screen shows. Splits and both series are computed
 * server-side so the phone and the website cannot disagree about the same run.
 */
@Serializable
data class RunDetailDto(
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
    val title: String? = null,
    val notes: String? = null,
    val isPublic: Boolean = false,
    val source: String = "GPS",
    val validity: String = "VALID",
    val createdAt: String = "",
    val updatedAt: String = "",
    val route: List<RoutePointDto>? = null,
    val splits: List<RunSplitDto> = emptyList(),
    val paceSeries: List<SeriesPointDto> = emptyList(),
    val elevationSeries: List<SeriesPointDto> = emptyList(),
)

// ---- coach ------------------------------------------------------------------------------------

@Serializable
data class CoachEntitlementDto(
    /** SUBSCRIBED, TRIAL, or NONE. NONE means show the subscribe prompt, not an error. */
    val tier: String = "NONE",
    val trialEndsAt: String? = null,
    val subscriptionEndsAt: String? = null,
    val plan: String? = null,
)

@Serializable
data class CoachGoalDto(
    val id: String = "",
    val goalType: String = "",
    val targetDate: String? = null,
    val targetDistanceKm: Double? = null,
    val customGoal: String? = null,
)

@Serializable
data class CoachWorkoutDto(
    val id: String = "",
    val title: String = "",
    val workoutType: String = "",
    val targetDistanceKm: Double? = null,
    val targetDurationMin: Int? = null,
    val intensity: String = "",
    val instructions: String = "",
    val scheduledFor: String = "",
)

@Serializable
data class CoachAdherenceDto(
    val plannedSessions: Int = 0,
    val completedSessions: Int = 0,
    val remainingSessions: Int = 0,
    val completionRate: Double = 0.0,
)

@Serializable
data class CoachReviewDto(val text: String? = null, val createdAt: String = "")

@Serializable
data class CoachOverviewDto(
    val entitlement: CoachEntitlementDto = CoachEntitlementDto(),
    val goal: CoachGoalDto? = null,
    val todayWorkout: CoachWorkoutDto? = null,
    val nextWorkout: CoachWorkoutDto? = null,
    val adherence: CoachAdherenceDto? = null,
    val latestReview: CoachReviewDto? = null,
)

/**
 * A coach reply, with the parts that carry caution kept separate.
 *
 * These are not decorations on the summary. [warningSignals] and [requiresProfessionalAdvice] are
 * the reply's safety content, and an earlier version of this DTO was a bare `String` holding only
 * the summary — so the app silently dropped them while the website showed them for the same reply.
 */
@Serializable
data class CoachReplyDto(
    val summary: String = "",
    val progressAssessment: String? = null,
    val positiveSignals: List<String> = emptyList(),
    val warningSignals: List<String> = emptyList(),
    val recoveryAdvice: List<String> = emptyList(),
    val requiresProfessionalAdvice: Boolean = false,
    /** What the coach did not have. Shown so uncertainty reads as missing data, not as an opinion. */
    val dataGaps: List<String> = emptyList(),
    /** The context signals the advice actually rests on — the "Based on" chips (B83-R09). */
    val usedSignals: List<String> = emptyList(),
    val followUpQuestion: String? = null,
) {
    /**
     * What a screen reads aloud (COACHPAR-001), in the order the reply is rendered.
     *
     * Warnings and the professional-advice flag are included deliberately: a runner listening with
     * the phone in a pocket must hear the caution, not just the encouraging summary. The "based on"
     * signal chips are left out — they are provenance for the eye, and reading a list of field
     * names aloud helps nobody.
     */
    fun spokenText(): String = buildList {
        add(summary)
        progressAssessment?.takeIf { it.isNotBlank() }?.let { add(it) }
        addAll(positiveSignals)
        addAll(warningSignals)
        addAll(recoveryAdvice)
        addAll(dataGaps)
        followUpQuestion?.takeIf { it.isNotBlank() }?.let { add(it) }
    }.filter { it.isNotBlank() }.joinToString(". ")
}

/** The deterministic safety verdict, evaluated server-side before and around the reply. */
@Serializable
data class CoachSafetyDto(
    val level: String = "CLEAR",
    val requiresProfessionalAdvice: Boolean = false,
) {
    /** CLEAR is the ordinary case; announcing it on every reply would drain the notice of meaning. */
    val isNotable: Boolean get() = level != "CLEAR" || requiresProfessionalAdvice
}

/**
 * One turn of the coach conversation.
 *
 * [status] is COMPLETED, BLOCKED, or FAILED. It is deliberately not PENDING: the transcript only
 * ever returns settled rows, so an in-flight question is local state on the screen, not a row here.
 */
@Serializable
data class CoachMessageDto(
    val id: String = "",
    val type: String = "CHAT",
    val status: String = "COMPLETED",
    val runId: String? = null,
    val userMessage: String? = null,
    val response: CoachReplyDto? = null,
    val safety: CoachSafetyDto? = null,
    val createdAt: String = "",
)

/** What POST /coach/interactions answers with once the reply has been generated. */
@Serializable
data class AskCoachResponseDto(
    val id: String = "",
    val status: String = "COMPLETED",
    val response: CoachReplyDto? = null,
    val safety: CoachSafetyDto? = null,
)

@Serializable
data class CoachConversationDto(
    val entitlement: CoachEntitlementDto = CoachEntitlementDto(),
    val nextCursor: String? = null,
    val messages: List<CoachMessageDto> = emptyList(),
    /**
     * The language the coach writes in — the GOAL's language, not the device's. Used to pick the
     * on-device voice when a reply is read aloud (COACHPAR-001).
     */
    val replyLanguage: String = "en",
)

/** What the runner said, as text, for them to check before it is sent (COACHPAR-001). */
@Serializable
data class CoachTranscriptDto(
    val transcript: String = "",
)

@Serializable
data class AskCoachRequest(
    val type: String = "CHAT",
    val message: String? = null,
    val runId: String? = null,
    /**
     * Client idempotency key (B83-R03). Retained across retries of the same logical ask, so a
     * timeout followed by Retry replays the stored interaction server-side instead of creating a
     * second provider call and quota charge — the main mobile failure mode on a 120s request.
     */
    val requestId: String? = null,
)

@Serializable
data class SleepEntryDto(
    val id: String = "",
    val night: String = "",
    val durationMinutes: Int = 0,
    val bedTime: String? = null,
    val wakeTime: String? = null,
    val note: String? = null,
    val source: String = "MANUAL",
)

@Serializable
data class SleepHistoryDto(val entries: List<SleepEntryDto> = emptyList())

/**
 * One fact the coach remembers about this runner, shaped for the memory/privacy screen. The raw
 * internal key and interaction ids are deliberately absent — the runner sees the fact, where it
 * came from, and how old it is (mirrors the website's memory panel).
 */
@Serializable
data class CoachMemoryItemDto(
    val id: String = "",
    /** PREFERENCE, COACHING_TONE, SCHEDULE, TERRAIN, CONSTRAINT, COMMITMENT,
     *  STRATEGY_WORKED, STRATEGY_FAILED, REJECTED_SUGGESTION, COACH_NOTE, PERFORMANCE. */
    val kind: String = "",
    val fact: String = "",
    /** RUNNER_STATED, HUMAN_COACH, SYSTEM_DERIVED, AI_INFERRED. */
    val source: String = "",
    val ageDays: Int = 0,
    /** True when the fact is close to aging out and worth a "still true?" confirmation. */
    val agingOut: Boolean = false,
)

@Serializable
data class CoachMemoryDto(val items: List<CoachMemoryItemDto> = emptyList())

@Serializable
data class LogSleepRequest(
    val durationHours: Double? = null,
    val bedTime: String? = null,
    val wakeTime: String? = null,
    val note: String? = null,
)

/** One workout in the plan week. [status] is PLANNED, COMPLETED, or SKIPPED. */
@Serializable
data class CoachPlanWorkoutDto(
    val id: String = "",
    val title: String = "",
    val workoutType: String = "",
    val status: String = "PLANNED",
    val intensity: String = "",
    val instructions: String = "",
    val targetDistanceKm: Double? = null,
    val targetDurationMin: Int? = null,
    val scheduledFor: String = "",
    /** Set on a SKIPPED session when the runner said why. */
    val skipReason: String? = null,
    val runnerNote: String? = null,
)

@Serializable
data class CoachPlanWeekDto(
    val hasPlan: Boolean = false,
    val weekStart: String? = null,
    /** When the plan begins — so a week with nothing in it can say why. */
    val planStartsOn: String? = null,
    /** Last day a workout may be moved to. The day picker is built from this, not from a guess. */
    val planEndsOn: String? = null,
    val workouts: List<CoachPlanWorkoutDto> = emptyList(),
)

/**
 * One runner action on a planned workout.
 *
 * `skip` is "I can't today" — the reason is optional, because being asked to justify a missed
 * session before you may skip it is exactly the pressure the design flow says not to apply.
 */
@Serializable
data class WorkoutActionRequest(
    val action: String,
    val reason: String? = null,
    val note: String? = null,
    val scheduledFor: String? = null,
)

/** Confirm a remembered fact is still true, or dismiss it so it is never re-learned. */
@Serializable
data class CoachMemoryActionRequest(
    val id: String,
    /** "confirm" or "dismiss". */
    val action: String,
)

/** What the coach onboarding still has to ask for, plus the answers already on file. */
@Serializable
data class CoachOnboardingStateDto(
    val needsSex: Boolean = false,
    val needsBirthDate: Boolean = false,
    val hasActiveGoal: Boolean = false,
    /** The active goal's current answers, for prefilling an edit. Null when there is no goal. */
    val goal: CoachGoalDetailDto? = null,
)

/** Every answer the goal form can change, as it currently stands on the server. */
@Serializable
data class CoachGoalDetailDto(
    val id: String = "",
    val goalType: String = "TEN_K",
    val customGoal: String? = null,
    val targetDate: String = "",
    val targetDistanceKm: Double? = null,
    val targetTimeSeconds: Int? = null,
    val experienceLevel: String = "BEGINNER",
    val currentWeeklyDistanceKm: Double = 0.0,
    val yearsRunning: Int? = null,
    val peakWeeklyDistanceKm: Double? = null,
    val longestRecentRunKm: Double? = null,
    val recentRaceResult: String? = null,
    val restingHeartRate: Int? = null,
    val weightKg: Double? = null,
    val heightCm: Int? = null,
    val availableTrainingDays: List<Int> = emptyList(),
    val preferredLongRunDay: Int? = null,
    val constraints: String? = null,
    val injuryNotes: String? = null,
    val injuryHistory: String? = null,
    val chronicConditions: List<String> = emptyList(),
    val healthNotes: String? = null,
    val preferredLocale: String = "en",
)

/**
 * The coaching goal, as the onboarding form submits it.
 *
 * Mirrors createCoachGoalSchema. Only the fields the schema requires are non-null here; the rest are
 * genuinely optional and omitted rather than sent as invented defaults — a fabricated resting heart
 * rate would feed the plan as though the runner had measured it.
 */
@Serializable
data class CreateCoachGoalRequest(
    val goalType: String,
    val targetDate: String,
    val experienceLevel: String,
    val currentWeeklyDistanceKm: Double,
    val availableTrainingDays: List<Int>,
    val customGoal: String? = null,
    val targetDistanceKm: Double? = null,
    val targetTimeSeconds: Int? = null,
    val sex: String? = null,
    val dateOfBirth: String? = null,
    // Background — every one optional, and only ever sent when the runner actually typed it. A
    // fabricated resting heart rate or weight would feed the plan as though it had been measured.
    val yearsRunning: Int? = null,
    val peakWeeklyDistanceKm: Double? = null,
    val longestRecentRunKm: Double? = null,
    val recentRaceResult: String? = null,
    val restingHeartRate: Int? = null,
    val weightKg: Double? = null,
    val heightCm: Int? = null,
    val preferredLongRunDay: Int? = null,
    val constraints: String? = null,
    // Health and safety. These are what let the coach be conservative for the right reason, and are
    // the most sensitive thing the app sends — collected behind explicit consent, never inferred.
    val injuryNotes: String? = null,
    val injuryHistory: String? = null,
    val chronicConditions: List<String>? = null,
    val healthNotes: String? = null,
    /**
     * The language the coach answers and writes plans in. The server localises the plan and the
     * reply from the *goal*, not from a request header — so leaving this at a hardcoded "en" gave an
     * Arabic-speaking runner an English training plan with no way to change it.
     */
    val preferredLocale: String = "en",
    /**
     * The explicit health-data consent tick from the review step. The server persists it as a
     * versioned, auditable grant and refuses goal create/edit without it (CONSENT_REQUIRED) — the
     * local button gate alone left native grants unrecorded (review finding T0-R01).
     */
    val consent: Boolean = false,
)

/** One step of a guided session: warm up, work, recover, steady, or cool down. */
@Serializable
data class GuidedStepDto(
    val index: Int = 0,
    val total: Int = 1,
    val role: String = "STEADY",
    val intensity: String = "EASY",
    /** Exactly one of [seconds] / [meters] is set — whichever this step counts down. */
    val seconds: Int? = null,
    val meters: Int? = null,
    val repCurrent: Int? = null,
    val repTotal: Int? = null,
)

@Serializable
data class GuidedSessionDto(
    val workoutId: String? = null,
    val title: String? = null,
    /** False when this is the generic session rather than one the runner's plan prescribed. */
    val fromPlan: Boolean = false,
    val steps: List<GuidedStepDto> = emptyList(),
)

/** One achievement, earned or still in progress. */
@Serializable
data class BadgeDto(
    val id: String = "",
    val category: String = "VOLUME",
    val current: Double = 0.0,
    val target: Double = 0.0,
    val earned: Boolean = false,
)

@Serializable
data class BadgesDto(
    val badges: List<BadgeDto> = emptyList(),
    val earnedCount: Int = 0,
    val longestStreakWeeks: Int = 0,
    val totalRuns: Int = 0,
    val totalDistanceKm: Double = 0.0,
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
    /**
     * Average step cadence (steps per minute) over the run's moving time, when the device has a
     * step counter and the runner granted activity recognition. The server uses it to tell running
     * from riding: a GPS pace that only a runner could hold, at a cadence no runner produces, marks
     * the run SUSPECT rather than letting a bus ride set a personal best (see motion-check). Absent
     * on devices without the sensor or permission, in which case the server falls back to speed.
     */
    val avgCadence: Int? = null,
    /**
     * The planned session this run was logged for, carried from "Log this run" all the way through
     * the save. Without it the server's matcher has to guess afterwards whether the run counted
     * toward the plan, and the runner's adherence quietly depends on that guess.
     */
    val workoutId: String? = null,
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
