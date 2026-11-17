package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors

/**
 * Warns before a run when notifications cannot reach the runner.
 *
 * If the phone closes the app mid-run, the only way the runner learns of it in time to continue the
 * run is the interruption notification ([RunInterruptionNotice]). With notifications off that
 * signal is gone and the run silently stops where the app died (review P1, 2026-11-17), so the
 * Start screen says so and offers the fix. Never a block: the run can still be started.
 *
 * Re-checked on every return to the screen (the runner may have gone to Settings). Allow asks the
 * system once on Android 13+ and, after a refusal or on older versions, opens the app's
 * notification settings.
 */
@Composable
internal fun NotificationsOffNotice(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var enabled by remember { mutableStateOf(RunInterruptionNotice.canNotify(context)) }
    var asked by rememberSaveable { mutableStateOf(false) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) enabled = RunInterruptionNotice.canNotify(context)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val openSettings = {
        runCatching {
            context.startActivity(
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
        Unit
    }
    var askedAtMs by remember { mutableStateOf(0L) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        asked = true
        enabled = RunInterruptionNotice.canNotify(context)
        // A refusal this fast means Android showed no dialog (the runner refused before, or the
        // permission is fixed): the tap would otherwise seem to do nothing — go to Settings.
        if (!granted && android.os.SystemClock.elapsedRealtime() - askedAtMs < INSTANT_DENIAL_MS) openSettings()
    }
    if (enabled) return

    val colors = zidRunOnDarkColors()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Text(stringResource(R.string.runs_notifications_off_title), style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
        Text(stringResource(R.string.runs_notifications_off_body), style = MaterialTheme.typography.bodySmall, color = colors.text)
        ZidRunButton(
            text = stringResource(R.string.runs_notifications_off_action),
            onClick = {
                val canAsk = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !asked &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                if (canAsk) {
                    askedAtMs = android.os.SystemClock.elapsedRealtime()
                    launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    openSettings()
                }
            },
            containerColor = colors.primary,
            contentColor = colors.onPrimary,
        )
    }
}

/** Faster than any person answers a permission dialog: no dialog was shown. */
private const val INSTANT_DENIAL_MS = 400L
