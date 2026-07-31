package dz.racedz.nativeapp.feature.registration

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dz.racedz.nativeapp.core.auth.AccountRepository
import dz.racedz.nativeapp.core.auth.RacesRepository
import dz.racedz.nativeapp.core.auth.RegistrationRepository
import dz.racedz.nativeapp.core.network.ApiCallException
import dz.racedz.nativeapp.core.network.ApiErrorCode
import dz.racedz.nativeapp.core.network.ApiResult
import dz.racedz.nativeapp.core.network.CreateRegistrationRequest
import dz.racedz.nativeapp.core.network.RaceCategoryDto
import dz.racedz.nativeapp.core.network.RaceDetailDto
import dz.racedz.nativeapp.core.network.RegistrationDto
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class RegistrationStep { Distance, Details, Payment, Done }

data class RegistrationUiState(
    val race: RaceDetailDto? = null,
    val step: RegistrationStep = RegistrationStep.Distance,
    val selectedCategoryId: String? = null,
    val firstName: String = "",
    val lastName: String = "",
    val phone: String = "",
    val dateOfBirth: String = "",
    val gender: String = "MALE",
    val wilaya: String = "",
    val city: String = "",
    val emergencyName: String = "",
    val emergencyPhone: String = "",
    /**
     * Set when the server refused because the profile is incomplete. The screen sends the runner to
     * onboarding rather than showing errors on fields they have no way to fill from here.
     */
    val needsOnboarding: Boolean = false,
    val clubName: String = "",
    val acceptedTerms: Boolean = false,
    val loading: Boolean = true,
    val submitting: Boolean = false,
    val uploading: Boolean = false,
    val registration: RegistrationDto? = null,
    val paymentMethod: String = "BARIDIMOB",
    val error: ApiCallException? = null,
    val proofUploaded: Boolean = false,
) {
    val selectedCategory: RaceCategoryDto?
        get() = race?.categories?.firstOrNull { it.id == selectedCategoryId }

    val canSubmitDetails: Boolean
        get() = selectedCategoryId != null &&
            firstName.isNotBlank() && lastName.isNotBlank() &&
            phone.length >= 6 && DATE_PATTERN.matches(dateOfBirth) &&
            wilaya.isNotBlank() && city.isNotBlank() &&
            emergencyName.isNotBlank() && emergencyPhone.length >= 6 &&
            acceptedTerms && !submitting

    val isOffline: Boolean get() = error?.code == ApiErrorCode.Offline

    private companion object {
        val DATE_PATTERN = Regex("""\d{4}-\d{2}-\d{2}""")
    }
}

/**
 * Drives race registration and the payment-proof upload.
 *
 * The idempotency key is generated once, when the flow opens, and reused for every submit attempt
 * of that same registration. That is what makes "tap Confirm, lose the network, tap Confirm again"
 * safe: the server replays the first result instead of creating a second registration. Generating
 * it per tap would defeat the entire mechanism.
 */
class RegistrationViewModel(
    private val racesRepository: RacesRepository,
    private val registrationRepository: RegistrationRepository,
    private val accountRepository: AccountRepository,
    private val raceIdOrSlug: String,
) : ViewModel() {

    private val idempotencyKey: String = registrationRepository.newIdempotencyKey()

    private val _state = MutableStateFlow(RegistrationUiState())
    val state: StateFlow<RegistrationUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }

            when (val race = racesRepository.detail(raceIdOrSlug)) {
                is ApiResult.Success -> _state.update { current ->
                    current.copy(
                        race = race.value,
                        loading = false,
                        // Preselect when the race has exactly one distance — a one-option choice
                        // screen is a step with no decision in it.
                        selectedCategoryId = race.value.categories.singleOrNull()?.id,
                    )
                }
                is ApiResult.Failure -> _state.update { it.copy(loading = false, error = race.error) }
            }

            // Prefill from the runner's saved profile so they are not retyping what we already hold.
            when (val me = accountRepository.profile()) {
                is ApiResult.Success -> _state.update { current ->
                    current.copy(
                        firstName = current.firstName.ifBlank { me.value.firstName },
                        lastName = current.lastName.ifBlank { me.value.lastName },
                        phone = current.phone.ifBlank { me.value.phone.orEmpty() },
                        dateOfBirth = current.dateOfBirth.ifBlank { me.value.dateOfBirth.orEmpty() },
                        gender = me.value.gender ?: current.gender,
                        wilaya = current.wilaya.ifBlank { me.value.wilaya.orEmpty() },
                        city = current.city.ifBlank { me.value.city.orEmpty() },
                    )
                }
                is ApiResult.Failure -> Unit
            }
        }
    }

    fun selectCategory(id: String) = _state.update { it.copy(selectedCategoryId = id) }
    fun onFirstName(value: String) = _state.update { it.copy(firstName = value) }
    fun onLastName(value: String) = _state.update { it.copy(lastName = value) }
    fun onPhone(value: String) = _state.update { it.copy(phone = value) }
    fun onDateOfBirth(value: String) = _state.update { it.copy(dateOfBirth = value) }
    fun onGender(value: String) = _state.update { it.copy(gender = value) }
    fun onWilaya(value: String) = _state.update { it.copy(wilaya = value) }
    fun onCity(value: String) = _state.update { it.copy(city = value) }
    fun onEmergencyName(value: String) = _state.update { it.copy(emergencyName = value) }
    fun onEmergencyPhone(value: String) = _state.update { it.copy(emergencyPhone = value) }
    fun onClubName(value: String) = _state.update { it.copy(clubName = value) }
    fun onAcceptTerms(value: Boolean) = _state.update { it.copy(acceptedTerms = value) }
    fun onPaymentMethod(value: String) = _state.update { it.copy(paymentMethod = value) }

    fun goToStep(step: RegistrationStep) = _state.update { it.copy(step = step, error = null) }

    fun submit() {
        val snapshot = _state.value
        val categoryId = snapshot.selectedCategoryId ?: return
        val raceId = snapshot.race?.id ?: return
        if (!snapshot.canSubmitDetails) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            val result = registrationRepository.register(
                raceId = raceId,
                idempotencyKey = idempotencyKey,
                request = CreateRegistrationRequest(
                    firstName = snapshot.firstName.trim(),
                    lastName = snapshot.lastName.trim(),
                    phone = snapshot.phone.trim(),
                    dateOfBirth = snapshot.dateOfBirth.trim(),
                    gender = snapshot.gender,
                    wilaya = snapshot.wilaya.trim(),
                    city = snapshot.city.trim(),
                    emergencyContactName = snapshot.emergencyName.trim(),
                    emergencyContactPhone = snapshot.emergencyPhone.trim(),
                    clubName = snapshot.clubName.trim().takeIf { it.isNotEmpty() },
                    raceCategoryId = categoryId,
                    acceptedTerms = true,
                ),
            )

            _state.update { current ->
                when (result) {
                    is ApiResult.Success -> current.copy(
                        submitting = false,
                        registration = result.value,
                        // Skip the payment step entirely when the server says nothing is owed.
                        step = if (result.value.paymentStatus == "NOT_REQUIRED" || result.value.paymentStatus == "PAID") {
                            RegistrationStep.Done
                        } else {
                            RegistrationStep.Payment
                        },
                    )
                    is ApiResult.Failure -> current.copy(
                        submitting = false,
                        error = result.error,
                        // Not a field problem: the profile is missing data this form prefills from,
                        // so the runner is sent to onboarding rather than left staring at the form.
                        needsOnboarding = result.error.code == ApiErrorCode.ProfileIncomplete,
                    )
                }
            }
        }
    }

    /**
     * Uploads a payment screenshot the user picked from the system photo picker.
     *
     * The bytes are copied into the app's own cache before upload because a SAF `content://` URI is
     * a short-lived grant that can be revoked mid-request. The copy is deleted immediately
     * afterwards, so a financial document does not linger in cache where a later backup or another
     * app's file browsing could reach it.
     */
    fun uploadProof(context: Context, uri: Uri) {
        val registrationId = _state.value.registration?.id ?: return
        val method = _state.value.paymentMethod

        viewModelScope.launch {
            _state.update { it.copy(uploading = true, error = null) }

            val copied = withContext(Dispatchers.IO) { copyToCache(context, uri) }
            if (copied == null) {
                _state.update {
                    it.copy(
                        uploading = false,
                        error = ApiCallException(ApiErrorCode.BadRequest, "That image could not be read. Try another one."),
                    )
                }
                return@launch
            }

            val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
            val result = registrationRepository.uploadPaymentProof(registrationId, method, copied, mime)
            withContext(Dispatchers.IO) { copied.delete() }

            _state.update { current ->
                when (result) {
                    is ApiResult.Success -> current.copy(
                        uploading = false,
                        registration = result.value,
                        proofUploaded = true,
                        step = RegistrationStep.Done,
                    )
                    is ApiResult.Failure -> current.copy(uploading = false, error = result.error)
                }
            }
        }
    }

    private fun copyToCache(context: Context, uri: Uri): File? = runCatching {
        val target = File(context.cacheDir, "payment-proof-upload.tmp")
        context.contentResolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        } ?: return null
        target
    }.getOrNull()

    fun dismissError() = _state.update { it.copy(error = null) }
}
