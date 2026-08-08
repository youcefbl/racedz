package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunMenuRow
import dz.racedz.nativeapp.core.design.ZidRunTheme

/**
 * What this build is, and who made it.
 *
 * The version and release date are here so a runner reporting a problem can say which build they
 * are on without digging through Android's app-info screen, and so a support reply can check it.
 * Everything else on this screen leaves the app, so every row says so.
 */
@Composable
fun AboutScreen(
    versionName: String,
    versionCode: Int,
    releaseDate: String,
    developer: String,
    developerUrl: String,
    websiteUrl: String,
    onBack: () -> Unit,
    onOpenUrl: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors

    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(ZidRunDimens.spaceSm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.sizeIn(minWidth = ZidRunDimens.minTouchTarget, minHeight = ZidRunDimens.minTouchTarget),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.common_back),
                    tint = colors.textStrong,
                )
            }
            Text(
                stringResource(R.string.about_title),
                style = MaterialTheme.typography.titleLarge,
                color = colors.textStrong,
            )
        }

        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = ZidRunDimens.spaceLg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Spacer(Modifier.height(ZidRunDimens.spaceMd))
            // The theme already owns which wordmark reads on the current background.
            Image(
                painter = painterResource(ZidRunTheme.wordmarkRes),
                contentDescription = stringResource(R.string.about_wordmark),
                modifier = Modifier.size(width = 160.dp, height = 44.dp),
            )
            Text(
                stringResource(R.string.about_tagline),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(ZidRunDimens.spaceSm))
        }

        Column(
            modifier = Modifier.fillMaxWidth().padding(ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            ZidRunCard {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    // Version and build number are read together when someone reports a problem, so
                    // they are one line and one accessible phrase rather than two facts to stitch.
                    AboutFact(
                        label = stringResource(R.string.about_version),
                        value = stringResource(R.string.about_version_value, versionName, versionCode.toString()),
                    )
                    AboutFact(
                        label = stringResource(R.string.about_release_date),
                        value = releaseDate,
                    )
                    AboutFact(
                        label = stringResource(R.string.about_developer),
                        value = developer,
                    )
                }
            }

            ZidRunCard(contentPadding = PaddingValues(0.dp)) {
                Column {
                    ZidRunMenuRow(
                        icon = Icons.Filled.Language,
                        label = stringResource(R.string.about_website),
                        onClick = { onOpenUrl(websiteUrl) },
                        opensExternally = true,
                    )
                    ZidRunDivider()
                    ZidRunMenuRow(
                        icon = Icons.Filled.Language,
                        label = stringResource(R.string.about_developer_site, developer),
                        onClick = { onOpenUrl(developerUrl) },
                        opensExternally = true,
                    )
                    ZidRunDivider()
                    ZidRunMenuRow(
                        icon = Icons.Filled.MailOutline,
                        label = stringResource(R.string.about_contact),
                        onClick = { onOpenUrl("$websiteUrl/contact") },
                        opensExternally = true,
                    )
                    ZidRunDivider()
                    ZidRunMenuRow(
                        icon = Icons.Filled.Description,
                        label = stringResource(R.string.about_terms),
                        onClick = { onOpenUrl("$websiteUrl/terms") },
                        opensExternally = true,
                    )
                    ZidRunDivider()
                    ZidRunMenuRow(
                        icon = Icons.Filled.PrivacyTip,
                        label = stringResource(R.string.about_privacy),
                        onClick = { onOpenUrl("$websiteUrl/privacy") },
                        opensExternally = true,
                    )
                }
            }

            Text(
                stringResource(R.string.about_copyright, developer),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(ZidRunDimens.spaceLg))
        }
    }
}

/** One label/value pair, merged so a screen reader says "Version, 0.8.0 build 8" as one phrase. */
@Composable
private fun AboutFact(label: String, value: String) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = "$label, $value" },
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textMuted,
            modifier = Modifier.clearAndSetSemantics {},
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textStrong,
            modifier = Modifier.clearAndSetSemantics {},
        )
    }
}
