package dz.racedz.nativeapp.feature.runs.share

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunTheme

/**
 * The share preview (NATRUN-06.9, owner decision 7): exactly what will leave the phone, an
 * "Include route" choice (default off for a private run, on for a public one), then the system
 * share sheet. The preview is rendered off the main thread from the same code as the file.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareRunSheet(
    hasRoute: Boolean,
    defaultIncludeRoute: Boolean,
    renderPreview: suspend (includeRoute: Boolean, widthPx: Int) -> Bitmap?,
    sharing: Boolean,
    error: String?,
    onShare: (includeRoute: Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    var includeRoute by rememberSaveable { mutableStateOf(defaultIncludeRoute && hasRoute) }
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var previewFailed by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    val previewWidthPx = with(density) { 320.dp.roundToPx() }

    LaunchedEffect(includeRoute) {
        previewFailed = false
        val rendered = runCatching { renderPreview(includeRoute, previewWidthPx) }.getOrNull()
        preview = rendered
        previewFailed = rendered == null
    }

    ModalBottomSheet(
        onDismissRequest = { if (!sharing) onDismiss() },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = colors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = colors.borderStrong) },
    ) {
        val previewLabel = stringResource(R.string.runs_share_preview_a11y)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = ZidRunDimens.spaceLg)
                .padding(bottom = ZidRunDimens.spaceXl),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(stringResource(R.string.runs_share_image), style = MaterialTheme.typography.titleLarge, color = colors.textStrong)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(RunShareImage.WIDTH.toFloat() / RunShareImage.HEIGHT)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerLg))
                    .semantics { contentDescription = previewLabel },
                contentAlignment = Alignment.Center,
            ) {
                val bitmap = preview
                when {
                    bitmap != null -> Image(bitmap.asImageBitmap(), contentDescription = null, modifier = Modifier.fillMaxWidth())
                    previewFailed -> Text(stringResource(R.string.runs_share_failed), color = colors.textMuted)
                    else -> ZidRunLoading(label = stringResource(R.string.common_loading))
                }
            }

            ZidRunCard {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.runs_share_include_route), style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
                        Text(
                            stringResource(if (hasRoute) R.string.runs_share_include_route_help else R.string.runs_share_no_route),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                    }
                    Spacer(Modifier.width(ZidRunDimens.spaceMd))
                    Switch(checked = includeRoute, onCheckedChange = { includeRoute = it }, enabled = hasRoute && !sharing)
                }
            }

            error?.let { ZidRunInlineError(it) }

            ZidRunButton(
                text = stringResource(R.string.runs_share_action),
                onClick = { onShare(includeRoute) },
                loading = sharing,
                enabled = !sharing && preview != null,
            )
            ZidRunOutlinedButton(text = stringResource(R.string.common_cancel), onClick = onDismiss, enabled = !sharing)
        }
    }
}
