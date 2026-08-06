package dz.racedz.nativeapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

/**
 * Small factory helper so screens can create their view model from the [AppContainer] without a DI
 * framework. `create` is called once per ViewModelStoreOwner, so the instance survives rotation and
 * is shared by everything scoped to that owner.
 */
@Suppress("UNCHECKED_CAST")
class SimpleViewModelFactory(private val create: () -> ViewModel) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T = create() as T
}

/**
 * Factory for view models that must survive process death, handing them the owner's
 * [androidx.lifecycle.SavedStateHandle]. Registration uses it so a half-filled form is restored
 * rather than silently emptied when Android recreates the process.
 */
class SavedStateViewModelFactory(
    owner: androidx.savedstate.SavedStateRegistryOwner,
    defaultArgs: android.os.Bundle? = null,
    private val create: (androidx.lifecycle.SavedStateHandle) -> ViewModel,
) : androidx.lifecycle.AbstractSavedStateViewModelFactory(owner, defaultArgs) {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(
        key: String,
        modelClass: Class<T>,
        handle: androidx.lifecycle.SavedStateHandle,
    ): T = create(handle) as T
}
