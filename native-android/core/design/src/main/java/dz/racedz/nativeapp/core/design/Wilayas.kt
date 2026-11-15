package dz.racedz.nativeapp.core.design

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription

/**
 * The 58 Algerian wilayas, in official numeric order.
 *
 * Generated from src/lib/algeria.ts (ALGERIA_WILAYAS) so the app's filter offers exactly the values
 * the backend stores — a hand-typed variant here would silently return no races. Regenerate from
 * that file if the list ever changes; do not edit entries by hand.
 */
val AlgeriaWilayas = listOf(
    "Adrar",
    "Chlef",
    "Laghouat",
    "Oum El Bouaghi",
    "Batna",
    "Bejaia",
    "Biskra",
    "Bechar",
    "Blida",
    "Bouira",
    "Tamanrasset",
    "Tebessa",
    "Tlemcen",
    "Tiaret",
    "Tizi Ouzou",
    "Alger",
    "Djelfa",
    "Jijel",
    "Setif",
    "Saida",
    "Skikda",
    "Sidi Bel Abbes",
    "Annaba",
    "Guelma",
    "Constantine",
    "Medea",
    "Mostaganem",
    "M'Sila",
    "Mascara",
    "Ouargla",
    "Oran",
    "El Bayadh",
    "Illizi",
    "Bordj Bou Arreridj",
    "Boumerdes",
    "El Tarf",
    "Tindouf",
    "Tissemsilt",
    "El Oued",
    "Khenchela",
    "Souk Ahras",
    "Tipaza",
    "Mila",
    "Ain Defla",
    "Naama",
    "Ain Temouchent",
    "Ghardaia",
    "Relizane",
    "Timimoun",
    "Bordj Badji Mokhtar",
    "Ouled Djellal",
    "Beni Abbes",
    "In Salah",
    "In Guezzam",
    "Touggourt",
    "Djanet",
    "El M'Ghair",
    "El Meniaa",
)

/**
 * Wilaya chooser. A plain scrollable list rather than a dropdown: 58 entries do not fit a menu, and
 * a sheet gives each row a full-width 44dp target. Shared by the Races filter ([allLabel] adds the
 * "all of Algeria" row) and the profile forms, which must store one of the canonical values the
 * backend filters on rather than whatever was typed ("Alger", "alger ", "Algiers"…).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ZidRunWilayaPickerSheet(
    selected: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
    allLabel: String? = null,
) {
    val colors = ZidRunTheme.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = colors.borderStrong) },
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(bottom = ZidRunDimens.spaceXxl),
        ) {
            if (allLabel != null) {
                item(key = "all") {
                    WilayaRow(label = allLabel, selected = selected == null, onClick = { onSelect(null) })
                }
            }
            items(AlgeriaWilayas, key = { it }) { wilaya ->
                WilayaRow(label = wilaya, selected = selected == wilaya, onClick = { onSelect(wilaya) })
            }
        }
    }
}

/**
 * A form field whose value is chosen from [AlgeriaWilayas]. Looks like the other outlined fields;
 * tapping it opens [ZidRunWilayaPickerSheet]. A legacy free-text value that is not in the list is
 * still shown, so an older profile is not silently blanked — choosing replaces it.
 */
@Composable
fun ZidRunWilayaField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    required: Boolean = false,
    errorText: String? = null,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier = modifier.fillMaxWidth()) {
        ZidRunTextField(
            value = value,
            onValueChange = {},
            label = label,
            required = required,
            errorText = errorText,
            trailingIcon = Icons.Filled.ArrowDropDown,
            readOnly = true,
        )
        // An overlay rather than the field's own click: a read-only OutlinedTextField still takes
        // focus and swallows the tap.
        Box(
            Modifier
                .matchParentSize()
                .semantics {
                    // The overlay is what TalkBack focuses, so it carries the field's name; the
                    // value underneath is announced as its state.
                    contentDescription = label
                    role = Role.DropdownList
                    if (value.isNotBlank()) stateDescription = value
                }
                .clickable(onClickLabel = label) { open = true },
        )
    }
    if (open) {
        ZidRunWilayaPickerSheet(
            selected = value.takeIf { it in AlgeriaWilayas },
            onSelect = { picked ->
                if (picked != null) onValueChange(picked)
                open = false
            },
            onDismiss = { open = false },
        )
    }
}

@Composable
private fun WilayaRow(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = if (selected) colors.primary else colors.textStrong,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            // Decorative: `selectable` already reports the selected state to TalkBack.
            Icon(Icons.Filled.Check, contentDescription = null, tint = colors.primary)
        }
    }
}
