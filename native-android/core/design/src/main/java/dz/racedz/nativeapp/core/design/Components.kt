package dz.racedz.nativeapp.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusEvent
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.foundation.text.KeyboardOptions
import kotlin.math.roundToInt
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Slider

// Shared building blocks for every ZidRun screen. Screens compose these instead of hand-rolling
// buttons and fields, so touch-target size, disabled/loading behavior, focus outlines, and the
// theme tokens stay consistent across light, dark, and race modes without per-screen review.

/**
 * The primary call to action. Height is pinned to [ZidRunDimens.minTouchTarget] as a floor rather
 * than a fixed size, so the button still grows with the user's font scale instead of clipping its
 * label at large-text settings.
 */
@Composable
fun ZidRunButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
    trailingIcon: ImageVector? = null,
    /** Overrides the brand green — used by the featured card, whose near-black hero needs a
     *  brighter fill to read as the primary action. Defaults to [ZidRunColors.primary]. */
    containerColor: Color? = null,
    contentColor: Color? = null,
) {
    val colors = ZidRunTheme.colors
    val interactive = enabled && !loading
    val fill = containerColor ?: colors.primary
    val onFill = contentColor ?: colors.onPrimary
    val background = if (interactive) fill else fill.copy(alpha = 0.4f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .background(background)
            .then(
                if (interactive) Modifier.clickable(onClick = onClick) else Modifier
            )
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(22.dp),
                strokeWidth = 2.dp,
                color = onFill,
            )
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                if (leadingIcon != null) {
                    // Decorative: the label right beside it is the button's accessible name.
                    Icon(leadingIcon, contentDescription = null, tint = onFill, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                }
                Text(
                    text = text,
                    style = MaterialTheme.typography.titleMedium,
                    color = onFill,
                    textAlign = TextAlign.Center,
                )
                if (trailingIcon != null) {
                    Spacer(Modifier.width(ZidRunDimens.spaceSm))
                    Icon(trailingIcon, contentDescription = null, tint = onFill, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

/** Secondary action: same geometry, outlined instead of filled. */
@Composable
fun ZidRunOutlinedButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingContent: (@Composable () -> Unit)? = null,
) {
    val colors = ZidRunTheme.colors
    Box(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .background(colors.surface)
            .border(1.dp, colors.borderStrong, RoundedCornerShape(ZidRunDimens.cornerMd))
            .then(if (enabled) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (leadingContent != null) {
                leadingContent()
                Spacer(Modifier.width(ZidRunDimens.spaceMd))
            }
            Text(text, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
        }
    }
}

/**
 * Text input with the mockups' floating label and leading icon.
 *
 * [errorText] is rendered below AND wired into the field's error state, so TalkBack announces the
 * problem instead of a sighted-only red outline.
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun ZidRunTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    errorText: String? = null,
    supportingText: String? = null,
    enabled: Boolean = true,
    /**
     * Free-text answers (injury history, health notes) run to a paragraph, and a one-line box makes
     * the runner type into a keyhole. Everything else stays single-line so Enter still submits.
     */
    singleLine: Boolean = true,
    showPasswordLabel: String = "Show password",
    hidePasswordLabel: String = "Hide password",
    /**
     * Marks the field as required, in the label and to TalkBack. Fields that gate a submit button
     * must say so: the registration form silently required an emergency contact, so a runner who
     * filled everything they could see met a permanently disabled Confirm (DEV-R03).
     */
    required: Boolean = false,
) {
    val colors = ZidRunTheme.colors
    var passwordVisible by remember { mutableStateOf(false) }
    // Keeps the focused field visible when the keyboard opens over it. imePadding() alone only
    // insets the scroll container; on a 1080×2340 phone the phone field still landed underneath
    // the IME after a Tab/Next from the field above it (DEV-R03).
    val bringIntoView = remember { BringIntoViewRequester() }
    val scope = rememberCoroutineScope()

    // The caller may reformat what we hand it — the date of birth gains its dashes as the digits
    // arrive. With the plain String overload the caret keeps its old character offset, so every
    // separator the formatter inserts pushes the caret back through the text: typing 19960521 on
    // the numeric keypad landed as "1996-52-10", and backspace deleted from the middle. Owning a
    // TextFieldValue lets us re-anchor the caret to the same *content* character it was after,
    // counting past whatever separators the formatter added.
    var field by remember { mutableStateOf(TextFieldValue(value, TextRange(value.length))) }
    if (field.text != value) {
        val contentBeforeCaret = field.text.take(field.selection.end).count(Char::isLetterOrDigit)
        field = TextFieldValue(value, TextRange(value.offsetAfterContentChars(contentBeforeCaret)))
    }

    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = field,
            onValueChange = {
                field = it
                onValueChange(it.text)
            },
            label = {
                Text(if (required) "$label · ${stringResource(R.string.common_required)}" else label)
            },
            singleLine = singleLine,
            minLines = if (singleLine) 1 else 3,
            enabled = enabled,
            isError = errorText != null,
            leadingIcon = leadingIcon?.let {
                { Icon(it, contentDescription = null, tint = colors.textMuted) }
            },
            trailingIcon = if (isPassword) {
                {
                    IconButton(
                        onClick = { passwordVisible = !passwordVisible },
                        modifier = Modifier.sizeIn(minWidth = ZidRunDimens.minTouchTarget, minHeight = ZidRunDimens.minTouchTarget),
                    ) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = if (passwordVisible) hidePasswordLabel else showPasswordLabel,
                            tint = colors.textMuted,
                        )
                    }
                }
            } else {
                null
            },
            visualTransformation = if (isPassword && !passwordVisible) {
                PasswordVisualTransformation()
            } else {
                VisualTransformation.None
            },
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 60.dp)
                .bringIntoViewRequester(bringIntoView)
                .onFocusEvent { focus ->
                    if (focus.isFocused) scope.launch {
                        // Wait for the IME inset to be applied; requesting against the old viewport
                        // can leave the field covered as soon as the keyboard finishes opening.
                        delay(250)
                        bringIntoView.bringIntoView()
                    }
                },

            shape = RoundedCornerShape(ZidRunDimens.cornerMd),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = colors.primary,
                unfocusedBorderColor = colors.border,
                errorBorderColor = colors.danger,
                focusedLabelColor = colors.primary,
                unfocusedLabelColor = colors.textMuted,
                focusedTextColor = colors.textStrong,
                unfocusedTextColor = colors.textStrong,
                cursorColor = colors.primary,
                focusedContainerColor = colors.surface,
                unfocusedContainerColor = colors.surface,
            ),
        )

        val helper = errorText ?: supportingText
        if (helper != null) {
            Text(
                text = helper,
                style = MaterialTheme.typography.bodySmall,
                color = if (errorText != null) colors.danger else colors.textMuted,
                modifier = Modifier.padding(start = ZidRunDimens.spaceMd, top = ZidRunDimens.spaceXs),
            )
        }
    }
}

/**
 * Offset just past the [count]th letter-or-digit, skipping separators the formatter inserted.
 * Used to keep a text caret on the character the runner was actually editing.
 */
private fun String.offsetAfterContentChars(count: Int): Int {
    if (count <= 0) return 0
    var seen = 0
    forEachIndexed { index, char ->
        if (char.isLetterOrDigit()) {
            seen++
            if (seen == count) return index + 1
        }
    }
    return length
}

/** Card surface used for grouped content across every screen. */
@Composable
fun ZidRunCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(ZidRunDimens.spaceLg),
    content: @Composable () -> Unit,
) {
    val colors = ZidRunTheme.colors
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(colors.surface)
            .border(1.dp, colors.border, RoundedCornerShape(ZidRunDimens.cornerLg))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(contentPadding),
    ) {
        content()
    }
}

/** Distance/status pill from the race cards. */
@Composable
fun ZidRunPill(
    text: String,
    modifier: Modifier = Modifier,
    color: Color? = null,
) {
    val colors = ZidRunTheme.colors
    val tint = color ?: colors.primary
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
            .border(1.dp, tint, RoundedCornerShape(ZidRunDimens.cornerPill))
            .padding(horizontal = ZidRunDimens.spaceMd, vertical = 6.dp),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = tint,
            maxLines = 1,
            softWrap = false,
        )
    }
}

@Composable
fun ZidRunSectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.headlineSmall,
        color = ZidRunTheme.colors.textStrong,
        // Announced as a heading so TalkBack users can jump between sections.
        modifier = modifier.semantics { heading() },
    )
}

// ---- loading / empty / error / offline --------------------------------------------------------

@Composable
fun ZidRunLoading(modifier: Modifier = Modifier, label: String) {
    Box(
        modifier = modifier.fillMaxSize().padding(ZidRunDimens.spaceXl),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = ZidRunTheme.colors.primary)
            Spacer(Modifier.height(ZidRunDimens.spaceMd))
            Text(label, style = MaterialTheme.typography.bodyMedium, color = ZidRunTheme.colors.textMuted)
        }
    }
}

/**
 * One component for empty, error, and offline states. They differ only in icon and copy, and
 * collapsing them means a screen cannot accidentally handle two of the three and forget the rest.
 */
@Composable
fun ZidRunStatusView(
    icon: ImageVector,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = ZidRunTheme.colors
    Box(
        modifier = modifier.fillMaxSize().padding(ZidRunDimens.spaceXl),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        ) {
            Icon(icon, contentDescription = null, tint = colors.textMuted, modifier = Modifier.size(40.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = colors.textStrong,
                textAlign = TextAlign.Center,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
            )
            if (actionLabel != null && onAction != null) {
                Spacer(Modifier.height(ZidRunDimens.spaceXs))
                ZidRunButton(text = actionLabel, onClick = onAction, modifier = Modifier.width(200.dp))
            }
        }
    }
}

/**
 * Full-screen failure state.
 *
 * When [offline] is true the caller's [message] is ignored in favour of the localized string: an
 * offline failure is synthesized client-side, so its message is whatever English literal the
 * network layer carries and would appear untranslated in a French or Arabic UI. Server messages
 * are shown as sent.
 */
@Composable
fun ZidRunErrorView(
    message: String,
    title: String,
    retryLabel: String,
    onRetry: () -> Unit,
    offline: Boolean,
    modifier: Modifier = Modifier,
    /**
     * Replace [message] with the localized generic body.
     *
     * Defaults to [offline] for callers that predate this, but any error whose server message is a
     * generic English fallback should pass true — otherwise an Arabic or French screen shows an
     * English sentence in the middle of it.
     */
    useLocalizedBody: Boolean = offline,
) {
    ZidRunStatusView(
        icon = if (offline) Icons.Filled.CloudOff else Icons.Filled.ErrorOutline,
        title = title,
        body = if (useLocalizedBody) {
            stringResource(if (offline) R.string.common_offline_body else R.string.common_error_body)
        } else {
            message
        },
        actionLabel = retryLabel,
        onAction = onRetry,
        modifier = modifier,
    )
}

/**
 * Inline error banner for forms, where a full-screen state would lose the user's typing.
 *
 * [offline] follows the same rule as [ZidRunErrorView]: an offline failure is synthesized on the
 * client and its message is an untranslated placeholder, so the localized string wins.
 */
@Composable
fun ZidRunInlineError(
    message: String,
    modifier: Modifier = Modifier,
    offline: Boolean = false,
    useLocalizedBody: Boolean = offline,
) {
    val colors = ZidRunTheme.colors
    val text = if (useLocalizedBody) {
        stringResource(if (offline) R.string.common_offline_body else R.string.common_error_body)
    } else {
        message
    }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .background(colors.dangerSoft)
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.ErrorOutline, contentDescription = null, tint = colors.danger, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(ZidRunDimens.spaceSm))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = colors.danger)
    }
}

/**
 * Tappable list row used by the Account menu. The whole row is one accessibility node with a
 * minimum 56dp height, so the target is comfortably above the 44dp floor.
 */
@Composable
fun ZidRunListRow(
    title: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = ZidRunTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                .background(colors.primarySoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = colors.textStrong)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
            }
        }
        trailing?.invoke()
    }
}

/** Decorative divider — hidden from TalkBack, which would otherwise announce an empty element. */
@Composable
fun ZidRunDivider(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(ZidRunTheme.colors.border)
            .clearAndSetSemantics { },
    )
}

@Composable
fun ZidRunLabel(text: String, modifier: Modifier = Modifier, color: Color? = null) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
        color = color ?: ZidRunTheme.colors.textMuted,
        modifier = modifier,
    )
}

/**
 * Single-choice pill (theme, language, distance, payment method). Uses `selectable` rather than
 * `clickable` so TalkBack announces it as a radio-style option and reads its selected state, which
 * a plain clickable Box would not.
 */
@Composable
fun ZidRunChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    val shape = RoundedCornerShape(ZidRunDimens.cornerPill)
    Box(
        modifier = modifier
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .clip(shape)
            .background(if (selected) colors.primarySoft else colors.surface)
            .border(1.dp, if (selected) colors.primary else colors.border, shape)
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = ZidRunDimens.spaceLg, vertical = ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) colors.primary else colors.text,
        )
    }
}

/**
 * Search input. Uses a placeholder rather than a floating label — see the note on [ZidRunTextField]:
 * a long search hint promoted to a label wraps over the heading above the field.
 */
@Composable
fun ZidRunSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    val colors = ZidRunTheme.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, maxLines = 1) },
        singleLine = true,
        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = colors.textMuted) },
        modifier = modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 56.dp)
            .semantics { this.contentDescription = contentDescription },
        shape = RoundedCornerShape(ZidRunDimens.cornerLg),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = colors.primary,
            unfocusedBorderColor = colors.border,
            focusedTextColor = colors.textStrong,
            unfocusedTextColor = colors.textStrong,
            cursorColor = colors.primary,
            focusedContainerColor = colors.surface,
            unfocusedContainerColor = colors.surface,
        ),
    )
}

/** A low-emphasis action — "Skip for now" and similar, where the primary path is elsewhere. */
@Composable
fun ZidRunTextButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    /**
     * Whether to take the whole row.
     *
     * True suits a stacked action under a form. Inside a Row beside other content it is a trap: the
     * button eats the remaining width and collapses whatever it sits next to — which is exactly what
     * happened to the goal card's "Goal / 10K" when this was added beside it.
     */
    fillWidth: Boolean = true,
) {
    val colors = ZidRunTheme.colors
    Box(
        modifier = modifier
            .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
            .heightIn(min = ZidRunDimens.minTouchTarget)
            .clip(RoundedCornerShape(ZidRunDimens.cornerMd))
            .clickable(onClick = onClick)
            .padding(ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = MaterialTheme.typography.titleSmall, color = colors.textMuted, textAlign = TextAlign.Center)
    }
}

/**
 * A discrete 1–10 effort slider — the "how hard did that feel" control.
 *
 * A slider rather than ten tappable boxes, matching the website's `<input type="range">`: effort is
 * a magnitude the runner adjusts by feel, and dragging expresses that better than aiming at a 26dp
 * box. It also stops being a row of ten small targets, which at 320dp is what the boxes were.
 *
 * The floor is 1, not 0. The server's schema is `min(1).max(10)` on both the mobile and the website
 * paths, so a 0 would be refused after the fact — and "no effort at all" is not a reading of a run
 * that happened. The label states the value so the number is never inferred from the handle's
 * position, and the whole control carries one accessible name with the slider's own value semantics.
 */
@Composable
fun ZidRunEffortSlider(
    value: Int,
    onValueChange: (Int) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = ZidRunTheme.colors
    Column(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = label },
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
        Text(label, style = MaterialTheme.typography.titleSmall, color = colors.textStrong)
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.roundToInt().coerceIn(EFFORT_MIN, EFFORT_MAX)) },
            valueRange = EFFORT_MIN.toFloat()..EFFORT_MAX.toFloat(),
            // One stop per whole number: 10 positions means 8 steps between the two endpoints.
            steps = EFFORT_MAX - EFFORT_MIN - 1,
            enabled = enabled,
            colors = SliderDefaults.colors(
                thumbColor = colors.primary,
                activeTrackColor = colors.primary,
                activeTickColor = colors.onPrimary,
                inactiveTrackColor = colors.surfaceMuted,
                inactiveTickColor = colors.border,
            ),
            modifier = Modifier.fillMaxWidth().heightIn(min = ZidRunDimens.minTouchTarget),
        )
        // The ends of the scale, so the number has a meaning without a legend elsewhere.
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                stringResource(R.string.runs_effort_easy),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
            Text(
                stringResource(R.string.runs_effort_max),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
        }
    }
}

private const val EFFORT_MIN = 1
private const val EFFORT_MAX = 10
