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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.ui.semantics.Role
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunBrandBar
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunFilterChip
import dz.racedz.nativeapp.core.design.ZidRunSectionHeader
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunSearchField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RaceSummaryDto
import dz.racedz.nativeapp.core.network.resolveMediaUrl

/** Foreground pair for the near-black `surfaceStrong` the featured hero card uses in every theme. */
private val FeaturedTextColor = androidx.compose.ui.graphics.Color(0xFFF8FAFC)
private val FeaturedMutedColor = androidx.compose.ui.graphics.Color(0xFFCBD5E1)

/**
 * Scrim over the hero photo.
 *
 * Weighted to the bottom, where the title and metadata sit, but it can never go light at the top:
 * the "FEATURED RACE" pill lives there, and real race posters are frequently bright artwork rather
 * than the dark night photo the mockup happens to use. Tuned against the brightest posters on
 * production so every element clears WCAG AA regardless of the image behind it.
 */
private val FeaturedScrimTop = androidx.compose.ui.graphics.Color(0xB3000000)
private val FeaturedScrimMid = androidx.compose.ui.graphics.Color(0xCC000000)
private val FeaturedScrimBottom = androidx.compose.ui.graphics.Color(0xF2000000)

/**
 * Race discovery (04-races-page.png): a large screen title, a search field, the first upcoming race
 * as a featured hero card, then the rest as compact rows with infinite scroll.
 *
 * Every load outcome is represented: first-load spinner, offline, server error with retry, empty
 * result with a "clear filters" escape, and an appended spinner while the next page loads.
 */
@Composable
fun RacesScreen(
    viewModel: RacesViewModel,
    onOpenRace: (String) -> Unit,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val listState = rememberLazyListState()
    // rememberSaveable: both survive process death, so a restored screen does not silently drop the
    // user back to an unfiltered list with the search field closed.
    var searchOpen by rememberSaveable { mutableStateOf(false) }
    var wilayaPickerOpen by rememberSaveable { mutableStateOf(false) }

    // Prefetch one screen early so the next page is usually ready before the user hits the bottom.
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val total = listState.layoutInfo.totalItemsCount
            total > 0 && lastVisible >= total - 3
        }
    }
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) viewModel.loadNextPage()
    }

    if (wilayaPickerOpen) {
        WilayaPickerSheet(
            selected = state.wilaya,
            onSelect = {
                viewModel.onWilayaChange(it)
                wilayaPickerOpen = false
            },
            onDismiss = { wilayaPickerOpen = false },
        )
    }

    Box(modifier = modifier.fillMaxSize().background(colors.background).padding(contentPadding)) {
        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.error != null && state.races.isEmpty() -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::retry,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
            )

            else -> LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = ZidRunDimens.spaceLg,
                    end = ZidRunDimens.spaceLg,
                    top = ZidRunDimens.spaceSm,
                    bottom = ZidRunDimens.spaceXxl,
                ),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
            ) {
                item(key = "header") {
                    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                        ZidRunBrandBar(
                            actionIcon = Icons.Filled.Search,
                            actionContentDescription = stringResource(R.string.races_cd_search),
                            onAction = { searchOpen = !searchOpen },
                        )
                        ZidRunDisplayTitle(text = stringResource(R.string.races_title))

                        // The mockup shows search as an icon action rather than a permanent field,
                        // so the field appears on demand. It stays visible while a query is active,
                        // otherwise dismissing it would silently leave the list filtered.
                        if (searchOpen || state.query.isNotEmpty()) {
                            ZidRunSearchField(
                                value = state.query,
                                onValueChange = viewModel::onQueryChange,
                                placeholder = stringResource(R.string.races_search_hint),
                                contentDescription = stringResource(R.string.races_cd_search),
                            )
                        }

                        ZidRunFilterChip(
                            label = state.wilaya ?: stringResource(R.string.races_filter_all_algeria),
                            onClick = { wilayaPickerOpen = true },
                            contentDescription = stringResource(R.string.races_cd_filter_wilaya),
                        )
                    }
                }

                if (state.isEmpty) {
                    item(key = "empty") {
                        Box(Modifier.fillMaxWidth().height(360.dp)) {
                            ZidRunStatusView(
                                icon = Icons.Filled.EmojiEvents,
                                title = stringResource(R.string.races_empty_title),
                                body = stringResource(R.string.races_empty_body),
                                // With filters there is something to clear; without them there is
                                // not, and the app has no pull-to-refresh — so an unfiltered empty
                                // list was a dead end only a force-quit escaped (device pass
                                // 2026-08-04, seeded races appeared only after restarting the app).
                                actionLabel = if (state.hasFilters) {
                                    stringResource(R.string.races_clear_filters)
                                } else {
                                    stringResource(R.string.common_retry)
                                },
                                onAction = if (state.hasFilters) viewModel::clearFilters else viewModel::retry,
                            )
                        }
                    }
                } else {
                    state.races.firstOrNull()?.let { featured ->
                        item(key = "featured-${featured.id}") {
                            FeaturedRaceCard(race = featured, onClick = { onOpenRace(featured.slug) })
                        }
                    }

                    if (state.races.size > 1) {
                        item(key = "coming-up") {
                            ZidRunSectionHeader(
                                title = stringResource(R.string.races_coming_up),
                                actionLabel = stringResource(R.string.races_view_all),
                                // "View all" clears any active filter and shows the unfiltered list,
                                // which is the only broader view this screen has.
                                onAction = viewModel::clearFilters,
                                modifier = Modifier.padding(top = ZidRunDimens.spaceSm),
                            )
                        }
                    }

                    items(state.races.drop(1), key = { it.id }) { race ->
                        RaceRow(race = race, onClick = { onOpenRace(race.slug) })
                    }
                }

                if (state.loadingMore) {
                    item(key = "loading-more") {
                        Box(Modifier.fillMaxWidth().height(72.dp)) {
                            ZidRunLoading(label = stringResource(R.string.races_loading_more))
                        }
                    }
                }
            }
        }
    }
}

/**
 * Wilaya filter. A plain scrollable list rather than a dropdown: 58 entries do not fit a menu, and
 * a sheet gives each row a full-width 44dp target.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WilayaPickerSheet(
    selected: String?,
    onSelect: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        dragHandle = { BottomSheetDefaults.DragHandle(color = colors.borderStrong) },
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(bottom = ZidRunDimens.spaceXxl),
        ) {
            item(key = "all") {
                WilayaRow(
                    label = stringResource(R.string.races_filter_all_algeria),
                    selected = selected == null,
                    onClick = { onSelect(null) },
                )
            }
            items(AlgeriaWilayas, key = { it }) { wilaya ->
                WilayaRow(label = wilaya, selected = selected == wilaya, onClick = { onSelect(wilaya) })
            }
        }
    }
}

@Composable
private fun WilayaRow(label: String, selected: Boolean, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = if (selected) colors.primary else colors.textStrong,
            modifier = Modifier.weight(1f),
        )
        if (selected) {
            // Decorative: `selectable` already reports the selected state to TalkBack.
            Icon(Icons.Filled.Check, contentDescription = null, tint = colors.primary)
        }
    }
}

@Composable
private fun FeaturedRaceCard(race: RaceSummaryDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.dateCompact(race.startDate, locale)
    // Drop the photo (and its scrim) when it fails to load, so the card falls back to its dark
    // base rather than showing a scrim over nothing.
    var imageFailed by remember(race.id) { mutableStateOf(false) }

    // The photo is the card's background with the copy laid over it, as in 04-races-page.png. The
    // card keeps its dark base colour underneath, so a race with no image — or one whose image
    // fails to load — reads as a deliberate dark card rather than an empty gap.
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surfaceStrong)
            // One node for the whole card: TalkBack reads a single meaningful summary and offers
            // a single "view race" action, instead of five fragments the user must stitch together.
            .semantics(mergeDescendants = true) {
                contentDescription = "${race.title}, $dateLabel, ${race.city}"
            },
    ) {
        if (race.mainImageUrl != null && !imageFailed) {
            AsyncImage(
                model = resolveMediaUrl(race.mainImageUrl),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                onState = { imageFailed = it is AsyncImagePainter.State.Error },
                modifier = Modifier.matchParentSize(),
            )
            // Scrim: race photos are arbitrary, so the title needs a guaranteed contrast floor
            // rather than luck with a bright sky.
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(FeaturedScrimTop, FeaturedScrimMid, FeaturedScrimBottom),
                        )
                    )
            )
        }

        Column(
            modifier = Modifier.padding(ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            ZidRunPill(text = stringResource(R.string.races_featured).uppercase(locale), color = colors.heroAccent)
            Text(
                text = race.title,
                style = MaterialTheme.typography.headlineLarge,
                // The hero sits on surfaceStrong, which is near-black in all three themes (see
                // Color.kt), so its text is fixed light rather than following textStrong — in
                // light mode textStrong would be dark-on-dark.
                color = FeaturedTextColor,
            )
            IconLabel(icon = Icons.Filled.CalendarMonth, text = dateLabel, onDark = true)
            IconLabel(icon = Icons.Filled.LocationOn, text = "${race.city}, ${race.wilaya}", onDark = true)

            if (race.distancesKm.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
                    race.distancesKm.take(3).forEach { distance ->
                        ZidRunPill(text = ZidRunFormat.distance(distance, locale), color = colors.heroAccent)
                    }
                }
            }

            Spacer(Modifier.height(ZidRunDimens.spaceXs))
            // Bright fill with a trailing arrow, per the mockup: on a near-black hero the brand's
            // forest green would recede instead of reading as the card's primary action.
            ZidRunButton(
                text = stringResource(R.string.races_view_race),
                onClick = onClick,
                containerColor = colors.heroAccent,
                contentColor = colors.onHeroAccent,
                trailingIcon = Icons.AutoMirrored.Filled.ArrowForward,
            )
        }
    }
}

@Composable
private fun RaceRow(race: RaceSummaryDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.dateCompact(race.startDate, locale)

    ZidRunCard(
        onClick = onClick,
        contentPadding = PaddingValues(ZidRunDimens.spaceMd),
        modifier = Modifier.semantics(mergeDescendants = true) {
            contentDescription = "${race.title}, $dateLabel, ${race.city}"
        },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
                    .background(colors.surfaceMuted),
                contentAlignment = Alignment.Center,
            ) {
                if (race.mainImageUrl != null) {
                    AsyncImage(
                        model = resolveMediaUrl(race.mainImageUrl),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Icon(Icons.Filled.EmojiEvents, contentDescription = null, tint = colors.textMuted)
                }
            }

            Spacer(Modifier.width(ZidRunDimens.spaceMd))

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
            ) {
                Text(race.title, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
                IconLabel(icon = Icons.Filled.CalendarMonth, text = dateLabel, onDark = false)
                IconLabel(icon = Icons.Filled.LocationOn, text = race.city, onDark = false)
                if (race.distancesKm.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
                        race.distancesKm.take(2).forEach { distance ->
                            ZidRunPill(text = ZidRunFormat.distance(distance, locale))
                        }
                    }
                }
            }

            Icon(
                // AutoMirrored so the chevron points left in Arabic.
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = colors.textMuted,
            )
        }
    }
}

@Composable
private fun IconLabel(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    onDark: Boolean,
) {
    val colors = ZidRunTheme.colors
    val tint = if (onDark) FeaturedMutedColor else colors.textMuted
    Row(
        verticalAlignment = Alignment.CenterVertically,
        // The merged card semantics above already say this; announcing it again would double up.
        modifier = Modifier.clearAndSetSemantics { },
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(ZidRunDimens.spaceXs))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = tint)
    }
}
