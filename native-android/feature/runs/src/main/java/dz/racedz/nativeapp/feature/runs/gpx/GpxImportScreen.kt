package dz.racedz.nativeapp.feature.runs.gpx

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.distanceUnitLabel
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale
import java.time.Instant

// The file picker's type filter. "*/*" is included last because many file providers label a .gpx
// as octet-stream, and the name check in the view model is what actually gates acceptance.
private val GPX_MIME_TYPES = arrayOf("application/gpx+xml", "application/xml", "text/xml", "*/*")

/**
 * Bringing a run recorded elsewhere — a watch, another app — into ZidRun by importing its GPX
 * (NATRUN-02).
 *
 * Everything derived (distance, duration, start) is computed on-device by [GpxImportViewModel] and
 * shown as a preview before anything is sent, so the runner sees what will be saved and a malformed
 * file is refused here rather than at the server.
 */
@Composable
fun GpxImportScreen(
    viewModel: GpxImportViewModel,
    onSaved: (String) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val context = LocalContext.current
    val state by viewModel.state.collectAsStateWithLifecycle()

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.parse(context.contentResolver, uri)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding(),
    ) {
        ZidRunTopBar(title = stringResource(R.string.runs_import_title), onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                text = stringResource(R.string.runs_import_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
            )

            ZidRunOutlinedButton(
                text = stringResource(R.string.runs_import_pick),
                onClick = { picker.launch(GPX_MIME_TYPES) },
                enabled = !state.parsing && !state.saving,
            )

            state.fileName?.let { name ->
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }

            if (state.parsing) {
                Box(modifier = Modifier.fillMaxWidth().padding(ZidRunDimens.spaceLg), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = colors.primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                }
            }

            state.error?.let { ZidRunInlineError(gpxErrorMessage(it)) }

            val parsed = state.parsed
            if (parsed != null) {
                Text(
                    text = parsed.name ?: stringResource(R.string.runs_import_default_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textStrong,
                )

                ZidRunCard {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        Text(
                            text = stringResource(R.string.runs_import_preview_title),
                            style = MaterialTheme.typography.titleSmall,
                            color = colors.textStrong,
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            PreviewStat(
                                value = "${ZidRunFormat.distanceValue(parsed.distanceKm, locale)} ${distanceUnitLabel()}",
                                label = stringResource(R.string.runs_stat_distance),
                                modifier = Modifier.weight(1f),
                            )
                            Hairline()
                            PreviewStat(
                                value = ZidRunFormat.duration(parsed.durationSeconds),
                                label = stringResource(R.string.runs_stat_time),
                                modifier = Modifier.weight(1f),
                            )
                            Hairline()
                            PreviewStat(
                                value = ZidRunFormat.count(parsed.route.size, locale),
                                label = stringResource(R.string.runs_import_points_label),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                            Text(
                                text = stringResource(R.string.runs_import_start_label),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                            Text(
                                text = ZidRunFormat.dateTime(Instant.ofEpochMilli(parsed.startedAtEpochMs).toString(), locale),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textStrong,
                            )
                        }
                    }
                }

                state.saveError?.let { ZidRunInlineError(it) }

                ZidRunButton(
                    text = stringResource(R.string.runs_save),
                    onClick = { viewModel.save(onSaved) },
                    loading = state.saving,
                    enabled = !state.saving,
                )
            }

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

@Composable
private fun gpxErrorMessage(error: GpxImportError): String = stringResource(
    when (error) {
        GpxImportError.NOT_GPX -> R.string.runs_import_error_not_gpx
        GpxImportError.TOO_BIG -> R.string.runs_import_error_too_big
        GpxImportError.NO_TRACK -> R.string.runs_import_error_no_track
        GpxImportError.TOO_SHORT -> R.string.runs_import_error_too_short
        GpxImportError.NO_TIME -> R.string.runs_import_error_no_time
        GpxImportError.SHORT_TIME -> R.string.runs_import_error_short_time
        GpxImportError.LONG_TIME -> R.string.runs_import_error_long
        GpxImportError.FUTURE -> R.string.runs_import_error_future
        GpxImportError.UNREADABLE -> R.string.runs_import_error_unreadable
    },
)

@Composable
private fun PreviewStat(value: String, label: String, modifier: Modifier = Modifier) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$value $label" },
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
        Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
    }
}

@Composable
private fun Hairline() {
    Box(Modifier.width(1.dp).fillMaxHeight().background(ZidRunTheme.colors.border))
}
