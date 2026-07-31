package dz.racedz.nativeapp.core.design

import androidx.compose.ui.graphics.Color

/**
 * Semantic color tokens. These values are ported 1:1 from the web app's CSS custom properties
 * in src/app/globals.css (:root, [data-theme="dark"], [data-theme="race"]) so the native app never
 * forks the visual system. Do not hand-pick new colors per screen; add a token here instead.
 */
data class ZidRunColors(
    val background: Color,
    val foreground: Color,
    val surface: Color,
    val surfaceSoft: Color,
    val surfaceMuted: Color,
    val surfaceStrong: Color,
    val textStrong: Color,
    val text: Color,
    val textMuted: Color,
    val border: Color,
    val borderStrong: Color,
    val primary: Color,
    val onPrimary: Color,
    val primaryStrong: Color,
    val primarySoft: Color,
    val accent: Color,
    val onAccent: Color,
    val accentStrong: Color,
    val accentSoft: Color,
    val success: Color,
    val successSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
    val info: Color,
    val infoSoft: Color,
    val focus: Color,
    /**
     * Accent used on the near-black hero surfaces (`surfaceStrong`): the featured race card and the
     * auth header. Those surfaces are dark in EVERY theme, so this cannot follow `primary` — the
     * light theme's forest green is unreadable on black. The mockups use a bright lime there.
     */
    val heroAccent: Color,
    /** Text/icon colour on top of [heroAccent], e.g. the featured card's "View race" button label. */
    val onHeroAccent: Color,
)

val ZidRunLightColors = ZidRunColors(
    background = Color(0xFFF9FAFB),
    foreground = Color(0xFF111827),
    surface = Color(0xFFFFFFFF),
    surfaceSoft = Color(0xFFF9FAFB),
    surfaceMuted = Color(0xFFF3F4F6),
    surfaceStrong = Color(0xFF111827),
    textStrong = Color(0xFF111827),
    text = Color(0xFF374151),
    textMuted = Color(0xFF6B7280),
    border = Color(0xFFE5E7EB),
    borderStrong = Color(0xFFD1D5DB),
    primary = Color(0xFF15803D),
    onPrimary = Color(0xFFFFFFFF),
    primaryStrong = Color(0xFF166534),
    primarySoft = Color(0xFFECFDF3),
    accent = Color(0xFFF47A20),
    onAccent = Color(0xFFFFFFFF),
    accentStrong = Color(0xFFEA580C),
    accentSoft = Color(0xFFFFF3E9),
    success = Color(0xFF16A34A),
    successSoft = Color(0xFFF0FDF4),
    danger = Color(0xFFDC2626),
    dangerSoft = Color(0xFFFEF2F2),
    info = Color(0xFF2563EB),
    infoSoft = Color(0xFFEFF6FF),
    focus = Color(0xFFF47A20),
    heroAccent = Color(0xFFA3E635),
    onHeroAccent = Color(0xFF0A1A05),
)

val ZidRunDarkColors = ZidRunColors(
    background = Color(0xFF080D18),
    foreground = Color(0xFFF8FAFC),
    surface = Color(0xFF101827),
    surfaceSoft = Color(0xFF0B1220),
    surfaceMuted = Color(0xFF182234),
    surfaceStrong = Color(0xFF020617),
    textStrong = Color(0xFFF8FAFC),
    text = Color(0xFFD1D5DB),
    textMuted = Color(0xFF9CA3AF),
    border = Color(0xFF263244),
    borderStrong = Color(0xFF334155),
    primary = Color(0xFF4ADE80),
    onPrimary = Color(0xFF052E16),
    primaryStrong = Color(0xFF22C55E),
    primarySoft = Color(0xFF052E16),
    accent = Color(0xFFFB923C),
    onAccent = Color(0xFF431407),
    accentStrong = Color(0xFFF47A20),
    accentSoft = Color(0xFF431407),
    success = Color(0xFF22C55E),
    successSoft = Color(0xFF052E16),
    danger = Color(0xFFF87171),
    dangerSoft = Color(0xFF450A0A),
    info = Color(0xFF60A5FA),
    infoSoft = Color(0xFF172554),
    focus = Color(0xFFFB923C),
    heroAccent = Color(0xFFA3E635),
    onHeroAccent = Color(0xFF0A1A05),
)

val ZidRunRaceColors = ZidRunColors(
    background = Color(0xFF090511),
    foreground = Color(0xFFFFF7FF),
    surface = Color(0xFF160B24),
    surfaceSoft = Color(0xFF0F071A),
    surfaceMuted = Color(0xFF251039),
    surfaceStrong = Color(0xFF05020A),
    textStrong = Color(0xFFFFF7FF),
    text = Color(0xFFF2DDFF),
    textMuted = Color(0xFFCFB6DF),
    border = Color(0xFF45205E),
    borderStrong = Color(0xFF7133FF),
    primary = Color(0xFF39FF14),
    onPrimary = Color(0xFF0A1A05),
    primaryStrong = Color(0xFF20D40C),
    primarySoft = Color(0xFF102B0A),
    accent = Color(0xFFFF2BD6),
    onAccent = Color(0xFFFFFFFF),
    accentStrong = Color(0xFFC026D3),
    accentSoft = Color(0xFF3B0A34),
    success = Color(0xFF39FF14),
    successSoft = Color(0xFF102B0A),
    danger = Color(0xFFFF3864),
    dangerSoft = Color(0xFF3A0714),
    info = Color(0xFF9B5CFF),
    infoSoft = Color(0xFF211039),
    focus = Color(0xFF39FF14),
    // The race theme's whole point is the neon accent, so the hero follows it rather than the lime.
    heroAccent = Color(0xFF39FF14),
    onHeroAccent = Color(0xFF0A1A05),
)
