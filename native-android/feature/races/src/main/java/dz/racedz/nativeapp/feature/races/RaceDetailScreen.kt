package dz.racedz.nativeapp.feature.races

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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLabel
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RaceDetailDto
import dz.racedz.nativeapp.core.network.resolveMediaUrl

/**
 * One race, with its distances, practical detail, announcements, and the single action that is
 * actually available right now.
 *
 * The call to action is derived entirely from server state (`registrationStatus`, `availablePlaces`,
 * and the caller's own `myRegistration`), never from a client-side guess — the server rejects an
 * ineligible registration regardless, and showing an enabled button that will fail is worse than
 * showing an honest disabled one.
 */
@Composable
fun RaceDetailScreen(
    viewModel: RaceDetailViewModel,
    onBack: () -> Unit,
    onRegister: (raceId: String, raceTitle: String) -> Unit,
    onViewRegistration: (registrationId: String) -> Unit,
    isSignedIn: Boolean,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors

    Box(modifier = modifier.fillMaxSize().background(colors.background)) {
        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.notFound -> ZidRunStatusView(
                icon = Icons.Filled.EmojiEvents,
                title = stringResource(R.string.race_not_found_title),
                body = stringResource(R.string.race_not_found_body),
                actionLabel = stringResource(R.string.common_back),
                onAction = onBack,
            )

            state.error != null -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message.orEmpty(),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
            )

            state.race != null -> RaceDetailContent(
                race = state.race!!,
                onBack = onBack,
                onRegister = onRegister,
                onViewRegistration = onViewRegistration,
                isSignedIn = isSignedIn,
                onSignIn = onSignIn,
            )
        }
    }
}

@Composable
private fun RaceDetailContent(
    race: RaceDetailDto,
    onBack: () -> Unit,
    onRegister: (String, String) -> Unit,
    onViewRegistration: (String) -> Unit,
    isSignedIn: Boolean,
    onSignIn: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    // A race whose photo 404s (a stale path, an import that never got an image) must not leave a
    // 220dp hole above the title — collapse the banner and let the content start at the top.
    var imageFailed by remember(race.id) { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .navigationBarsPadding(),
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            // Races imported from a social post often have no photo. Rather than reserving an empty
            // banner for them, the header collapses to just the back button and the content starts
            // right away.
            if (race.mainImageUrl != null && !imageFailed) {
                AsyncImage(
                    model = resolveMediaUrl(race.mainImageUrl),
                    contentDescription = stringResource(R.string.cd_race_image),
                    contentScale = ContentScale.Crop,
                    onState = { imageFailed = it is AsyncImagePainter.State.Error },
                    modifier = Modifier.fillMaxWidth().height(220.dp),
                )
            }

            IconButton(
                onClick = onBack,
                modifier = Modifier
                    // The image runs edge to edge under the status bar, so the button has to inset
                    // itself or it collides with the clock.
                    .statusBarsPadding()
                    .padding(ZidRunDimens.spaceSm)
                    .sizeIn(minWidth = ZidRunDimens.minTouchTarget, minHeight = ZidRunDimens.minTouchTarget)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                    .background(colors.surface.copy(alpha = 0.9f)),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.common_back),
                    tint = colors.textStrong,
                )
            }
        }

        Column(
            modifier = Modifier.padding(ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                ZidRunSectionTitle(race.title)
                DetailLine(Icons.Filled.CalendarMonth, ZidRunFormat.date(race.startDate, locale))
                DetailLine(Icons.Filled.LocationOn, listOfNotNull(race.city, race.wilaya).joinToString(", "))
                Text(
                    text = stringResource(R.string.race_organizer, race.organizerName),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }

            RegistrationCallToAction(
                race = race,
                isSignedIn = isSignedIn,
                onRegister = { onRegister(race.id, race.title) },
                onViewRegistration = onViewRegistration,
                onSignIn = onSignIn,
            )

            if (race.categories.isNotEmpty()) {
                Section(title = stringResource(R.string.race_distances)) {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                        race.categories.forEach { category ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                ZidRunPill(text = ZidRunFormat.distance(category.distanceKm, locale))
                                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                Text(
                                    text = category.name,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = colors.text,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = category.priceDzd?.takeIf { it > 0 }
                                        ?.let { stringResource(R.string.race_price_from, ZidRunFormat.money(it, locale)) }
                                        ?: stringResource(R.string.race_free),
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                            }
                            ZidRunDivider()
                        }
                    }
                }
            }

            if (race.description.isNotBlank()) {
                Section(title = stringResource(R.string.race_about)) {
                    Text(race.description, style = MaterialTheme.typography.bodyLarge, color = colors.text)
                }
            }

            race.conditions?.takeIf { it.isNotBlank() }?.let {
                Section(title = stringResource(R.string.race_conditions)) {
                    Text(it, style = MaterialTheme.typography.bodyLarge, color = colors.text)
                }
            }

            race.rules?.takeIf { it.isNotBlank() }?.let {
                Section(title = stringResource(R.string.race_rules)) {
                    Text(it, style = MaterialTheme.typography.bodyLarge, color = colors.text)
                }
            }

            race.requiredDocuments?.takeIf { it.isNotBlank() }?.let {
                Section(title = stringResource(R.string.race_required_documents)) {
                    Text(it, style = MaterialTheme.typography.bodyLarge, color = colors.text)
                }
            }

            if (race.announcements.isNotEmpty()) {
                Section(title = stringResource(R.string.race_announcements)) {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        race.announcements.forEach { announcement ->
                            ZidRunCard {
                                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Filled.Campaign,
                                            contentDescription = null,
                                            tint = colors.accent,
                                            modifier = Modifier.size(18.dp),
                                        )
                                        Spacer(Modifier.width(ZidRunDimens.spaceSm))
                                        Text(
                                            announcement.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            color = colors.textStrong,
                                        )
                                    }
                                    Text(
                                        announcement.body,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.text,
                                    )
                                    ZidRunLabel(ZidRunFormat.date(announcement.publishedAt, locale))
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

/**
 * The one action available for this race, in priority order: an existing registration wins over
 * everything, then sign-in, then the server's registration status.
 */
@Composable
private fun RegistrationCallToAction(
    race: RaceDetailDto,
    isSignedIn: Boolean,
    onRegister: () -> Unit,
    onViewRegistration: (String) -> Unit,
    onSignIn: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val existing = race.myRegistration
    val placesLeft = race.availablePlaces

    when {
        existing != null && existing.status != "CANCELLED" && existing.status != "REJECTED" -> {
            ZidRunCard {
                Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = colors.success)
                        Spacer(Modifier.width(ZidRunDimens.spaceSm))
                        Text(
                            stringResource(R.string.race_already_registered),
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.textStrong,
                        )
                    }
                    ZidRunOutlinedButton(
                        text = stringResource(R.string.race_view_registration),
                        onClick = { onViewRegistration(existing.id) },
                    )
                }
            }
        }

        !isSignedIn -> ZidRunButton(text = stringResource(R.string.race_sign_in_to_register), onClick = onSignIn)

        race.registrationStatus == "OPEN" && (placesLeft == null || placesLeft > 0) -> {
            Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                ZidRunButton(text = stringResource(R.string.race_register), onClick = onRegister)
                placesLeft?.let {
                    ZidRunLabel(
                        text = stringResource(R.string.race_places_left, it),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        else -> {
            val message = when {
                race.registrationStatus == "FULL" || placesLeft == 0 ->
                    stringResource(R.string.race_registration_full)
                race.registrationStatus == "NOT_OPEN" -> stringResource(R.string.race_registration_not_open)
                else -> stringResource(R.string.race_registration_closed)
            }
            ZidRunCard {
                Text(message, style = MaterialTheme.typography.titleMedium, color = colors.textMuted)
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        ZidRunSectionTitle(title)
        content()
    }
}

@Composable
private fun DetailLine(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    val colors = ZidRunTheme.colors
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = colors.textMuted, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Text(text, style = MaterialTheme.typography.bodyLarge, color = colors.text)
    }
}
