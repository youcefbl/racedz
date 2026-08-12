package dz.racedz.nativeapp.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/**
 * Persistent urgent guidance shared by Coach, Plan, and Runs.
 *
 * It deliberately does not disable navigation or recording controls. The runner can still reach
 * their data and the Coach, while the strong copy makes clear that recording availability is not
 * medical clearance to exercise.
 */
@Composable
fun ZidRunExerciseHoldNotice(
    clearing: Boolean,
    onConfirmMedicalClearance: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    var confirmOpen by remember { mutableStateOf(false) }
    val urgentLabel = stringResource(R.string.coach_notice_urgent_a11y)
    val body = stringResource(R.string.coach_exercise_hold_body)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {
                contentDescription = "$urgentLabel. $body"
                liveRegion = LiveRegionMode.Assertive
            }
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.dangerSoft)
            .border(1.dp, colors.danger, RoundedCornerShape(ZidRunDimens.cornerLg))
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            Icon(Icons.Filled.Error, contentDescription = null, tint = colors.dangerContent, modifier = Modifier.size(22.dp))
            Text(
                stringResource(R.string.coach_exercise_hold_title),
                style = MaterialTheme.typography.titleSmall,
                color = colors.dangerContent,
            )
        }
        Text(body, style = MaterialTheme.typography.bodyMedium, color = colors.dangerContent)
        ZidRunTextButton(
            text = stringResource(R.string.coach_exercise_hold_action),
            onClick = { confirmOpen = true },
            fillWidth = false,
        )
    }

    if (confirmOpen) {
        AlertDialog(
            onDismissRequest = { if (!clearing) confirmOpen = false },
            containerColor = colors.surface,
            title = { Text(stringResource(R.string.coach_exercise_hold_confirm_title), color = colors.textStrong) },
            text = { Text(stringResource(R.string.coach_exercise_hold_confirm_body), color = colors.text) },
            confirmButton = {
                ZidRunButton(
                    text = stringResource(R.string.coach_exercise_hold_confirm_action),
                    onClick = {
                        confirmOpen = false
                        onConfirmMedicalClearance()
                    },
                    loading = clearing,
                )
            },
            dismissButton = {
                ZidRunTextButton(
                    text = stringResource(R.string.common_cancel),
                    onClick = { confirmOpen = false },
                    fillWidth = false,
                )
            },
        )
    }
}
