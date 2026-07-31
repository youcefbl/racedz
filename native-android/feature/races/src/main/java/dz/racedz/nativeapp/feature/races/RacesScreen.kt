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
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunSectionTitle
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunSearchField
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.RaceSummaryDto
import dz.racedz.nativeapp.core.network.resolveMediaUrl

/** Foreground pair for the near-black `surfaceStrong` the featured hero card uses in every theme. */
private val FeaturedTextColor = androidx.compose.ui.graphics.Color(0xFFF8FAFC)
private val FeaturedMutedColor = androidx.compose.ui.graphics.Color(0xFFCBD5E1)

/** Scrim over the hero photo. Weighted to the bottom, where the title and metadata sit. */
private val FeaturedScrimTop = androidx.compose.ui.graphics.Color(0x33000000)
private val FeaturedScrimBottom = androidx.compose.ui.graphics.Color(0xE6000000)

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
                        ZidRunSectionTitle(
                            text = stringResource(R.string.races_title),
                            modifier = Modifier.padding(top = ZidRunDimens.spaceSm),
                        )
                        ZidRunSearchField(
                            value = state.query,
                            onValueChange = viewModel::onQueryChange,
                            placeholder = stringResource(R.string.races_search_hint),
                            contentDescription = stringResource(R.string.races_cd_search),
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
                                actionLabel = if (state.hasFilters) stringResource(R.string.races_clear_filters) else null,
                                onAction = if (state.hasFilters) viewModel::clearFilters else null,
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
                            ZidRunSectionTitle(
                                text = stringResource(R.string.races_coming_up),
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

@Composable
private fun FeaturedRaceCard(race: RaceSummaryDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.date(race.startDate, locale)
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
                            listOf(FeaturedScrimTop, FeaturedScrimBottom),
                        )
                    )
            )
        }

        Column(
            modifier = Modifier.padding(ZidRunDimens.spaceLg),
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            ZidRunPill(text = stringResource(R.string.races_featured), color = colors.primary)
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
                        ZidRunPill(text = ZidRunFormat.distance(distance, locale), color = colors.primary)
                    }
                }
            }

            Spacer(Modifier.height(ZidRunDimens.spaceXs))
            ZidRunButton(text = stringResource(R.string.races_view_race), onClick = onClick)
        }
    }
}

@Composable
private fun RaceRow(race: RaceSummaryDto, onClick: () -> Unit) {
    val colors = ZidRunTheme.colors
    val locale = currentLocale()
    val dateLabel = ZidRunFormat.date(race.startDate, locale)

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
