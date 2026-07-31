package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PrivacyTip
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
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunListRow
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.resolveMediaUrl

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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(76.dp)
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
                            ZidRunSectionTitle(user.displayName)
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
                            Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                                SeasonStat(
                                    icon = Icons.Filled.EmojiEvents,
                                    value = user.season.races.toString(),
                                    label = stringResource(R.string.account_stat_races),
                                )
                                SeasonStat(
                                    icon = Icons.Filled.Straighten,
                                    value = ZidRunFormat.money(user.season.totalDistanceKm.toInt(), locale),
                                    label = stringResource(R.string.account_stat_km),
                                )
                                SeasonStat(
                                    icon = Icons.Filled.EventAvailable,
                                    value = user.season.runs.toString(),
                                    label = stringResource(R.string.account_stat_runs),
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
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            registration.race.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = colors.textStrong,
                                        )
                                        Text(
                                            ZidRunFormat.date(registration.race.startDate, locale),
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = colors.textMuted,
                                        )
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
                            ZidRunListRow(
                                title = stringResource(R.string.account_my_registrations),
                                icon = Icons.Filled.EventAvailable,
                                onClick = onOpenRegistrations,
                                trailing = { Chevron() },
                            )
                            ZidRunDivider()
                            ZidRunListRow(
                                title = stringResource(R.string.account_profile_preferences),
                                icon = Icons.Filled.Person,
                                onClick = onOpenProfile,
                                trailing = { Chevron() },
                            )
                            ZidRunDivider()
                            ZidRunListRow(
                                title = stringResource(R.string.account_privacy_data),
                                icon = Icons.Filled.PrivacyTip,
                                onClick = onOpenPrivacy,
                                trailing = { Chevron() },
                            )
                            ZidRunDivider()
                            ZidRunListRow(
                                title = stringResource(R.string.account_support),
                                icon = Icons.Filled.SupportAgent,
                                onClick = onOpenSupport,
                                trailing = { Chevron() },
                            )
                            ZidRunDivider()
                            ZidRunListRow(
                                title = stringResource(R.string.account_sign_out),
                                icon = Icons.AutoMirrored.Filled.Logout,
                                onClick = { viewModel.signOut(onSignedOut) },
                            )
                        }
                    }

                    Text(
                        text = stringResource(R.string.account_signed_in_as, user.email),
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

@Composable
private fun SeasonStat(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String) {
    val colors = ZidRunTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(40.dp).clip(CircleShape).background(colors.primarySoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Column {
            Text(value, style = MaterialTheme.typography.headlineSmall, color = colors.textStrong)
            Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
        }
    }
}

@Composable
private fun Chevron() {
    Icon(
        Icons.AutoMirrored.Filled.KeyboardArrowRight,
        contentDescription = null,
        tint = ZidRunTheme.colors.textMuted,
    )
}
