package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunBrandBar
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunMenuRow
import dz.racedz.nativeapp.core.design.ZidRunStatTile
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.resolveMediaUrl
import androidx.compose.material.icons.filled.Lock

/**
 * Account hub (05-account-page.png): identity header, season stats, the next upcoming registration,
 * then the settings menu.
 *
 * Nothing sensitive is shown here — no phone number, no payment detail, no token or device id. The
 * season numbers are aggregates the server computed; the app never derives them from raw run data.
 */
@Composable
fun AccountScreen(
    viewModel: AccountViewModel,
    onOpenRegistrations: () -> Unit,
    onOpenProfile: () -> Unit,
    onOpenPrivacy: () -> Unit,
    onOpenSupport: () -> Unit,
    /** Opens the website's security page, where MFA is managed. */
    onOpenSecurity: () -> Unit,
    onSignedOut: () -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    Box(modifier = modifier.fillMaxSize().background(colors.background).padding(contentPadding)) {
        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.user == null -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
            )

            else -> {
                val user = state.user!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(ZidRunDimens.spaceLg),
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
                ) {
                    ZidRunBrandBar(
                        actionIcon = Icons.Filled.Settings,
                        actionContentDescription = stringResource(R.string.account_profile_preferences),
                        onAction = onOpenProfile,
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(88.dp)
                                .clip(CircleShape)
                                .background(colors.surfaceMuted),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (user.avatarUrl != null) {
                                AsyncImage(
                                    model = resolveMediaUrl(user.avatarUrl),
                                    contentDescription = stringResource(R.string.cd_avatar),
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            } else {
                                Icon(
                                    Icons.Filled.Person,
                                    contentDescription = null,
                                    tint = colors.textMuted,
                                    modifier = Modifier.size(36.dp),
                                )
                            }
                        }
                        Spacer(Modifier.width(ZidRunDimens.spaceLg))
                        Column {
                            Text(
                                text = user.displayName,
                                style = MaterialTheme.typography.displaySmall,
                                color = colors.textStrong,
                            )
                            val place = listOfNotNull(user.city, user.wilaya).joinToString(", ")
                            if (place.isNotBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Filled.LocationOn,
                                        contentDescription = null,
                                        tint = colors.textMuted,
                                        modifier = Modifier.size(16.dp),
                                    )
                                    Spacer(Modifier.width(ZidRunDimens.spaceXs))
                                    Text(place, style = MaterialTheme.typography.bodyMedium, color = colors.textMuted)
                                }
                            }
                        }
                    }

                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                            Text(
                                stringResource(R.string.account_your_season),
                                style = MaterialTheme.typography.titleLarge,
                                color = colors.textStrong,
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                ZidRunStatTile(
                                    icon = Icons.Filled.EmojiEvents,
                                    value = user.season.races.toString(),
                                    label = stringResource(R.string.account_stat_races),
                                    modifier = Modifier.weight(1f),
                                )
                                StatSeparator()
                                ZidRunStatTile(
                                    icon = Icons.Filled.Straighten,
                                    value = ZidRunFormat.money(user.season.totalDistanceKm.toInt(), locale),
                                    label = stringResource(R.string.account_stat_km),
                                    modifier = Modifier.weight(1f),
                                )
                                StatSeparator()
                                ZidRunStatTile(
                                    icon = Icons.Filled.EventAvailable,
                                    value = user.season.runs.toString(),
                                    label = stringResource(R.string.account_stat_runs),
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }

                    // The soonest race the runner has an active place in.
                    state.registrations
                        .firstOrNull { it.status != "CANCELLED" && it.status != "REJECTED" }
                        ?.let { registration ->
                            ZidRunCard(onClick = onOpenRegistrations) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(84.dp)
                                            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                                            .background(colors.surfaceMuted),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            Icons.Filled.EmojiEvents,
                                            contentDescription = null,
                                            tint = colors.textMuted,
                                            modifier = Modifier.size(28.dp),
                                        )
                                    }
                                    Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                                    ) {
                                        Text(
                                            registration.race.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = colors.textStrong,
                                        )
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                Icons.Filled.CalendarMonth,
                                                contentDescription = null,
                                                tint = colors.textMuted,
                                                modifier = Modifier.size(16.dp),
                                            )
                                            Spacer(Modifier.width(ZidRunDimens.spaceXs))
                                            Text(
                                                ZidRunFormat.dateCompact(registration.race.startDate, locale),
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = colors.textMuted,
                                            )
                                        }
                                        // The mockup labels this "Open ticket". There is no ticket
                                        // screen yet, so the wording says what actually happens
                                        // rather than promising a screen that does not exist.
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                                                .background(colors.primarySoft)
                                                .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                                        ) {
                                            Text(
                                                stringResource(R.string.account_view_registration),
                                                style = MaterialTheme.typography.labelLarge,
                                                color = colors.primary,
                                            )
                                        }
                                    }
                                    Icon(
                                        Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                        contentDescription = null,
                                        tint = colors.textMuted,
                                    )
                                }
                            }
                        }

                    ZidRunCard(contentPadding = PaddingValues(0.dp)) {
                        Column {
                            ZidRunMenuRow(
                                icon = Icons.Filled.EventAvailable,
                                label = stringResource(R.string.account_my_registrations),
                                onClick = onOpenRegistrations,
                            )
                            ZidRunDivider()
                            ZidRunMenuRow(
                                icon = Icons.Filled.Person,
                                label = stringResource(R.string.account_profile_preferences),
                                onClick = onOpenProfile,
                            )
                            ZidRunDivider()
                            ZidRunMenuRow(
                                icon = Icons.Filled.PrivacyTip,
                                label = stringResource(R.string.account_privacy_data),
                                onClick = onOpenPrivacy,
                            )
                            ZidRunDivider()
                            // Security lives on the website: enrolling MFA means showing a TOTP
                            // secret and recovery codes, and the hardened web flow already does that
                            // correctly. Reimplementing it natively to save a browser tab would be
                            // rebuilding the most security-sensitive screen in the product for
                            // convenience. Without this row a native-only runner had no way to turn
                            // MFA on at all.
                            ZidRunMenuRow(
                                icon = Icons.Filled.Lock,
                                label = stringResource(R.string.account_security),
                                onClick = onOpenSecurity,
                                opensExternally = true,
                            )
                            ZidRunDivider()
                            ZidRunMenuRow(
                                icon = Icons.Filled.SupportAgent,
                                label = stringResource(R.string.account_support),
                                onClick = onOpenSupport,
                                opensExternally = true,
                            )
                            ZidRunDivider()
                            ZidRunMenuRow(
                                icon = Icons.AutoMirrored.Filled.Logout,
                                label = stringResource(R.string.account_sign_out),
                                onClick = { viewModel.signOut(onSignedOut) },
                                tint = colors.textMuted,
                            )
                        }
                    }

                    /*
                     * Who you are signed in as, without putting the email on screen.
                     *
                     * The address is the account identifier and the thing a shoulder-surfer or a
                     * screenshot most usefully takes; the display name answers the question the line
                     * is actually there to answer ("am I in the right account?"). The full address
                     * stays one deliberate tap away in Profile & preferences.
                     */
                    Text(
                        text = stringResource(
                            R.string.account_signed_in_as,
                            user.displayName.ifBlank { user.firstName.ifBlank { maskEmail(user.email) } },
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(ZidRunDimens.spaceXl))
                }
            }
        }
    }
}

/** The hairline the mockup draws between the three season stats. */
@Composable
private fun StatSeparator() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(ZidRunTheme.colors.border),
    )
}



/**
 * "yo•••@gmail.com" — enough to recognise the account, not enough to read out or screenshot.
 *
 * Only used when the account has no name to show at all; a name is always the better answer.
 */
internal fun maskEmail(email: String): String {
    val at = email.indexOf('@')
    if (at <= 0) return email
    val name = email.take(at)
    val visible = name.take(2)
    return visible + "•".repeat((name.length - visible.length).coerceAtLeast(1)) + email.substring(at)
}
