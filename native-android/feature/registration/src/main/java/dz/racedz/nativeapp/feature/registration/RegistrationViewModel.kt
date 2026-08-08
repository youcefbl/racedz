package dz.racedz.nativeapp.feature.registration

import android.content.Context
import android.net.Uri
import android.os.Bundle
import androidx.lifecycle.SavedStateHandle
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

enum class RegistrationStep { Distance, Details, Review, Payment, Done }

/** Why the details step cannot be submitted yet. Mapped to localized copy by the screen. */
enum class RegistrationRequirement { Category, Name, Phone, DateOfBirth, Location, Emergency, Terms }

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
    /**
     * Set when Confirm turned out to be a retry of a submit that had already committed, and the
     * entry shown here is the one the server kept rather than the edited form. The screen has to
     * say so: the runner changed something and we did not apply it.
     */
    val reconciledExistingEntry: Boolean = false,
) {
    val selectedCategory: RaceCategoryDto?
        get() = race?.categories?.firstOrNull { it.id == selectedCategoryId }

    /**
     * The first unmet condition, so a disabled Confirm can say WHY instead of just sitting there.
     * A runner who filled every visible field could still face a dead button because the emergency
     * contact was required only here, with nothing on screen saying so (DEV-R03).
     */
    /** True when the typed date is a real calendar date, not merely the right shape. */
    val dateOfBirthValid: Boolean
        get() = DATE_PATTERN.matches(dateOfBirth) &&
            runCatching { java.time.LocalDate.parse(dateOfBirth) }.isSuccess

    val unmetRequirement: RegistrationRequirement?
        get() = when {
            selectedCategoryId == null -> RegistrationRequirement.Category
            firstName.isBlank() || lastName.isBlank() -> RegistrationRequirement.Name
            phone.length < 6 -> RegistrationRequirement.Phone
            !dateOfBirthValid -> RegistrationRequirement.DateOfBirth
            wilaya.isBlank() || city.isBlank() -> RegistrationRequirement.Location
            emergencyName.isBlank() || emergencyPhone.length < 6 -> RegistrationRequirement.Emergency
            !acceptedTerms -> RegistrationRequirement.Terms
            else -> null
        }

    val canSubmitDetails: Boolean
        get() = selectedCategoryId != null &&
            firstName.isNotBlank() && lastName.isNotBlank() &&
            phone.length >= 6 && dateOfBirthValid &&
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
    /** The distance already chosen on Race Detail, when registration was opened from there. */
    private val preselectedCategoryId: String? = null,
    /** Survives process recreation so a half-filled form is not silently lost. */
    private val savedState: SavedStateHandle? = null,
) : ViewModel() {

    /**
     * Stable for the life of this registration attempt, **including across process death**.
     *
     * Regenerating it on view-model recreation defeated the entire mechanism: a runner whose app
     * was killed during an uncertain submit would retry under a new key, so the server would treat
     * it as a different registration instead of replaying the first result.
     */
    private val idempotencyKey: String =
        savedState?.get<String>(KEY_IDEMPOTENCY)
            ?: registrationRepository.newIdempotencyKey().also { savedState?.set(KEY_IDEMPOTENCY, it) }

    private val _state = MutableStateFlow(
        // Restored after process recreation: a runner who backgrounded the app mid-form used to
        // return to an empty one, having typed a birth date, an address and an emergency contact.
        savedState?.get<Bundle>(SAVED_FORM)?.let { bundle ->
            RegistrationUiState(
                // Post-submit steps are deliberately NOT restored. `registration` lives only in
                // memory, so a restored Payment step rendered a blank screen; the runner is put
                // back on Review instead, where the retained idempotency key makes Confirm replay
                // the original request rather than create a second entry. Done is terminal and
                // safe to keep.
                step = runCatching { RegistrationStep.valueOf(bundle.getString(KEY_STEP).orEmpty()) }
                    .getOrDefault(RegistrationStep.Distance)
                    .let { if (it == RegistrationStep.Payment) RegistrationStep.Review else it },
                selectedCategoryId = bundle.getString(KEY_CATEGORY),
                firstName = bundle.getString(KEY_FIRST).orEmpty(),
                lastName = bundle.getString(KEY_LAST).orEmpty(),
                phone = bundle.getString(KEY_PHONE).orEmpty(),
                dateOfBirth = bundle.getString(KEY_DOB).orEmpty(),
                gender = bundle.getString(KEY_GENDER).orEmpty(),
                wilaya = bundle.getString(KEY_WILAYA).orEmpty(),
                city = bundle.getString(KEY_CITY).orEmpty(),
                emergencyName = bundle.getString(KEY_EMERGENCY_NAME).orEmpty(),
                emergencyPhone = bundle.getString(KEY_EMERGENCY_PHONE).orEmpty(),
                clubName = bundle.getString(KEY_CLUB).orEmpty(),
                acceptedTerms = bundle.getBoolean(KEY_TERMS),
            )
        } ?: RegistrationUiState()
    )
    val state: StateFlow<RegistrationUiState> = _state.asStateFlow()

    init {
        // Saved on every state change rather than only at onCleared: process death gives no
        // reliable later chance to write.
        savedState?.setSavedStateProvider(SAVED_FORM) {
            val snapshot = _state.value
            Bundle().apply {
                putString(KEY_STEP, snapshot.step.name)
                putString(KEY_CATEGORY, snapshot.selectedCategoryId)
                putString(KEY_FIRST, snapshot.firstName)
                putString(KEY_LAST, snapshot.lastName)
                putString(KEY_PHONE, snapshot.phone)
                putString(KEY_DOB, snapshot.dateOfBirth)
                putString(KEY_GENDER, snapshot.gender)
                putString(KEY_WILAYA, snapshot.wilaya)
                putString(KEY_CITY, snapshot.city)
                putString(KEY_EMERGENCY_NAME, snapshot.emergencyName)
                putString(KEY_EMERGENCY_PHONE, snapshot.emergencyPhone)
                putString(KEY_CLUB, snapshot.clubName)
                putBoolean(KEY_TERMS, snapshot.acceptedTerms)
            }
        }
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }

            when (val race = racesRepository.detail(raceIdOrSlug)) {
                is ApiResult.Success -> _state.update { current ->
                    // The runner's own choice wins; a single-distance race preselects itself,
                    // because a one-option choice screen is a step with no decision in it. Only an
                    // id the race actually offers is honoured, so a stale link cannot select a
                    // category from another race.
                    fun offered(id: String?) = id?.takeIf { candidate ->
                        race.value.categories.any { it.id == candidate }
                    }
                    // Precedence matters. A selection already in state — restored after process
                    // death, or made by the runner before the race finished loading — outranks the
                    // navigation argument, which outranks a single-distance race preselecting
                    // itself. Resolving the argument first silently erased a restored choice, so a
                    // multi-distance registration could come back on Review with no category and a
                    // Confirm that could never enable.
                    val resolved = offered(current.selectedCategoryId)
                        ?: offered(preselectedCategoryId)
                        ?: race.value.categories.singleOrNull()?.id
                    current.copy(
                        race = race.value,
                        loading = false,
                        selectedCategoryId = resolved,
                        // Arriving with the distance already chosen means that step is answered —
                        // reopening it unselected made the runner repeat themselves (DEV-R02).
                        // If nothing valid survived, the only honest place to be is the chooser,
                        // never a later step that cannot be completed.
                        step = when {
                            resolved == null && current.step != RegistrationStep.Done ->
                                RegistrationStep.Distance
                            resolved != null && current.step == RegistrationStep.Distance ->
                                RegistrationStep.Details
                            else -> current.step
                        },
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
    /**
     * Accepts digits and inserts the hyphens itself.
     *
     * The field asks for a numeric keyboard, and Android's numeric keyboards commonly have no "-",
     * so a runner without a prefilled birth date could type 8 correct digits and still face a
     * disabled Confirm because the validator wanted literal YYYY-MM-DD. Formatting as they type
     * makes the requirement satisfiable with the keyboard actually shown.
     */
    fun onDateOfBirth(value: String) = _state.update {
        // Char.isDigit() accepts every Unicode decimal digit, so an Arabic keyboard's ١٩٩٦٠٥٢١
        // formatted happily and then failed ISO parsing — the same dead-end this fix exists to
        // remove, just one locale further along. Character.digit() maps any of them to 0-9.
        val digits = value
            .filter(Char::isDigit)
            .map { Character.digit(it, 10) }
            .filter { it >= 0 }
            .joinToString("")
            .take(8)
        val formatted = buildString {
            append(digits.take(4))
            if (digits.length > 4) {
                append('-').append(digits.drop(4).take(2))
                if (digits.length > 6) append('-').append(digits.drop(6))
            }
        }
        it.copy(dateOfBirth = formatted)
    }
    fun onGender(value: String) = _state.update { it.copy(gender = value) }
    fun onWilaya(value: String) = _state.update { it.copy(wilaya = value) }
    fun onCity(value: String) = _state.update { it.copy(city = value) }
    fun onEmergencyName(value: String) = _state.update { it.copy(emergencyName = value) }
    fun onEmergencyPhone(value: String) = _state.update { it.copy(emergencyPhone = value) }
    fun onClubName(value: String) = _state.update { it.copy(clubName = value) }
    fun onAcceptTerms(value: Boolean) = _state.update { it.copy(acceptedTerms = value) }
    fun onPaymentMethod(value: String) = _state.update { it.copy(paymentMethod = value) }

    fun goToStep(step: RegistrationStep) = _state.update { it.copy(step = step, error = null) }

    /**
     * Steps back one screen, or reports that there is nowhere left to go.
     *
     * Back used to pop the whole registration route from any step, so returning from Review threw
     * away a completed form. Payment and Done are deliberately terminal: the entry exists by then,
     * and walking back into the form would invite a second one.
     */
    fun backStep(): Boolean {
        val current = _state.value.step
        val previous = when (current) {
            RegistrationStep.Review -> RegistrationStep.Details
            RegistrationStep.Details -> RegistrationStep.Distance.takeIf { preselectedCategoryId == null }
            else -> null
        } ?: return false
        _state.update { it.copy(step = previous, error = null) }
        return true
    }

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

            when (result) {
                is ApiResult.Success -> _state.update { it.arriveAt(result.value) }

                is ApiResult.Failure -> {
                    // Reconcile before reporting, but only for the one error that means "you have
                    // already registered under this key". The key is held for the whole attempt so
                    // a retry after a lost response replays the first result — but Review lets the
                    // runner edit, and a retry with a changed body is a *different* request under
                    // the same key, which the server correctly refuses. Retrying cannot heal that:
                    // the key lives in saved state, so every further Confirm hits the same 409 and
                    // the runner's only way out was to abandon the flow.
                    //
                    // Rotating the key here would risk a second real entry, because the refusal
                    // means the first request was recorded. So ask the server what it actually
                    // holds and show the runner that, rather than an error they cannot clear.
                    //
                    // This costs one request, on this error only. A successful submit — or any
                    // other failure — issues exactly what it did before.
                    val existing = if (result.error.code == ApiErrorCode.IdempotencyKeyReused) {
                        (registrationRepository.existingRegistration(raceId) as? ApiResult.Success)?.value
                    } else {
                        null
                    }

                    _state.update { current ->
                        if (existing != null) {
                            current.arriveAt(existing).copy(reconciledExistingEntry = true)
                        } else {
                            current.copy(
                                submitting = false,
                                error = result.error,
                                // Not a field problem: the profile is missing data this form
                                // prefills from, so the runner is sent to onboarding rather than
                                // left staring at the form.
                                needsOnboarding = result.error.code == ApiErrorCode.ProfileIncomplete,
                            )
                        }
                    }
                }
            }
        }
    }

    /** Land on the entry the server holds, skipping Payment when nothing is owed. */
    private fun RegistrationUiState.arriveAt(entry: RegistrationDto) = copy(
        submitting = false,
        error = null,
        registration = entry,
        step = if (entry.paymentStatus == "NOT_REQUIRED" || entry.paymentStatus == "PAID") {
            RegistrationStep.Done
        } else {
            RegistrationStep.Payment
        },
    )

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

    private companion object {
        const val SAVED_FORM = "registration-form"
        const val KEY_STEP = "step"
        const val KEY_CATEGORY = "categoryId"
        const val KEY_FIRST = "firstName"
        const val KEY_LAST = "lastName"
        const val KEY_PHONE = "phone"
        const val KEY_DOB = "dateOfBirth"
        const val KEY_GENDER = "gender"
        const val KEY_WILAYA = "wilaya"
        const val KEY_CITY = "city"
        const val KEY_EMERGENCY_NAME = "emergencyName"
        const val KEY_EMERGENCY_PHONE = "emergencyPhone"
        const val KEY_CLUB = "clubName"
        const val KEY_TERMS = "acceptedTerms"
        const val KEY_IDEMPOTENCY = "idempotencyKey"
    }
}
