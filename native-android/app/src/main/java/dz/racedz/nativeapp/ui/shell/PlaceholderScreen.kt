package dz.racedz.nativeapp.ui.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTheme

/**
 * Shared body for the feature tabs that are not yet implemented in this phase. Each tab keeps its
 * own route/icon so navigation, back-stack, and theming are already real; only the content is a
 * placeholder until its phase lands (Races: phase 3, Runs/Coach: phase 6, Account: phase 4).
 */
@Composable
fun PlaceholderScreen(
    icon: ImageVector,
    title: String,
    badge: String,
    body: String,
    contentPadding: PaddingValues = PaddingValues(0.dp),
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(ZidRunDimens.spaceXl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg)),
                contentAlignment = Alignment.Center,
            ) {
                // Decorative: the title text right below already gives this screen its accessible name.
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = ZidRunTheme.colors.primary,
                    modifier = Modifier.size(36.dp),
                )
            }
            Text(
                text = badge,
                style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                color = ZidRunTheme.colors.accent,
            )
            Text(
                text = title,
                style = androidx.compose.material3.MaterialTheme.typography.headlineSmall,
                color = ZidRunTheme.colors.textStrong,
                textAlign = TextAlign.Center,
            )
            Text(
                text = body,
                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
                color = ZidRunTheme.colors.textMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}
