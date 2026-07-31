package dz.racedz.nativeapp.core.auth

import dz.racedz.nativeapp.core.network.ApiClient
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRegistrationRequest
import dz.racedz.nativeapp.core.network.DeletionRequestBody
import dz.racedz.nativeapp.core.network.DeviceSessionDto
import dz.racedz.nativeapp.core.network.PreferencesRequest
import dz.racedz.nativeapp.core.network.ProfileRequest
import dz.racedz.nativeapp.core.network.RaceDetailDto
import dz.racedz.nativeapp.core.network.RaceSummaryDto
import dz.racedz.nativeapp.core.network.RegistrationDto
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
