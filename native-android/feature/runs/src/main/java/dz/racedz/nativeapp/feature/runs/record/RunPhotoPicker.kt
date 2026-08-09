package dz.racedz.nativeapp.feature.runs.record

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.network.resolveMediaUrl
import java.io.File

/** Thumbnail edge. Large enough to recognise a photo, small enough that six fit a scrolling row. */
private val THUMBNAIL = 88.dp

/**
 * Pick photos for a run: a scrolling strip of thumbnails and an "add" tile.
 *
 * Uses the system photo picker ([ActivityResultContracts.PickMultipleVisualMedia]) rather than a
 * storage permission. It hands back only the images the runner chose, needs no permission at all,
 * and on Android 13+ is the only route that does not put a "allow access to all your photos"
 * dialog between a runner and their finish-line photo.
 *
 * The chosen URIs are copied into the cache before upload. A content URI is a borrowed handle —
 * the grant does not outlive the screen, and reading it on a background coroutine after the picker
 * has gone is exactly the kind of thing that works in testing and fails on a real device.
 */
@Composable
fun RunPhotoPicker(
    photos: List<String>,
    uploading: Boolean,
    error: String?,
    enabled: Boolean,
    onPicked: (List<Pair<File, String>>) -> Unit,
    onRemove: (String) -> Unit,
    onDismissError: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    val context = LocalContext.current
    val remaining = (MAX_RUN_PHOTOS - photos.size).coerceAtLeast(0)

    val launcher = rememberLauncherForActivityResult(
        // maxItems must be at least 2, so the single-remaining-slot case uses the single-item
        // contract's behaviour by simply taking the first result below.
        ActivityResultContracts.PickMultipleVisualMedia(maxItems = MAX_RUN_PHOTOS.coerceAtLeast(2)),
    ) { uris ->
        onDismissError()
        onPicked(uris.take(remaining).mapNotNull { uri -> cacheForUpload(context, uri) })
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        Text(
            text = stringResource(R.string.runs_photos),
            style = MaterialTheme.typography.titleSmall,
            color = colors.textStrong,
        )

        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            photos.forEach { url ->
                Box(modifier = Modifier.size(THUMBNAIL)) {
                    AsyncImage(
                        model = resolveMediaUrl(url),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                            .background(colors.surfaceMuted),
                    )
                    // The remove affordance sits on the thumbnail, which is where a runner reaches
                    // for it — but it gets its own 32dp target rather than sharing the image's.
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(2.dp)
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(colors.surfaceStrong.copy(alpha = 0.72f))
                            .clickable(enabled = enabled, role = Role.Button) { onRemove(url) }
                            .semantics { contentDescription = removeLabel(context) },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = null,
                            tint = androidx.compose.ui.graphics.Color.White,
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            if (uploading) {
                Box(
                    modifier = Modifier
                        .size(THUMBNAIL)
                        .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                        .background(colors.surfaceMuted),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = colors.primary)
                }
            }

            // Hidden at the cap rather than disabled: a tile that opens a picker which can add
            // nothing is worse than no tile.
            if (remaining > 0 && !uploading) {
                Column(
                    modifier = Modifier
                        .size(THUMBNAIL)
                        .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                        .background(colors.surfaceMuted)
                        .clickable(enabled = enabled, role = Role.Button) {
                            launcher.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        }
                        .padding(ZidRunDimens.spaceXs)
                        .semantics(mergeDescendants = true) { },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        Icons.Filled.AddAPhoto,
                        contentDescription = null,
                        tint = colors.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceXs))
                    Text(
                        text = stringResource(R.string.runs_photo_add),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                        maxLines = 2,
                    )
                }
            }
        }

        error?.let { ZidRunInlineError(it) }
    }
}

/** Read outside composition, so the click handler above can label itself without a Composable. */
private fun removeLabel(context: Context): String = context.getString(R.string.runs_photo_remove)

/**
 * Copies a picked image into the cache directory and returns it with its MIME type.
 *
 * Returns null when the URI cannot be read — a photo that vanished between the picker and this
 * call, or a provider that refuses the grant. One unreadable pick is skipped; the rest still go.
 */
private fun cacheForUpload(context: Context, uri: Uri): Pair<File, String>? = runCatching {
    val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
    val extension = when (mimeType) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/gif" -> "gif"
        else -> "jpg"
    }
    val target = File.createTempFile("run-photo-", ".$extension", context.cacheDir)
    context.contentResolver.openInputStream(uri).use { input ->
        checkNotNull(input)
        target.outputStream().use { output -> input.copyTo(output) }
    }
    target to mimeType
}.getOrNull()
