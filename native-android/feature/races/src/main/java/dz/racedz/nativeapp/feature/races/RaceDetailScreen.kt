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
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dz.racedz.nativeapp.core.network.RaceCategoryDto
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
import androidx.compose.ui.platform.testTag
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
import dz.racedz.nativeapp.core.design.ZidRunTestTags
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
                useLocalizedBody = state.error?.isGeneric == true,
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

    // Defaults to the shortest distance, which is the one most entrants pick. rememberSaveable so
    // the choice survives rotation and process death rather than silently resetting.
    var selectedCategoryId by rememberSaveable(race.id) {
        mutableStateOf(race.categories.minByOrNull { it.distanceKm }?.id)
    }
    val selectedCategory = race.categories.firstOrNull { it.id == selectedCategoryId }
        ?: race.categories.firstOrNull()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .testTag(ZidRunTestTags.RaceDetailScroll)
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
                Text(
                    text = race.title,
                    style = MaterialTheme.typography.displaySmall,
                    color = colors.textStrong,
                    modifier = Modifier.semantics { heading() },
                )
                RegistrationStatusPill(status = race.registrationStatus)
                DetailLine(Icons.Filled.CalendarMonth, ZidRunFormat.dateCompact(race.startDate, locale))
                DetailLine(Icons.Filled.LocationOn, listOfNotNull(race.city, race.wilaya).joinToString(", "))
                DetailLine(Icons.Filled.Groups, race.organizerName)
            }

            ZidRunDivider()

            // Distance selector. The mockup makes the distances a segmented control rather than a
            // list, so the stats below can describe the chosen one — a race with a 10K and a 21K has
            // a different elevation and start time for each.
            if (race.categories.isNotEmpty()) {
                DistanceSelector(
                    categories = race.categories,
                    selectedId = selectedCategory?.id,
                    onSelect = { selectedCategoryId = it },
                )
            }

            if (race.description.isNotBlank()) {
                Text(race.description, style = MaterialTheme.typography.bodyLarge, color = colors.text)
            }

            selectedCategory?.let { category ->
                CategoryStats(category = category, locale = locale)

                val price = category.priceDzd?.takeIf { it > 0 }
                    ?.let { stringResource(R.string.race_price_from, ZidRunFormat.money(it, locale)) }
                    ?: stringResource(R.string.race_free)
                Text(
                    text = price,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textStrong,
                )
            }

            // "What to know": the practical facts, each only shown when the organizer supplied it.
            val whatToKnow = buildList {
                selectedCategory?.cutoffTimeMin?.let {
                    add(Icons.Filled.Schedule to stringResource(R.string.race_cutoff_value, it / 60, it % 60))
                }
                race.conditions?.takeIf { it.isNotBlank() }?.let { add(Icons.Filled.WaterDrop to it) }
            }
            if (whatToKnow.isNotEmpty()) {
                Section(title = stringResource(R.string.race_what_to_know)) {
                    ZidRunCard(contentPadding = PaddingValues(0.dp)) {
                        Column {
                            whatToKnow.forEachIndexed { index, (icon, text) ->
                                if (index > 0) ZidRunDivider()
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(ZidRunDimens.spaceMd),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
                                    Spacer(Modifier.width(ZidRunDimens.spaceMd))
                                    Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.text)
                                }
                            }
                        }
                    }
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

            RegistrationCallToAction(
                race = race,
                isSignedIn = isSignedIn,
                // Carry the runner's selected category, not the race title. Both are Strings, so
                // the bad handoff compiled and silently reopened the distance chooser (G-01).
                onRegister = { onRegister(race.id, selectedCategory?.id.orEmpty()) },
                onViewRegistration = onViewRegistration,
                onSignIn = onSignIn,
            )

            Spacer(Modifier.height(ZidRunDimens.spaceXxl))
        }
    }
}

/**
 * "● Registration open" — the mockup's status pill, with a filled dot ahead of the label.
 * Colour follows the meaning: open is success, closed/full is muted, everything else is neutral.
 */
@Composable
private fun RegistrationStatusPill(status: String) {
    val colors = ZidRunTheme.colors
    val (labelRes, tint) = when (status) {
        "OPEN" -> R.string.race_status_open to colors.success
        "CLOSED" -> R.string.race_status_closed to colors.textMuted
        "FULL" -> R.string.race_status_full to colors.danger
        else -> R.string.race_status_not_open to colors.textMuted
    }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
            .background(tint.copy(alpha = 0.12f))
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = 6.dp)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(ZidRunDimens.cornerPill)).background(tint))
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Text(stringResource(labelRes), style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

/**
 * Segmented distance selector. Laid out as equal-width segments in a bordered track, matching the
 * mockup; the selected segment is tinted with the accent so it reads as a choice, not a label.
 */
@Composable
private fun DistanceSelector(
    categories: List<RaceCategoryDto>,
    selectedId: String?,
    onSelect: (String) -> Unit,
) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerMd))
            .selectableGroup(),
    ) {
        categories.forEach { category ->
            val selected = category.id == selectedId
            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = ZidRunDimens.minTouchTarget)
                    .background(if (selected) colors.accentSoft else colors.surface)
                    .selectable(
                        selected = selected,
                        role = Role.RadioButton,
                        onClick = { onSelect(category.id) },
                    )
                    .then(
                        if (selected) {
                            Modifier.border(1.5.dp, colors.accent, RoundedCornerShape(ZidRunDimens.cornerMd))
                        } else {
                            Modifier
                        }
                    )
                    .padding(vertical = ZidRunDimens.spaceMd),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = ZidRunFormat.distance(category.distanceKm, locale),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (selected) colors.accent else colors.textStrong,
                )
            }
        }
    }
}

/**
 * The distance / elevation / start strip. Only the facts the organizer actually supplied are shown —
 * an empty "— m" cell would look like missing data rather than data the race does not publish.
 */
@Composable
private fun CategoryStats(category: RaceCategoryDto, locale: java.util.Locale) {
    val colors = ZidRunTheme.colors
    val cells = buildList {
        add(Triple(Icons.Filled.Straighten, ZidRunFormat.kilometres(category.distanceKm, locale), R.string.race_stat_distance))
        category.elevationGainM?.let {
            add(Triple(Icons.Filled.Terrain, stringResource(R.string.race_stat_elevation_value, it), R.string.race_stat_elevation))
        }
        category.startTime?.takeIf { it.isNotBlank() }?.let {
            add(Triple(Icons.Filled.Schedule, it, R.string.race_stat_start))
        }
    }

    ZidRunCard {
        Row(
            modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            cells.forEachIndexed { index, (icon, value, labelRes) ->
                if (index > 0) {
                    Box(Modifier.width(1.dp).fillMaxHeight().background(colors.border))
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = ZidRunDimens.spaceSm)
                        .semantics(mergeDescendants = true) { },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                ) {
                    Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(24.dp))
                    Text(value, style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
                    Text(stringResource(labelRes), style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
                }
            }
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
                ZidRunButton(
                    text = stringResource(R.string.race_register),
                    onClick = onRegister,
                    modifier = Modifier.testTag(ZidRunTestTags.RaceRegister),
                )
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
