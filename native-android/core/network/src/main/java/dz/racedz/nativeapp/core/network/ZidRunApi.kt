package dz.racedz.nativeapp.core.network

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonElement
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The complete surface the native app is allowed to call. Everything returns the shared
 * [ApiEnvelope] and a raw [Response] so [ApiClient] can read the status, the typed error body, and
 * the request id uniformly — Retrofit's own exception for a non-2xx would throw all of that away.
 *
 * There is intentionally no endpoint here for anything the app does not have a screen for. Adding
 * a call is a deliberate act, not something a generated client does on your behalf.
 */
interface ZidRunApi {

    @GET("api/v1/config")
    suspend fun config(): Response<ApiEnvelope<AppConfigDto>>

    /**
     * Mints a single-use link that signs the system browser in as this account and forwards to
     * `next` (NATPAR-002) — so subscribe, security/MFA, and support open signed-in instead of at
     * a login wall. The token is 5-minute single-use; open the returned path immediately.
     */
    @POST("api/v1/auth/web-handoff")
    suspend fun webHandoff(@Body body: WebHandoffRequest): Response<ApiEnvelope<WebHandoffDto>>

    // ---- auth ---------------------------------------------------------------------------------

    @POST("api/v1/auth/login")
    suspend fun login(@Body body: LoginRequest): Response<ApiEnvelope<AuthSessionDto>>

    @POST("api/v1/auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<ApiEnvelope<RegisterAccountResultDto>>

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): Response<ApiEnvelope<RefreshResponseDto>>

    @POST("api/v1/auth/logout")
    suspend fun logout(@Body body: LogoutRequest): Response<ApiEnvelope<SignedOutDto>>

    @POST("api/v1/auth/logout-all")
    suspend fun logoutAll(): Response<ApiEnvelope<SignedOutDto>>

    @POST("api/v1/auth/resend-verification")
    suspend fun resendVerification(@Body body: ResendVerificationRequest): Response<ApiEnvelope<SentDto>>

    /** Redeems the PKCE authorization code delivered over the zidrun://auth/callback deep link. */
    @POST("api/v1/auth/token")
    suspend fun exchangePkceCode(@Body body: PkceTokenRequest): Response<ApiEnvelope<AuthSessionDto>>

    // ---- runs ---------------------------------------------------------------------------------

    /**
     * Delta sync. Without [updatedSince] this is a plain first page; with it, the response also
     * carries tombstones for runs deleted elsewhere.
     */
    @GET("api/v1/runs")
    suspend fun runs(
        @Query("updatedSince") updatedSince: String? = null,
        @Query("limit") limit: Int? = null,
    ): Response<ApiEnvelope<List<RunDto>>>

    /** The only endpoint that returns route points. */
    @GET("api/v1/runs/{id}")
    suspend fun run(@Path("id") id: String): Response<ApiEnvelope<RunDetailDto>>

    // ---- coach --------------------------------------------------------------------------------

    @GET("api/v1/coach")
    suspend fun coachOverview(): Response<ApiEnvelope<CoachOverviewDto>>

    @GET("api/v1/coach/interactions")
    suspend fun coachConversation(@Query("before") before: String? = null): Response<ApiEnvelope<CoachConversationDto>>

    /**
     * Marked slow so the auth interceptor widens this call's read timeout. The server generates the
     * coach's reply *inside* this request (~12 s locally, longer under load), and the default 30 s
     * read timeout would abort a reply the server still finishes and still charges a credit for.
     * The marker header is stripped before the request leaves the device.
     */
    @Headers("$SLOW_CALL_HEADER: 1")
    @POST("api/v1/coach/interactions")
    suspend fun askCoach(@Body body: AskCoachRequest): Response<ApiEnvelope<AskCoachResponseDto>>

    @GET("api/v1/coach/sleep")
    suspend fun sleepHistory(): Response<ApiEnvelope<SleepHistoryDto>>

    @POST("api/v1/coach/sleep")
    suspend fun logSleep(@Body body: LogSleepRequest): Response<ApiEnvelope<JsonObject>>

    /**
     * Transcribe a short voice note (COACHPAR-001). Returns TEXT for the runner to review — it does
     * not ask the coach anything, because speech recognition mishears and auto-asking would spend a
     * daily message on a sentence nobody approved.
     *
     * Marked slow at the HTTP layer for the same reason as [askCoach]: this waits on a provider.
     */
    @Multipart
    @Headers("$SLOW_CALL_HEADER: 1")
    @POST("api/v1/coach/transcribe")
    suspend fun coachTranscribe(@Part audio: MultipartBody.Part): Response<ApiEnvelope<CoachTranscriptDto>>

    @GET("api/v1/coach/plan")
    suspend fun coachPlanWeek(): Response<ApiEnvelope<CoachPlanWeekDto>>

    /** "I can't today" / "Move" — the same three actions the website's plan panel offers. */
    @PATCH("api/v1/coach/workouts/{id}")
    suspend fun coachWorkoutAction(
        @Path("id") id: String,
        @Body body: WorkoutActionRequest,
    ): Response<ApiEnvelope<JsonObject>>

    @GET("api/v1/coach/goals")
    suspend fun coachOnboardingState(): Response<ApiEnvelope<CoachOnboardingStateDto>>

    @POST("api/v1/coach/goals")
    suspend fun createCoachGoal(@Body body: CreateCoachGoalRequest): Response<ApiEnvelope<JsonObject>>

    /** Edits the active goal in place, leaving the current training plan alone. */
    @PATCH("api/v1/coach/goals")
    suspend fun updateCoachGoal(@Body body: CreateCoachGoalRequest): Response<ApiEnvelope<JsonObject>>

    /**
     * What the coach remembers about this runner. A privacy surface, deliberately available even
     * without an entitlement — an expired-trial runner must still be able to inspect their data.
     */
    @GET("api/v1/coach/memory")
    suspend fun coachMemory(): Response<ApiEnvelope<CoachMemoryDto>>

    /** Confirm ("still true") or dismiss ("forget, never re-learn") one remembered fact. */
    @PATCH("api/v1/coach/memory")
    suspend fun coachMemoryAction(@Body body: CoachMemoryActionRequest): Response<ApiEnvelope<JsonObject>>

    /** The runner's right to erase: deletes every remembered fact. */
    @DELETE("api/v1/coach/memory")
    suspend fun deleteCoachMemory(): Response<ApiEnvelope<JsonObject>>

    @GET("api/v1/runs/guided")
    suspend fun guidedSession(): Response<ApiEnvelope<GuidedSessionDto>>

    /** Steps for a workout the runner chose themselves (no plan): intervals, norwegian, strides,
     * recovery, long_run. Template params are optional and clamped server-side. */
    @GET("api/v1/runs/structure")
    suspend fun runStructure(
        @Query("type") type: String,
        @Query("reps") reps: Int? = null,
        @Query("repMeters") repMeters: Int? = null,
        @Query("workMinutes") workMinutes: Int? = null,
        @Query("easyMinutes") easyMinutes: Int? = null,
        @Query("durationMin") durationMin: Int? = null,
        @Query("distanceKm") distanceKm: Int? = null,
        @Query("recoverySeconds") recoverySeconds: Int? = null,
    ): Response<ApiEnvelope<GuidedSessionDto>>

    /** Live conditions where the runner is about to run. Coordinates optional; the server falls
     * back to the runner's wilaya when they are absent. */
    @GET("api/v1/weather")
    suspend fun weather(
        @Query("lat") lat: Double? = null,
        @Query("lng") lng: Double? = null,
    ): Response<ApiEnvelope<WeatherDto>>

    @GET("api/v1/me/badges")
    suspend fun badges(): Response<ApiEnvelope<BadgesDto>>

    @POST("api/v1/runs")
    suspend fun createRun(@Body body: CreateRunRequest): Response<ApiEnvelope<RunDto>>

    @PATCH("api/v1/runs/{id}")
    suspend fun updateRun(@Path("id") id: String, @Body body: UpdateRunRequest): Response<ApiEnvelope<RunDto>>

    @DELETE("api/v1/runs/{id}")
    suspend fun deleteRun(@Path("id") id: String): Response<ApiEnvelope<RunDto>>

    /** "Yes, this run was that planned session." */
    @POST("api/v1/runs/{id}/match")
    suspend fun confirmWorkoutMatch(
        @Path("id") id: String,
        @Body body: ConfirmMatchRequest,
    ): Response<ApiEnvelope<JsonObject>>

    /** "It was a free run" — detaches the run and reopens the workout. */
    @DELETE("api/v1/runs/{id}/match")
    suspend fun unlinkWorkoutMatch(@Path("id") id: String): Response<ApiEnvelope<JsonObject>>

    /**
     * Stores one run photo and returns its URL.
     *
     * One image per call, deliberately: a runner attaching four photos over a patchy connection
     * should lose at most the one that failed, and each upload can be retried on its own.
     */
    @Multipart
    @POST("api/v1/uploads")
    suspend fun uploadRunPhoto(@Part file: MultipartBody.Part): Response<ApiEnvelope<UploadedImageDto>>

    // ---- me -----------------------------------------------------------------------------------

    @GET("api/v1/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    /**
     * Everything the account holds, for the runner to keep.
     *
     * Typed as a raw [JsonElement] deliberately: the payload is a nested snapshot of profile,
     * registrations and runs whose shape belongs to the server, and the app's only job is to write
     * it out faithfully. Modelling it as Kotlin data classes would mean a field the server adds is
     * silently dropped from the export — the one place where losing data is the whole failure.
     */
    @GET("api/v1/me/export")
    suspend fun exportMyData(): Response<ApiEnvelope<JsonElement>>

    @PATCH("api/v1/me")
    suspend fun updateProfile(@Body body: ProfileRequest): Response<ApiEnvelope<UserDto>>

    @PATCH("api/v1/me/preferences")
    suspend fun updatePreferences(@Body body: PreferencesRequest): Response<ApiEnvelope<UserPreferencesDto>>

    @GET("api/v1/me/registrations")
    suspend fun myRegistrations(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<ApiEnvelope<List<RegistrationDto>>>

    @GET("api/v1/me/sessions")
    suspend fun mySessions(): Response<ApiEnvelope<List<DeviceSessionDto>>>

    @POST("api/v1/me/deletion-request")
    suspend fun requestAccountDeletion(@Body body: DeletionRequestBody): Response<ApiEnvelope<SubmittedDto>>

    // ---- races --------------------------------------------------------------------------------

    @GET("api/v1/races")
    suspend fun races(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("q") query: String? = null,
        @Query("wilaya") wilaya: String? = null,
        @Query("type") type: String? = null,
        @Query("distance") distance: Double? = null,
    ): Response<ApiEnvelope<List<RaceSummaryDto>>>

    @GET("api/v1/races/{idOrSlug}")
    suspend fun race(@Path("idOrSlug") idOrSlug: String): Response<ApiEnvelope<RaceDetailDto>>

    // ---- registration -------------------------------------------------------------------------

    @POST("api/v1/races/{idOrSlug}/registrations")
    suspend fun createRegistration(
        @Path("idOrSlug") idOrSlug: String,
        // Client-generated per logical registration attempt, so a retry after a dropped response
        // replays the first result instead of registering twice.
        @Header("Idempotency-Key") idempotencyKey: String,
        @Body body: CreateRegistrationRequest,
    ): Response<ApiEnvelope<RegistrationDto>>

    @Multipart
    @POST("api/v1/registrations/{id}/payment-proof")
    suspend fun uploadPaymentProof(
        @Path("id") registrationId: String,
        @Part("paymentMethod") paymentMethod: okhttp3.RequestBody,
        @Part file: MultipartBody.Part,
    ): Response<ApiEnvelope<RegistrationDto>>
}
