package dz.racedz.nativeapp.core.design

import androidx.compose.ui.unit.dp

/** Shared spacing/sizing scale. Keep new values here instead of hard-coding dp per screen. */
object ZidRunDimens {
    val spaceXs = 4.dp
    val spaceSm = 8.dp
    val spaceMd = 12.dp
    val spaceLg = 16.dp
    val spaceXl = 24.dp
    val spaceXxl = 32.dp

    val cornerSm = 8.dp
    val cornerMd = 12.dp
    val cornerLg = 16.dp
    val cornerPill = 999.dp

    /** WCAG / Material minimum interactive target — every tappable control must meet this. */
    val minTouchTarget = 44.dp
}
