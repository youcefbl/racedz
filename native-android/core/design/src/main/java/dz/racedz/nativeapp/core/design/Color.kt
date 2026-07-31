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

// Deliberately diverges from the web's dark palette. Ported 1:1, its slate blues read as "blue app"
// on an OLED phone held at arm's length outdoors — the web's are seen on a bright desk monitor where
// the same hue reads as neutral. These are near-neutral charcoals with only a trace of warmth, so
// the brand green is the sole saturated thing on screen and carries the energy by itself. Deeper
// blacks also cost less battery on OLED, which matters during a run.
val ZidRunDarkColors = ZidRunColors(
    background = Color(0xFF0A0A0B),
    foreground = Color(0xFFFAFAFA),
    surface = Color(0xFF151517),
    surfaceSoft = Color(0xFF101012),
    surfaceMuted = Color(0xFF1F1F22),
    surfaceStrong = Color(0xFF000000),
    textStrong = Color(0xFFFAFAFA),
    text = Color(0xFFD4D4D6),
    textMuted = Color(0xFF9B9BA1),
    border = Color(0xFF2A2A2E),
    borderStrong = Color(0xFF3D3D42),
    primary = Color(0xFF4ADE80),
    onPrimary = Color(0xFF04240F),
    primaryStrong = Color(0xFF22C55E),
    // Tinted rather than near-black, so a "soft" surface actually reads as green-tinted against the
    // new near-neutral background instead of disappearing into it.
    primarySoft = Color(0xFF0E2A18),
    accent = Color(0xFFFB923C),
    onAccent = Color(0xFF431407),
    accentStrong = Color(0xFFF47A20),
    accentSoft = Color(0xFF2E1508),
    success = Color(0xFF22C55E),
    successSoft = Color(0xFF0E2A18),
    danger = Color(0xFFF87171),
    dangerSoft = Color(0xFF2E0F0F),
    info = Color(0xFF60A5FA),
    infoSoft = Color(0xFF10203A),
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
