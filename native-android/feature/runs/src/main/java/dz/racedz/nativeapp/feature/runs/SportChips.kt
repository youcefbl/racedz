package dz.racedz.nativeapp.feature.runs

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.RunSport
import dz.racedz.nativeapp.core.design.ZidRunChoiceChip
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunLabel

/** Run · Walk · Trail · Ride as choice chips, for the themed (non-record) screens. */
@Composable
fun SportChips(selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        ZidRunLabel(stringResource(R.string.runs_sport))
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            RunSport.entries.forEach { sport ->
                ZidRunChoiceChip(
                    label = stringResource(sport.labelRes),
                    selected = selected == sport.code,
                    onClick = { onSelect(sport.code) },
                )
            }
        }
    }
}
