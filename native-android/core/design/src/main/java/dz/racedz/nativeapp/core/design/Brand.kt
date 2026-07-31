package dz.racedz.nativeapp.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Shared building blocks for the shapes that recur across the native mockups: the brand bar, the
 * oversized screen title, filter and distance chips, the stat strip, and the icon-badge menu row.
 *
 * They live here rather than in each feature so the Races, Account, and Race-detail screens cannot
 * drift apart — the mockups reuse the same shapes, so the code should too.
 */

/** Height of the wordmark in the top bar. Matches the mockups' optical size at 1x. */
private val WordmarkHeight = 26.dp

/**
 * Top bar used on the primary tabs: the ZidRun wordmark on the leading side, one optional circular
 * icon action on the trailing side (search on Races, settings on Account).
 *
 * The wordmark is a decorative rendering of the app's own name, so it carries no content
 * description — announcing "ZidRun" on every screen would be noise for a TalkBack user who already
 * knows which app they opened.
 */
@Composable
fun ZidRunBrandBar(
    modifier: Modifier = Modifier,
    actionIcon: ImageVector? = null,
    actionContentDescription: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = ZidRunDimens.spaceSm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(
            painter = painterResource(ZidRunTheme.wordmarkRes),
            modifier = Modifier.height(WordmarkHeight),
        )
        Spacer(Modifier.weight(1f))
        if (actionIcon != null && onAction != null) {
            Box(
                modifier = Modifier
                    // 44dp keeps the tappable area at the accessibility minimum even though the
                    // circle reads smaller.
                    .size(ZidRunDimens.minTouchTarget)
                    .clip(CircleShape)
                    .border(1.dp, colors.border, CircleShape)
                    .background(colors.surface)
                    .clickable(role = Role.Button, onClick = onAction)
                    .semantics { contentDescription = actionContentDescription.orEmpty() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(actionIcon, contentDescription = null, tint = colors.textStrong, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun Image(painter: androidx.compose.ui.graphics.painter.Painter, modifier: Modifier = Modifier) {
    androidx.compose.foundation.Image(
        painter = painter,
        contentDescription = null,
        modifier = modifier.clearAndSetSemantics { },
    )
}

/**
 * The oversized screen title the mockups lead every primary tab with ("Races", "Account").
 * Marked as a heading so TalkBack users can jump straight to it.
 */
@Composable
fun ZidRunDisplayTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.displayLarge,
        color = ZidRunTheme.colors.textStrong,
        modifier = modifier.semantics { heading() },
    )
}

/**
 * The "📍 Algeria ⌄" pill on the Races screen: a soft-tinted, pill-shaped dropdown trigger.
 */
@Composable
fun ZidRunFilterChip(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
            .background(colors.primarySoft)
            .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerPill))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = 10.dp)
            .semantics { contentDescription?.let { this.contentDescription = it } },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = colors.primary, modifier = Modifier.size(18.dp))
        Text(label, style = MaterialTheme.typography.labelLarge, color = colors.primary)
        Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = colors.primary, modifier = Modifier.size(18.dp))
    }
}

/**
 * One cell of the "Your season" strip: a circular outlined icon, a large value with a smaller unit,
 * and a muted label underneath.
 */
@Composable
fun ZidRunStatTile(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "$value $label" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .border(1.5.dp, colors.primary, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
        }
        Column {
            Text(value, style = MaterialTheme.typography.titleLarge, color = colors.textStrong)
            Text(label, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
        }
    }
}

/**
 * A menu row with a circular tinted icon badge, as used by the Account hub's list card.
 *
 * [tint] defaults to the brand green; Support uses a muted tint in the mockup to signal that it
 * leaves the app's own surfaces.
 */
@Composable
fun ZidRunMenuRow(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color? = null,
) {
    val colors = ZidRunTheme.colors
    val badgeTint = tint ?: colors.primary
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(badgeTint.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = badgeTint, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            color = colors.textStrong,
            modifier = Modifier.weight(1f),
        )
        Icon(
            // AutoMirrored so the chevron points left in Arabic.
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = colors.textMuted,
        )
    }
}

/**
 * A section header with an optional trailing text action, e.g. "Coming up … View all".
 */
@Composable
fun ZidRunSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            color = ZidRunTheme.colors.textStrong,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel,
                style = MaterialTheme.typography.labelLarge,
                color = ZidRunTheme.colors.primary,
                textAlign = TextAlign.End,
                modifier = Modifier
                    .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                    .clickable(role = Role.Button, onClick = onAction)
                    .padding(horizontal = ZidRunDimens.spaceSm, vertical = ZidRunDimens.spaceSm),
            )
        }
    }
}

/**
 * The step indicator on Create account: a filled current step, an outlined next step, and the rail
 * between them. Purely decorative — the visible "Step 1 of 2" line above it is what TalkBack reads.
 */
@Composable
fun ZidRunStepIndicator(
    currentStep: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = modifier.fillMaxWidth().clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        (1..totalSteps).forEach { step ->
            val reached = step <= currentStep
            if (step > 1) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(2.dp)
                        .background(if (reached) colors.heroAccent else colors.borderStrong),
                )
            } else {
                Spacer(Modifier.weight(1f))
            }
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(if (reached) colors.heroAccent else Color.Transparent)
                    .border(1.5.dp, if (reached) colors.heroAccent else colors.borderStrong, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = step.toString(),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (reached) colors.onHeroAccent else colors.textMuted,
                )
            }
            if (step == totalSteps) Spacer(Modifier.weight(1f))
        }
    }
}
