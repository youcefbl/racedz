package dz.racedz.nativeapp.core.auth

import dz.racedz.nativeapp.core.network.ApiClient
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRegistrationRequest
import dz.racedz.nativeapp.core.network.CreateRunRequest
import dz.racedz.nativeapp.core.network.DeletionRequestBody
import dz.racedz.nativeapp.core.network.DeviceSessionDto
import dz.racedz.nativeapp.core.network.PreferencesRequest
import dz.racedz.nativeapp.core.network.ProfileRequest
import dz.racedz.nativeapp.core.network.RaceDetailDto
import dz.racedz.nativeapp.core.network.RaceSummaryDto
import dz.racedz.nativeapp.core.network.RegistrationDto
import dz.racedz.nativeapp.core.network.BadgesDto
import dz.racedz.nativeapp.core.network.AskCoachRequest
import dz.racedz.nativeapp.core.network.AskCoachResponseDto
import dz.racedz.nativeapp.core.network.WorkoutActionRequest
import dz.racedz.nativeapp.core.network.CoachConversationDto
import dz.racedz.nativeapp.core.network.CoachMemoryActionRequest
import dz.racedz.nativeapp.core.network.CoachMemoryDto
import dz.racedz.nativeapp.core.network.CoachOnboardingStateDto
import dz.racedz.nativeapp.core.network.LogSleepRequest
import dz.racedz.nativeapp.core.network.SleepHistoryDto
import dz.racedz.nativeapp.core.network.CoachTranscriptDto
import dz.racedz.nativeapp.core.network.CoachPlanWeekDto
import dz.racedz.nativeapp.core.network.CoachOverviewDto
import dz.racedz.nativeapp.core.network.CreateCoachGoalRequest
import dz.racedz.nativeapp.core.network.GuidedSessionDto
import dz.racedz.nativeapp.core.network.WeatherDto
import dz.racedz.nativeapp.core.network.RunDetailDto
import dz.racedz.nativeapp.core.network.RunDto
import dz.racedz.nativeapp.core.network.UpdateRunRequest
import dz.racedz.nativeapp.core.network.UserDto
import dz.racedz.nativeapp.core.network.UserPreferencesDto
import dz.racedz.nativeapp.core.network.ZidRunApi
import java.io.File
import java.util.UUID
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody

/** Race discovery and detail. Read-only; every visibility rule is applied server-side. */
class RacesRepository(private val api: ZidRunApi, private val client: ApiClient) {

    suspend fun list(
        page: Int,
        query: String? = null,
        wilaya: String? = null,
        type: String? = null,
    ): ApiResult<List<RaceSummaryDto>> = client.call {
        api.races(
            page = page,
            limit = PAGE_SIZE,
            query = query?.trim()?.takeIf { it.isNotEmpty() },
            wilaya = wilaya?.takeIf { it.isNotEmpty() },
            type = type?.takeIf { it.isNotEmpty() },
        )
    }

    suspend fun detail(idOrSlug: String): ApiResult<RaceDetailDto> = client.call { api.race(idOrSlug) }

    companion object {
        const val PAGE_SIZE = 20
    }
}

/** The signed-in runner's own profile, preferences, registrations, and devices. */
class AccountRepository(
    private val api: ZidRunApi,
    private val client: ApiClient,
    private val session: SessionManager,
) {

    suspend fun profile(): ApiResult<UserDto> = session.onResult(client.call { api.me() })

    suspend fun updateProfile(request: ProfileRequest): ApiResult<UserDto> {
        val result = session.onResult(client.call { api.updateProfile(request) })
        if (result is ApiResult.Success) session.updateProfileSnapshot(result.value)
        return result
    }

    suspend fun updatePreferences(request: PreferencesRequest): ApiResult<UserPreferencesDto> =
        session.onResult(client.call { api.updatePreferences(request) })

    suspend fun registrations(page: Int = 1): ApiResult<List<RegistrationDto>> =
        session.onResult(client.call { api.myRegistrations(page = page) })

    suspend fun devices(): ApiResult<List<DeviceSessionDto>> =
        session.onResult(client.call { api.mySessions() })

    suspend fun signOutEverywhere(): ApiResult<Unit> {
        val result = client.call { api.logoutAll() }
        // Whatever the server said, this device's tokens are now dead — drop them locally too.
        session.clearSession(SignOutReason.UserAction)
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }
    }

    suspend fun requestAccountDeletion(reason: String?): ApiResult<Unit> {
        val result = session.onResult(client.call { api.requestAccountDeletion(DeletionRequestBody(reason)) })
        return when (result) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }
    }
}

/** Race registration and its payment-proof upload. */
class RegistrationRepository(
    private val api: ZidRunApi,
    private val client: ApiClient,
    private val session: SessionManager,
) {

    /**
     * [idempotencyKey] must stay the same across retries of one logical registration attempt and
     * change for a genuinely new one — generate it when the user opens the form, not per tap, so a
     * retry after a lost response replays the first result instead of registering twice.
     */
    suspend fun register(
        raceId: String,
        idempotencyKey: String,
        request: CreateRegistrationRequest,
    ): ApiResult<RegistrationDto> =
        session.onResult(client.call { api.createRegistration(raceId, idempotencyKey, request) })

    /**
     * The runner's existing entry for [categoryId], if the server already holds one.
     *
     * Scoped to the category, not the race: registrations are unique per
     * `(userId, raceCategoryId)`, so one runner can legitimately hold several entries in the same
     * event — the 5 km and the 10 km of one race day. Matching on the race alone would hand the
     * recovery whichever entry came back first and could adopt the wrong distance.
     *
     * [raceIdOrSlug] still narrows the list first, and accepts either form because registration is
     * reachable by both depending on how the race was opened.
     *
     * Only the idempotency-recovery path calls this — a submit that succeeds, or fails for any
     * other reason, never issues this request.
     */
    suspend fun existingRegistration(raceIdOrSlug: String, categoryId: String): ApiResult<RegistrationDto?> =
        when (val result = session.onResult(client.call { api.myRegistrations(page = 1, limit = 50) })) {
            is ApiResult.Success -> ApiResult.Success(
                result.value.firstOrNull {
                    (it.race.id == raceIdOrSlug || it.race.slug == raceIdOrSlug) && it.category.id == categoryId
                },
            )
            is ApiResult.Failure -> result
        }

    suspend fun uploadPaymentProof(
        registrationId: String,
        paymentMethod: String,
        file: File,
        mimeType: String,
    ): ApiResult<RegistrationDto> {
        val part = MultipartBody.Part.createFormData(
            "file",
            // The server renames the stored file to a random UUID; this name is only what the
            // multipart part is labelled with, and must not carry anything about the device.
            "payment-proof",
            file.asRequestBody(mimeType.toMediaTypeOrNull()),
        )
        val method = paymentMethod.toRequestBody("text/plain".toMediaTypeOrNull())
        return session.onResult(client.call { api.uploadPaymentProof(registrationId, method, part) })
    }

    fun newIdempotencyKey(): String = UUID.randomUUID().toString()
}

/**
 * Recorded runs.
 *
 * Reads follow the sync contract's delta shape even though nothing is cached on disk yet: the list
 * is fetched fresh, and the tombstones the server sends are filtered out here. When the Room outbox
 * lands (phase 7's offline half) this is the seam it plugs into — the screens already speak in
 * whole runs and never see a cursor.
 */
class RunsRepository(private val api: ZidRunApi, private val client: ApiClient) {

    /**
     * Every run the caller has, not just the first page.
     *
     * The endpoint is a delta feed ordered by `updatedAt` ascending, so one un-cursored call returns
     * the caller's *oldest* [PAGE_SIZE] runs — for anyone past that many, that silently hides the
     * newest ones, including the run they just finished. So follow `nextCursor` until the server
     * stops setting `hasMore`.
     *
     * Accumulating into a map keyed by id is what makes the tombstones correct across pages: a later
     * page can carry the deletion of a run an earlier page already returned, and removing on
     * `deleted` applies that in order instead of filtering each page in isolation.
     */
    suspend fun list(): ApiResult<List<RunDto>> {
        val byId = LinkedHashMap<String, RunDto>()
        var cursor: String? = null
        var pages = 0
        while (true) {
            when (val result = client.call { api.runs(updatedSince = cursor, limit = PAGE_SIZE) }) {
                is ApiResult.Failure ->
                    // Keep whatever earlier pages already returned rather than throwing the whole
                    // history away because page N of N failed.
                    return if (byId.isEmpty()) result else ApiResult.Success(byId.values.toList())

                is ApiResult.Success -> {
                    result.value.forEach { run ->
                        if (run.deleted) byId.remove(run.id) else byId[run.id] = run
                    }
                    pages++
                    val meta = result.meta
                    cursor = meta?.nextCursor
                    // A missing cursor with hasMore would loop forever re-fetching page one.
                    if (meta?.hasMore != true || cursor == null || pages >= MAX_PAGES) {
                        return ApiResult.Success(byId.values.toList())
                    }
                }
            }
        }
    }

    suspend fun detail(id: String): ApiResult<RunDetailDto> = client.call { api.run(id) }

    /** Today's guided session: warm-up, work, cool-down, built server-side. */
    suspend fun guidedSession(): ApiResult<GuidedSessionDto> = client.call { api.guidedSession() }

    /** Steps for a runner-chosen workout type (no plan), with any tunables the runner set. The
     * server clamps each to the template's bounds, so out-of-range or unknown keys are harmless. */
    suspend fun runStructure(type: String, params: Map<String, Int>): ApiResult<GuidedSessionDto> =
        client.call {
            api.runStructure(
                type = type,
                reps = params["reps"],
                repMeters = params["repMeters"],
                workMinutes = params["workMinutes"],
                easyMinutes = params["easyMinutes"],
                durationMin = params["durationMin"],
                distanceKm = params["distanceKm"],
                recoverySeconds = params["recoverySeconds"],
            )
        }

    /** Live conditions where the runner is about to run; coordinates optional (wilaya fallback). */
    suspend fun weather(lat: Double?, lng: Double?): ApiResult<WeatherDto> =
        client.call { api.weather(lat, lng) }

    /** Achievements, computed server-side from records and race finishes. */
    suspend fun badges(): ApiResult<BadgesDto> = client.call { api.badges() }

    /**
     * Saves a recorded run. [clientId] is generated once per recording and reused on every retry —
     * that is what makes a lost response safe, so callers must NOT mint a new one to retry.
     */
    suspend fun create(request: CreateRunRequest): ApiResult<RunDto> = client.call { api.createRun(request) }

    suspend fun update(id: String, request: UpdateRunRequest): ApiResult<RunDto> =
        client.call { api.updateRun(id, request) }

    suspend fun delete(id: String): ApiResult<RunDto> = client.call { api.deleteRun(id) }

    companion object {
        const val PAGE_SIZE = 50

        /**
         * Backstop so a server that keeps setting `hasMore` cannot spin this loop forever. At
         * [PAGE_SIZE] a page this is far more history than the overview or list screens need.
         */
        const val MAX_PAGES = 40
    }
}

/**
 * The AI coach. Read-only for now: the overview the Coach tab draws.
 *
 * A NONE entitlement comes back as a normal success with empty sections rather than an error — not
 * having subscribed is a state to render, not a failure to retry.
 */
class CoachRepository(private val api: ZidRunApi, private val client: ApiClient) {
    suspend fun overview(): ApiResult<CoachOverviewDto> = client.call { api.coachOverview() }

    /** This week of the active plan, bounded server-side to one Mon-Sun window. */
    suspend fun conversation(before: String? = null): ApiResult<CoachConversationDto> =
        client.call { api.coachConversation(before) }

    /**
     * Asks the coach, and waits for the answer.
     *
     * The server generates the reply inside this request, so a 201 means "answered" and carries the
     * reply itself. The call is marked slow at the HTTP layer because the default read timeout is
     * shorter than a real generation, and giving up early would not stop the server finishing the
     * work or counting it against the runner's daily quota.
     */
    suspend fun ask(request: AskCoachRequest): ApiResult<AskCoachResponseDto> =
        client.call { api.askCoach(request) }

    /**
     * Transcribes a recorded voice note.
     *
     * The part is labelled with a fixed name: the file lives in the app's own cache and its real
     * path says something about the device, which has no business travelling with a health-adjacent
     * recording.
     */
    suspend fun transcribe(file: File, mimeType: String): ApiResult<CoachTranscriptDto> =
        client.call {
            api.coachTranscribe(
                MultipartBody.Part.createFormData(
                    "audio",
                    "coach-note",
                    file.asRequestBody(mimeType.toMediaTypeOrNull()),
                )
            )
        }

    /**
     * Skips ("I can't today"), moves, or attaches a reason to a planned workout.
     *
     * The result is deliberately ignored beyond success/failure: the caller reloads the week, so
     * what the plan says afterwards comes from the server rather than from a local guess about what
     * the change did.
     */
    suspend fun workoutAction(workoutId: String, request: WorkoutActionRequest): ApiResult<Unit> =
        when (val result = client.call { api.coachWorkoutAction(workoutId, request) }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }

    suspend fun sleepHistory(): ApiResult<SleepHistoryDto> = client.call { api.sleepHistory() }

    suspend fun logSleep(request: LogSleepRequest): ApiResult<kotlinx.serialization.json.JsonObject> =
        client.call { api.logSleep(request) }

    suspend fun planWeek(): ApiResult<CoachPlanWeekDto> = client.call { api.coachPlanWeek() }

    suspend fun onboardingState(): ApiResult<CoachOnboardingStateDto> = client.call { api.coachOnboardingState() }

    /** Creates the goal, which is what unlocks plan generation. */
    /**
     * Edits the active goal. Distinct from [createGoal] on purpose: creating a goal supersedes the
     * active plan, editing one does not, and the difference is exactly what an "Edit goal" button
     * has to promise.
     */
    suspend fun updateGoal(request: CreateCoachGoalRequest): ApiResult<kotlinx.serialization.json.JsonObject> =
        client.call { api.updateCoachGoal(request) }

    suspend fun createGoal(request: CreateCoachGoalRequest): ApiResult<kotlinx.serialization.json.JsonObject> =
        client.call { api.createCoachGoal(request) }

    /** What the coach remembers. Not entitlement-gated — a privacy surface, not a paid feature. */
    suspend fun memory(): ApiResult<CoachMemoryDto> = client.call { api.coachMemory() }

    /**
     * Confirm ("still true") or dismiss ("forget") one fact. The caller reloads the list, so what
     * remains remembered comes from the server rather than a local guess.
     */
    suspend fun memoryAction(request: CoachMemoryActionRequest): ApiResult<Unit> =
        when (val result = client.call { api.coachMemoryAction(request) }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }

    /** Deletes every remembered fact — the runner's right to erase. */
    suspend fun deleteMemory(): ApiResult<Unit> =
        when (val result = client.call { api.deleteCoachMemory() }) {
            is ApiResult.Success -> ApiResult.Success(Unit)
            is ApiResult.Failure -> result
        }
}
