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
