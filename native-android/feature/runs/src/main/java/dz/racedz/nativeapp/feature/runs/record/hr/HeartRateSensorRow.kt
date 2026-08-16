package dz.racedz.nativeapp.feature.runs.record.hr

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import dz.racedz.nativeapp.feature.runs.record.RunSettings

/**
 * "Heart-rate sensor" row on the start screen (NATRUN-07.3): shows the paired sensor or "None",
 * opens the picker sheet. Same dark-surface row language as Auto-pause and Countdown.
 */
@Composable
fun HeartRateSensorRow() {
    var open by remember { mutableStateOf(false) }
    var pairedName by remember { mutableStateOf(RunSettings.hrSensorName) }
    var pairedAddress by remember { mutableStateOf(RunSettings.hrSensorAddress) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .clickable(role = Role.Button) { open = true }
            .padding(ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Filled.FavoriteBorder,
            contentDescription = null,
            tint = if (pairedAddress != null) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
        )
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Column(Modifier.weight(1f)) {
            Text(stringResource(R.string.runs_hr_sensor), style = MaterialTheme.typography.titleSmall, color = zidRunOnDarkColors().textStrong)
            Text(
                if (pairedAddress != null) stringResource(R.string.runs_hr_paired, pairedName ?: stringResource(R.string.runs_hr_unknown_device))
                else stringResource(R.string.runs_hr_none),
                style = MaterialTheme.typography.bodySmall,
                color = zidRunOnDarkColors().textMuted,
            )
        }
    }
    if (open) {
        HeartRatePickerSheet(
            pairedAddress = pairedAddress,
            onPaired = { found ->
                RunSettings.hrSensorAddress = found.address
                RunSettings.hrSensorName = found.name
                pairedAddress = found.address
                pairedName = found.name
                open = false
            },
            onForget = {
                RunSettings.hrSensorAddress = null
                RunSettings.hrSensorName = null
                pairedAddress = null
                pairedName = null
                open = false
            },
            onDismiss = { open = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HeartRatePickerSheet(
    pairedAddress: String?,
    onPaired: (HeartRateMonitor.Found) -> Unit,
    onForget: () -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val colors = ZidRunTheme.colors
    val monitor = remember { HeartRateMonitor.shared(context) }
    val state by monitor.state.collectAsStateWithLifecycle()
    val found = remember { mutableStateListOf<HeartRateMonitor.Found>() }
    var scanning by remember { mutableStateOf(false) }
    var permissionGranted by remember { mutableStateOf(monitor.hasPermissions()) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        permissionGranted = result.values.all { it }
    }
    fun startScan() {
        found.clear()
        scanning = true
        monitor.scan(onFound = { f -> if (found.none { it.address == f.address }) found.add(f) }, onDone = { scanning = false })
    }
    LaunchedEffect(permissionGranted) { if (permissionGranted && monitor.supported) startScan() }
    DisposableEffect(Unit) { onDispose { monitor.stopScan() } }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = colors.borderStrong) },
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = ZidRunDimens.spaceLg).padding(bottom = ZidRunDimens.spaceXl),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Text(stringResource(R.string.runs_hr_sensor), style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
            when {
                !monitor.supported -> Text(stringResource(R.string.runs_hr_unsupported), color = colors.textMuted)
                !permissionGranted -> {
                    Text(stringResource(R.string.runs_hr_permission), color = colors.textMuted)
                    dz.racedz.nativeapp.core.design.ZidRunButton(
                        text = stringResource(R.string.runs_hr_allow),
                        onClick = { launcher.launch(monitor.requiredPermissions().toTypedArray()) },
                    )
                }
                else -> {
                    Text(
                        when {
                            scanning -> stringResource(R.string.runs_hr_searching)
                            found.isEmpty() && state == HeartRateMonitor.State.NotFound -> stringResource(R.string.runs_hr_not_found)
                            found.isEmpty() -> stringResource(R.string.runs_hr_none)
                            else -> ""
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                    LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 240.dp)) {
                        items(found, key = { it.address }) { device ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 48.dp)
                                    .clickable(role = Role.Button) { onPaired(device) }
                                    .padding(vertical = ZidRunDimens.spaceSm),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.FavoriteBorder, contentDescription = null, tint = colors.primary)
                                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                Text(device.name ?: stringResource(R.string.runs_hr_unknown_device), style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
                                if (device.address == pairedAddress) {
                                    Spacer(Modifier.weight(1f))
                                    dz.racedz.nativeapp.core.design.ZidRunPill(text = "✓", color = colors.primary)
                                }
                            }
                        }
                    }
                    if (!scanning) {
                        dz.racedz.nativeapp.core.design.ZidRunOutlinedButton(text = stringResource(R.string.runs_hr_scan), onClick = { startScan() })
                    }
                }
            }
            if (pairedAddress != null) {
                dz.racedz.nativeapp.core.design.ZidRunOutlinedButton(text = stringResource(R.string.runs_hr_forget), onClick = onForget)
            }
        }
    }
}
