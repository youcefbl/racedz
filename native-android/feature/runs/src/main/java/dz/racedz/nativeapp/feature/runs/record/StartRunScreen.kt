package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.zidRunOnDarkColors
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.currentLocale
import dz.racedz.nativeapp.core.network.WeatherDto
import androidx.compose.foundation.layout.RowScope
import dz.racedz.nativeapp.core.design.ZidRunDarkSurfaceSystemBars
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.feature.runs.R as RunsR
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.runtime.withFrameMillis
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.Canvas
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.PI

/** How long the runner must hold before recording starts. */
private const val HOLD_TO_BEGIN_MS = 700L

/**
 * "Ready when you are" (02-create-new-run.png): the pre-run screen.
 *
 * Dark whatever the app theme: this is the screen before a run and the one the runner glances at
 * outdoors, and the mockup treats it as a single dark surface. "Dark" here means the current
 * theme's dark palette (zidRunOnDarkColors) — Race keeps its violet and neon, Light borrows the
 * Dark theme's charcoals — not the Dark theme's colours imposed on everyone.
 *
 * Starting is a press-and-hold rather than a tap. A run started by accident in a pocket is worse
 * than one that takes an extra second to start, and the mockup asks for it. TalkBack users get an
 * ordinary activate action instead, since holding is not a gesture a screen reader exposes.
 */
@Composable
fun StartRunScreen(
    viewModel: StartRunViewModel,
    onBack: () -> Unit,
    onStarted: () -> Unit,
    modifier: Modifier = Modifier,
    /**
     * The planned session the runner tapped "Log this run" on, if they came from the coach's plan.
     * It is handed straight to the recorder so the saved run links back to that session.
     */
    workoutId: String? = null,
) {
    // This screen is dark in every theme, so the system bars must be too (DEV-R01).
    ZidRunDarkSurfaceSystemBars()

    val context = LocalContext.current
    val session by viewModel.state.collectAsStateWithLifecycle()
    var permissionDenied by remember { mutableStateOf(false) }

    // Live conditions for where the run will happen. Read once on entry from the last known fix when
    // location is already granted; with no fix the server falls back to the runner's wilaya. A
    // nicety — never gated on permission and never blocking the run.
    LaunchedEffect(Unit) {
        val fix = lastKnownLocation(context)
        viewModel.loadWeather(fix?.latitude, fix?.longitude)
        if (fix != null) viewModel.setPlaceName(cityName(context, fix.latitude, fix.longitude))
    }
    // Arriving from the coach's "Log this run" means the runner already chose a planned session, so
    // Guided is the mode they asked for (DEV-R06). Starting in Free associated the workout but ran
    // no cues or steps unless they noticed the tabs and switched — the guidance simply never came.
    // Free remains one tap away as the "record without guidance" escape hatch.
    var mode by rememberSaveable {
        mutableStateOf(if (workoutId != null) RunMode.Guided else RunMode.Free)
    }
    var audioCues by rememberSaveable { mutableStateOf(true) }

    // Notifications are requested alongside location: the foreground service needs a visible
    // notification, and without the permission the runner sees no indication that GPS is on.
    val permissions = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
        // Cadence, for the run/ride check. Declining it is fine — the run still records, without it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(Manifest.permission.ACTIVITY_RECOGNITION)
    }.toTypedArray()

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        // Coarse-only is not enough to measure a route, so precise is the one that decides.
        val precise = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (precise) {
            permissionDenied = false
            // Guided mode runs the plan; Free mode runs the chosen workout type's structure (or
            // nothing, for a plain free run).
            val guidingSession = if (mode == RunMode.Guided) session.session else session.freeStructure
            // Only attach the planned workout when the runner is actually running it (Guided). If they
            // switched to Free/custom, the run must NOT complete the planned session (adherence bug).
            val effectiveWorkoutId = workoutId.takeIf { mode == RunMode.Guided }
            beginRecording(context, audioCues, guidingSession, effectiveWorkoutId, onStarted)
        } else {
            permissionDenied = true
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(zidRunOnDarkColors().background)
            .navigationBarsPadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onBack, onDarkSurface = true)

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = ZidRunDimens.spaceLg),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
        ) {
            Text(
                text = stringResource(R.string.runs_ready_title),
                style = MaterialTheme.typography.displaySmall,
                color = zidRunOnDarkColors().textStrong,
                textAlign = TextAlign.Center,
            )

            Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg)) {
                ReadyChip(
                    icon = Icons.Filled.LocationOn,
                    label = stringResource(R.string.runs_ready_gps),
                    tint = zidRunOnDarkColors().primary,
                )
                ReadyChip(
                    icon = Icons.Filled.Lock,
                    label = stringResource(R.string.runs_private),
                    tint = zidRunOnDarkColors().textMuted,
                )
            }

            // Conditions where the run will happen, when the endpoint returned anything worth showing.
            session.weather
                ?.takeIf { it.temperatureC != null || it.humidityPct != null || it.windSpeedKmh != null }
                // The device's own reverse-geocoded town when there is a GPS fix, otherwise the
                // wilaya the server used. The first is only available once location has been
                // granted — which does not happen until hold-to-begin — so before a runner's first
                // run the second is the only one there is, and the card used to show no place at all.
                ?.let { WeatherCard(it, session.placeName ?: it.place) }

            // Free or guided. A guided run counts through warm-up, work, and cool-down and speaks
            // each change; a free run just records.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .background(zidRunOnDarkColors().surface),
            ) {
                ModeTab(
                    label = stringResource(R.string.runs_mode_free),
                    selected = mode == RunMode.Free,
                    onClick = { mode = RunMode.Free },
                    modifier = Modifier.weight(1f),
                )
                ModeTab(
                    label = stringResource(R.string.runs_mode_guided),
                    selected = mode == RunMode.Guided,
                    onClick = { mode = RunMode.Guided },
                    modifier = Modifier.weight(1f),
                )
            }

            if (mode == RunMode.Guided) {
                GuidedPlanCard(
                    dto = session.session,
                    loading = session.loading,
                    title = session.session?.title ?: stringResource(R.string.runs_mode_guided),
                )
            }

            // Free mode: pick a workout type and the run is audio-guided through it (or "Easy" for a
            // plain free run). Structured types are a subscriber feature — non-subscribers see the
            // chips disabled with a prompt. Choosing a type fetches its structure; the runner can
            // tune it and the card previews the steps.
            if (mode == RunMode.Free) {
                WorkoutTypePicker(
                    selected = session.selectedType ?: FREE_RUN_TYPE,
                    enabled = session.canCustomize,
                    onSelect = { viewModel.selectWorkoutType(it) },
                )
                if (!session.canCustomize && session.entitlementKnown) {
                    SubscribeToCustomizeNotice()
                }
                session.selectedType?.takeIf { it != FREE_RUN_TYPE }?.let { type ->
                    WorkoutParamControls(
                        type = type,
                        values = session.typeParams,
                        onChange = { key, delta -> viewModel.updateParam(key, delta) },
                    )
                    GuidedPlanCard(
                        dto = session.freeStructure,
                        loading = session.structureLoading,
                        title = stringResource(workoutTypeLabel(type)),
                    )
                }
            }

            // Cues are the reason to look at the phone less, so they default on.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                    .background(zidRunOnDarkColors().surface)
                    .clickable(role = Role.Switch) { audioCues = !audioCues }
                    .padding(ZidRunDimens.spaceMd)
                    .semantics(mergeDescendants = true) { },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    if (audioCues) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                    contentDescription = null,
                    tint = if (audioCues) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
                )
                Spacer(Modifier.width(ZidRunDimens.spaceMd))
                Text(
                    text = stringResource(R.string.runs_audio_cues),
                    style = MaterialTheme.typography.titleSmall,
                    color = zidRunOnDarkColors().textStrong,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = audioCues,
                    onCheckedChange = { audioCues = it },
                    // Every state, not just the checked one. The unchecked colours were left to
                    // MaterialTheme — which follows the APP theme, not this always-dark surface —
                    // so switching cues off in Light mode put a pale grey track on a black screen.
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = zidRunOnDarkColors().onPrimary,
                        checkedTrackColor = zidRunOnDarkColors().primary,
                        checkedBorderColor = zidRunOnDarkColors().primary,
                        uncheckedThumbColor = zidRunOnDarkColors().textMuted,
                        uncheckedTrackColor = zidRunOnDarkColors().surfaceMuted,
                        uncheckedBorderColor = zidRunOnDarkColors().borderStrong,
                    ),
                )
            }

            // How often the voice reports progress. Persisted (RunSettings), unlike the on/off
            // switch above, and only shown while cues are on — an interval for a silent run is noise.
            if (audioCues) {
                CueIntervalPicker()
            }

            // Cues are useless if the device has no voice for the runner's language — a common case
            // for Arabic on many phones. Say so, with a one-tap route to install one, only when cues
            // are on and the language is actually missing.
            val ttsMissing = rememberTtsMissing(currentLocale(), audioCues)
            if (audioCues && ttsMissing) {
                TtsInstallNotice()
            }

            // Auto-pause: stops the clock at a red light. Persisted across runs (Strava keeps the
            // same choice under Record → Settings), so it is read from and written to RunSettings.
            AutoPauseRow()

            // Hold waits while a chosen workout structure is still loading, so a run can never start
            // on an older structure than the one shown (or on no structure when one was picked).
            val awaitingStructure = mode == RunMode.Free &&
                (session.selectedType?.takeIf { it != FREE_RUN_TYPE } != null) &&
                (session.structureLoading || session.freeStructure == null)
            HoldToBegin(
                enabled = !awaitingStructure,
                onTriggered = { launcher.launch(permissions) },
            )

            if (permissionDenied) {
                Text(
                    text = stringResource(R.string.runs_permission_denied),
                    style = MaterialTheme.typography.bodyMedium,
                    color = zidRunOnDarkColors().danger,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                )
                ZidRunButton(
                    text = stringResource(R.string.runs_grant_permission),
                    onClick = { launcher.launch(permissions) },
                    // ZidRunButton defaults to the app theme's primary, which on this always-dark
                    // screen meant the Light theme's forest green on near-black. Pinned to the
                    // dark-surface palette like everything else here.
                    containerColor = zidRunOnDarkColors().primary,
                    contentColor = zidRunOnDarkColors().onPrimary,
                )
            }
        }
    }
}

private fun beginRecording(
    context: android.content.Context,
    audioCues: Boolean,
    // The session that should guide this run: the plan (Guided mode) or the chosen workout type's
    // structure (Free mode with a type picked), or null for a plain free run. Callers pick it.
    session: dz.racedz.nativeapp.core.network.GuidedSessionDto?,
    workoutId: String?,
    onStarted: () -> Unit,
) {
    // An explicit workout from "Log this run" wins over the session's own id. A chosen workout type
    // has no workoutId, so it stays a free run that simply happens to be audio-guided.
    if (!RunRecorder.start(workoutId ?: session?.workoutId)) {
        // A recording already exists (this screen was reached by deep link or a stale back stack).
        // Do not touch the live run's settings or restart the service — just land on it.
        onStarted()
        return
    }
    GuidedSessionController.start(session)
    RunSettings.audioCuesEnabled = audioCues
    RunTrackingService.start(context)
    onStarted()
}

/**
 * The runner's last known position, or null.
 *
 * A cached fix, not a fresh one: this only seeds the weather lookup, so a settled last-known point is
 * both good enough and instant, where waiting on the GPS to acquire would stall the start screen. But
 * a *stale* fix is worse than none — a days-old point would confidently show the wrong city and
 * conditions (ALL-R10) — so a fix older than [FRESH_FIX_MS] is discarded and the weather endpoint
 * falls back to the runner's wilaya (shown as a regional estimate). Null too whenever location was
 * not granted or nothing is cached. Permission is re-checked here rather than assumed.
 */
@SuppressLint("MissingPermission")
private fun lastKnownLocation(context: Context): Location? {
    val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (!fine && !coarse) return null
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
    val fix = runCatching {
        (if (fine) manager.getLastKnownLocation(LocationManager.GPS_PROVIDER) else null)
            ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
    }.getOrNull() ?: return null
    // Discard a stale fix rather than label an old city as "where this run will happen".
    return fix.takeIf { System.currentTimeMillis() - it.time <= FRESH_FIX_MS }
}

/** A cached fix older than this (10 min) is treated as no fix for pre-run weather/city. */
private const val FRESH_FIX_MS = 10 * 60 * 1000L

/**
 * The city/town for a fix, reverse-geocoded on-device, or null.
 *
 * Uses the platform [Geocoder] (no extra provider beyond what weather already needs) on a background
 * dispatcher, since it can block on I/O. Best-effort: an unavailable geocoder, a device with no data,
 * or an unnamed point simply yields no place label.
 */
private suspend fun cityName(context: Context, lat: Double, lng: Double): String? =
    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        if (!android.location.Geocoder.isPresent()) return@withContext null
        runCatching {
            val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
            @Suppress("DEPRECATION")
            val address = geocoder.getFromLocation(lat, lng, 1)?.firstOrNull()
            address?.locality ?: address?.subAdminArea ?: address?.adminArea
        }.getOrNull()
    }

/**
 * True when spoken cues are wanted but the device's text-to-speech has no voice for [locale].
 *
 * Spins up a short-lived engine, asks whether the language is available, then releases it. Returns
 * false while it is still checking and whenever cues are off, so the notice never flashes in.
 */
@Composable
private fun rememberTtsMissing(locale: java.util.Locale, enabled: Boolean): Boolean {
    val context = LocalContext.current
    var missing by remember { mutableStateOf(false) }
    DisposableEffect(locale, enabled) {
        if (!enabled) {
            missing = false
            return@DisposableEffect onDispose {}
        }
        var engine: android.speech.tts.TextToSpeech? = null
        engine = android.speech.tts.TextToSpeech(context.applicationContext) { status ->
            if (status == android.speech.tts.TextToSpeech.SUCCESS) {
                val availability = runCatching { engine?.isLanguageAvailable(locale) }.getOrNull()
                    ?: android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED
                // < LANG_AVAILABLE (0) means MISSING_DATA (-1) or NOT_SUPPORTED (-2).
                missing = availability < android.speech.tts.TextToSpeech.LANG_AVAILABLE
            }
        }
        onDispose { engine?.shutdown() }
    }
    return missing
}

/** A card prompting the runner to install a TTS voice, with a one-tap route to the system installer. */
@Composable
private fun TtsInstallNotice() {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().accent.copy(alpha = 0.12f))
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Text(
            text = stringResource(R.string.runs_tts_missing),
            style = MaterialTheme.typography.bodyMedium,
            color = zidRunOnDarkColors().textStrong,
        )
        Text(
            text = stringResource(R.string.runs_tts_install),
            style = MaterialTheme.typography.titleSmall,
            color = zidRunOnDarkColors().accent,
            modifier = Modifier
                .clip(RoundedCornerShape(ZidRunDimens.cornerSm))
                .clickable(role = Role.Button) {
                    // The platform "install voice data" prompt; fall back to the TTS settings screen.
                    val install = android.content.Intent(android.speech.tts.TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)
                        .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                    val ok = runCatching { context.startActivity(install) }.isSuccess
                    if (!ok) {
                        runCatching {
                            context.startActivity(
                                android.content.Intent("com.android.settings.TTS_SETTINGS")
                                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        }
                    }
                }
                .padding(vertical = ZidRunDimens.spaceXs),
        )
    }
}

/** Live conditions where the run will happen: place, temperature, humidity, and wind. */
@Composable
private fun WeatherCard(weather: WeatherDto, placeName: String?) {
    val locale = currentLocale()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
      // The city/town, above the temperature, so the reading is anchored to a place.
      placeName?.let { name ->
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
              Icon(
                  Icons.Filled.LocationOn,
                  contentDescription = null,
                  tint = zidRunOnDarkColors().textMuted,
                  modifier = Modifier.size(14.dp),
              )
              Text(
                  text = name,
                  style = MaterialTheme.typography.labelLarge,
                  color = zidRunOnDarkColors().textStrong,
              )
          }
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        weather.temperatureC?.let { temp ->
            WeatherStat(
                value = stringResource(R.string.runs_weather_temp, ZidRunFormat.count(temp.roundToInt(), locale)),
                label = weather.apparentC?.let { feels ->
                    stringResource(R.string.runs_weather_feels, ZidRunFormat.count(feels.roundToInt(), locale))
                } ?: weather.weatherLabel?.replaceFirstChar { it.uppercase() }.orEmpty(),
            )
        }
        weather.humidityPct?.let { humidity ->
            WeatherStat(
                value = stringResource(R.string.runs_weather_humidity_value, ZidRunFormat.count(humidity, locale)),
                label = stringResource(R.string.runs_weather_humidity),
            )
        }
        weather.windSpeedKmh?.let { wind ->
            WeatherStat(
                value = stringResource(R.string.runs_weather_wind_value, ZidRunFormat.count(wind, locale)),
                label = stringResource(R.string.runs_weather_wind),
                // Meteorological direction is where the wind comes FROM; the arrow points where it blows TO.
                arrowDegrees = weather.windDirectionDegrees?.let { it.toFloat() + 180f },
            )
        }
      }
      // When the reading is only the wilaya centroid (no GPS fix), say so — on a large wilaya these
      // conditions can be far from the runner, and it should not read as street-level local weather.
      if (weather.source == "wilaya") {
          Text(
              text = stringResource(R.string.runs_weather_region),
              style = MaterialTheme.typography.labelSmall,
              color = zidRunOnDarkColors().textMuted,
          )
      }
    }
}

@Composable
private fun RowScope.WeatherStat(value: String, label: String, arrowDegrees: Float? = null) {
    Column(
        modifier = Modifier.weight(1f),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleSmall,
                color = zidRunOnDarkColors().textStrong,
            )
            if (arrowDegrees != null) {
                Spacer(Modifier.width(ZidRunDimens.spaceSm))
                Text(
                    text = "↑",
                    style = MaterialTheme.typography.titleSmall,
                    color = zidRunOnDarkColors().primary,
                    modifier = Modifier.graphicsLayer { rotationZ = arrowDegrees },
                )
            }
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = zidRunOnDarkColors().textMuted,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ModeTab(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(if (selected) zidRunOnDarkColors().primary else Color.Transparent)
            .selectable(selected = selected, role = Role.Tab, onClick = onClick)
            .padding(vertical = ZidRunDimens.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textMuted,
        )
    }
}

/** The localized name for a free-run workout type. */
private fun workoutTypeLabel(type: String?): Int = when (type) {
    "long_run" -> R.string.runs_type_long_run
    "intervals" -> R.string.runs_type_intervals
    "strides" -> R.string.runs_type_strides
    "norwegian" -> R.string.runs_type_norwegian
    else -> R.string.runs_type_easy
}

/**
 * Free-run workout-type chooser: "Easy" is a plain free run; the rest audio-guide the run.
 *
 * The structured types are a subscriber feature: when [enabled] is false they render dimmed and only
 * "Easy" responds, so a non-subscriber can still run — the subscribe prompt sits below.
 */
@Composable
private fun WorkoutTypePicker(selected: String, enabled: Boolean, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        Text(
            text = stringResource(R.string.runs_type_label),
            style = MaterialTheme.typography.titleSmall,
            color = zidRunOnDarkColors().textMuted,
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            FREE_RUN_WORKOUT_TYPES.forEach { type ->
                val isSelected = type == selected
                // "Easy" is always available; the structured types need a subscription.
                val locked = !enabled && type != FREE_RUN_TYPE
                val fill = when {
                    isSelected -> zidRunOnDarkColors().primary
                    else -> zidRunOnDarkColors().surface
                }
                val label = when {
                    isSelected -> zidRunOnDarkColors().onPrimary
                    locked -> zidRunOnDarkColors().textMuted.copy(alpha = 0.5f)
                    else -> zidRunOnDarkColors().textStrong
                }
                Text(
                    text = stringResource(workoutTypeLabel(type)),
                    style = MaterialTheme.typography.labelLarge,
                    color = label,
                    modifier = Modifier
                        .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                        .background(fill)
                        .selectable(selected = isSelected, enabled = !locked, role = Role.Tab) { onSelect(type) }
                        .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                )
            }
        }
    }
}

/** "Voice update every: Off · 0.5 km · 1 km · 2 km", persisted in [RunSettings.cueInterval]. */
@Composable
private fun CueIntervalPicker() {
    var selected by remember { mutableStateOf(RunSettings.cueInterval) }
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        Text(
            text = stringResource(R.string.runs_cue_interval),
            style = MaterialTheme.typography.titleSmall,
            color = zidRunOnDarkColors().textMuted,
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            RunSettings.CueInterval.entries.forEach { interval ->
                val isSelected = interval == selected
                val label = if (interval.meters == 0) {
                    stringResource(R.string.runs_cue_interval_off)
                } else {
                    val km = interval.meters / 1000.0
                    stringResource(
                        R.string.runs_cue_interval_value,
                        if (interval.meters % 1000 == 0) ZidRunFormat.count(interval.meters / 1000, locale)
                        else ZidRunFormat.decimal(km, locale, digits = 1),
                    )
                }
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSelected) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textStrong,
                    modifier = Modifier
                        .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                        .background(if (isSelected) zidRunOnDarkColors().primary else zidRunOnDarkColors().surface)
                        .selectable(selected = isSelected, role = Role.RadioButton) {
                            selected = interval
                            RunSettings.cueInterval = interval
                        }
                        .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                )
            }
        }
    }
}

/** The auto-pause switch, same visual language as the audio-cue row above it. */
@Composable
private fun AutoPauseRow() {
    var enabled by remember { mutableStateOf(RunSettings.autoPauseEnabled) }
    fun set(value: Boolean) {
        enabled = value
        RunSettings.autoPauseEnabled = value
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .clickable(role = Role.Switch) { set(!enabled) }
            .padding(ZidRunDimens.spaceMd)
            .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Filled.PauseCircle,
            contentDescription = null,
            tint = if (enabled) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
        )
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Column(Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.runs_auto_pause),
                style = MaterialTheme.typography.titleSmall,
                color = zidRunOnDarkColors().textStrong,
            )
            Text(
                text = stringResource(R.string.runs_auto_pause_help),
                style = MaterialTheme.typography.bodySmall,
                color = zidRunOnDarkColors().textMuted,
            )
        }
        Switch(
            checked = enabled,
            onCheckedChange = { set(it) },
            colors = SwitchDefaults.colors(
                checkedThumbColor = zidRunOnDarkColors().onPrimary,
                checkedTrackColor = zidRunOnDarkColors().primary,
                checkedBorderColor = zidRunOnDarkColors().primary,
                uncheckedThumbColor = zidRunOnDarkColors().textMuted,
                uncheckedTrackColor = zidRunOnDarkColors().surfaceMuted,
                uncheckedBorderColor = zidRunOnDarkColors().borderStrong,
            ),
        )
    }
}

/** Shown under a locked type picker: structured workouts need a subscription. */
@Composable
private fun SubscribeToCustomizeNotice() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().primary.copy(alpha = 0.12f))
            .padding(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Icon(Icons.Filled.Lock, contentDescription = null, tint = zidRunOnDarkColors().primary, modifier = Modifier.size(18.dp))
        Text(
            text = stringResource(R.string.runs_type_subscribe),
            style = MaterialTheme.typography.bodyMedium,
            color = zidRunOnDarkColors().textStrong,
        )
    }
}

/** The +/- controls for a chosen workout type's tunables (reps, distance, recovery…). */
@Composable
private fun WorkoutParamControls(type: String, values: Map<String, Int>, onChange: (String, Int) -> Unit) {
    val specs = WORKOUT_TYPE_PARAMS[type] ?: return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        specs.forEach { spec ->
            val value = values[spec.key] ?: spec.default
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(paramLabel(spec.key)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = zidRunOnDarkColors().text,
                    modifier = Modifier.weight(1f),
                )
                val label = stringResource(paramLabel(spec.key))
                val valueText = paramValueText(spec.key, value)
                StepperButton(
                    symbol = "−",
                    enabled = value > spec.min,
                    contentDescription = stringResource(R.string.runs_param_decrease, label, valueText),
                ) { onChange(spec.key, -1) }
                Text(
                    text = valueText,
                    style = MaterialTheme.typography.titleSmall,
                    color = zidRunOnDarkColors().textStrong,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.widthIn(min = 64.dp).padding(horizontal = ZidRunDimens.spaceXs),
                )
                StepperButton(
                    symbol = "+",
                    enabled = value < spec.max,
                    contentDescription = stringResource(R.string.runs_param_increase, label, valueText),
                ) { onChange(spec.key, +1) }
            }
        }
    }
}

@Composable
private fun StepperButton(symbol: String, enabled: Boolean, contentDescription: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            // Theme-aware palette (this branch) plus the stepper's accessible name (ALL-R08 round):
            // a bare "+"/"−" is meaningless to a screen reader without it.
            .background(zidRunOnDarkColors().primary.copy(alpha = if (enabled) 0.16f else 0.05f))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = symbol,
            style = MaterialTheme.typography.titleMedium,
            color = if (enabled) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
        )
    }
}

/** The label for a workout tunable. */
private fun paramLabel(key: String): Int = when (key) {
    "reps" -> R.string.runs_param_reps
    "repMeters", "distanceKm" -> R.string.runs_param_distance
    "easyMinutes" -> R.string.runs_param_easy
    "workMinutes" -> R.string.runs_param_work
    "recoverySeconds" -> R.string.runs_param_recovery
    else -> R.string.runs_param_reps
}

/** A tunable's value with its unit — "6", "400 m", "12 km", "20 min", "90 sec". */
@Composable
private fun paramValueText(key: String, value: Int): String {
    val n = ZidRunFormat.count(value, currentLocale())
    return when (key) {
        "repMeters" -> stringResource(R.string.runs_step_metres, n)
        "distanceKm" -> stringResource(R.string.runs_param_km_value, n)
        "easyMinutes", "workMinutes" -> stringResource(R.string.runs_step_minutes, n)
        "recoverySeconds" -> stringResource(R.string.runs_step_seconds, n)
        else -> n
    }
}

/** How many steps the pre-run card lists before summarising the rest. */
private const val GUIDED_STEP_PREVIEW = 4

/** What a guided/structured session will ask for, so the runner knows before they commit to it. */
@Composable
private fun GuidedPlanCard(dto: dz.racedz.nativeapp.core.network.GuidedSessionDto?, loading: Boolean, title: String) {
    val steps = dto?.steps.orEmpty()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = zidRunOnDarkColors().textStrong,
        )
        when {
            loading -> Text(
                stringResource(R.string.common_loading),
                style = MaterialTheme.typography.bodySmall,
                color = zidRunOnDarkColors().textMuted,
            )
            steps.isEmpty() -> Text(
                stringResource(R.string.runs_guided_unavailable),
                style = MaterialTheme.typography.bodySmall,
                color = zidRunOnDarkColors().textMuted,
            )
            else -> {
                steps.take(GUIDED_STEP_PREVIEW).forEach { step ->
                    Text(
                        text = "${stepRoleLabel(step.role)} · ${stepTargetLabel(step)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = zidRunOnDarkColors().textMuted,
                    )
                }
                // An interval session runs to a dozen-odd steps. Cutting the list at four without
                // saying so told the runner "warm up, work, recover, work" and left them to guess
                // whether that was the whole session — the opposite of what this card is for.
                val hidden = steps.size - GUIDED_STEP_PREVIEW
                if (hidden > 0) {
                    Text(
                        text = pluralStringResource(R.plurals.runs_guided_more_steps, hidden, hidden.toString()),
                        style = MaterialTheme.typography.bodySmall,
                        color = zidRunOnDarkColors().textMuted,
                    )
                }
            }
        }
    }
}

@Composable
private fun ReadyChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: androidx.compose.ui.graphics.Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
        modifier = Modifier.semantics(mergeDescendants = true) { },
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = tint)
    }
}

/**
 * The hold target. Sweeps a ring while held and fires at the end; letting go early winds it back.
 *
 * Two things here are deliberate and easy to "fix" wrongly.
 *
 * **The hold is timed from frames, not from an animation.** Compose animations honour the system's
 * `MotionDurationScale`, so on a device with animations turned off `animateTo` finishes instantly —
 * and a press-and-hold that completes on contact is not a press-and-hold. `withFrameMillis` gives
 * the same per-frame smoothness while keeping the duration real. Reduced motion removes the
 * decoration (the idle breath, the wind-back) and leaves the interaction intact.
 *
 * **The label sits in its own clear space.** The exported artwork is a narrow foot, and text laid
 * across the whole 240dp control ran straight through the stroke — "Hold" over the foot, "to begin"
 * overflowing both edges. It is width-limited to the ring's inner circle and backed by a scrim, so
 * it reads at any font scale without needing the artwork redrawn.
 */
@Composable
private fun HoldToBegin(onTriggered: () -> Unit, enabled: Boolean = true) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    var holding by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    // Latched the instant the hold reaches 100% (RED-R03). From that moment the start is owed:
    // the completion work runs in its own effect keyed on this flag, so releasing the finger —
    // which is the natural reaction to the confirming haptic — can no longer cancel the
    // coroutine that was about to call onTriggered().
    var completed by remember { mutableStateOf(false) }
    // 0 → 1 once the hold completes: one expanding, fading ring. Reduced motion skips it.
    var aura by remember { mutableFloatStateOf(0f) }

    // Respect Android's animation scale for the decorative parts only.
    val animationsEnabled = remember(context) {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }

    // A slow breath while idle, so the control reads as waiting for you rather than as a picture.
    // Driven from frames like the hold itself, for the same reason: it must not be at the mercy of
    // the animation-duration scale, and it costs nothing to keep the two on one clock.
    var idleScale by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(holding, animationsEnabled) {
        if (holding || !animationsEnabled) {
            idleScale = 1f
            return@LaunchedEffect
        }
        val start = withFrameMillis { it }
        while (true) {
            withFrameMillis { now ->
                val phase = ((now - start) % BREATH_MS) / BREATH_MS.toFloat()
                idleScale = 1f + BREATH_DEPTH * sin(phase * 2f * PI.toFloat())
            }
        }
    }

    // Pressing sinks the control slightly and it grows back as the hold completes — the shape of
    // the gesture, rather than a second independent effect.
    val holdScale by animateFloatAsState(
        targetValue = if (holding) 0.97f + progress * 0.05f else 1f,
        animationSpec = tween(durationMillis = 120, easing = LinearEasing),
        label = "holdScale",
    )
    val appliedScale = if (!animationsEnabled) 1f else if (holding) holdScale else idleScale

    val holdLabel = stringResource(R.string.runs_hold_to_begin)
    val startLabel = stringResource(R.string.runs_start_run)

    LaunchedEffect(holding) {
        // Once completed, the start is owed regardless of the finger: no wind-back, no restart.
        if (completed) return@LaunchedEffect

        if (!holding) {
            // Wind back rather than snap: an aborted hold should look like it was let go, not like
            // it never happened. Any partial decoration is cleared with it.
            aura = 0f
            if (!animationsEnabled || progress == 0f) {
                progress = 0f
                return@LaunchedEffect
            }
            val from = progress
            val start = withFrameMillis { it }
            while (progress > 0f) {
                withFrameMillis { now ->
                    val t = (now - start).toFloat() / RELEASE_MS
                    progress = (from * (1f - t)).coerceAtLeast(0f)
                }
            }
            return@LaunchedEffect
        }

        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)

        if (!animationsEnabled) {
            // Reduced motion (R-13): keep the real 700 ms hold as the accidental-start guard, but do
            // not sweep the wedge continuously. Show discrete progress states only — a single midway
            // step, then complete — so the reveal jumps rather than animates.
            progress = 0.5f
            delay(HOLD_TO_BEGIN_MS / 2)
            progress = 1f
            delay(HOLD_TO_BEGIN_MS / 2)
            completed = true
            return@LaunchedEffect
        }

        val start = withFrameMillis { it }
        while (progress < 1f) {
            withFrameMillis { now ->
                progress = ((now - start).toFloat() / HOLD_TO_BEGIN_MS).coerceAtMost(1f)
            }
        }
        completed = true
    }

    // Completion work, uncancellable by the gesture: the confirming haptic, one success pulse
    // (or a short beat under reduced motion) so the completed ring is actually seen, then start.
    LaunchedEffect(completed) {
        if (!completed) return@LaunchedEffect
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        if (animationsEnabled) {
            val auraStart = withFrameMillis { it }
            while (aura < 1f) {
                withFrameMillis { now ->
                    aura = ((now - auraStart).toFloat() / AURA_MS).coerceAtMost(1f)
                }
            }
        } else {
            delay(110L)
        }
        onTriggered()
    }

    // The active footprint orbit, drawn through an angular clip so it fills clockwise from the top
    // as the hold progresses — footprint by footprint from outline to solid lime, which is the
    // progress signal the reference is built around (and it survives reduced motion and colour
    // blindness, because the change is shape+fill, not only colour).
    val activeOrbit = ImageBitmap.imageResource(RunsR.drawable.zidrun_hold_orbit_active)

    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            // Square, always — and capped rather than fixed.
            //
            // `size(CONTROL_SIZE)` looked equivalent but was not: on any screen narrower than
            // 344dp + the page's own padding (a 360dp-wide phone, for instance) the incoming width
            // constraint won and the box came out taller than it was wide. The two orbit layers
            // then disagreed about what "full size" meant — the resting orbit is an `Image` with
            // `ContentScale.Fit`, so it stayed a centred circle, while the active orbit is drawn
            // straight into the Canvas at `size`, so it stretched into an ellipse and rode up.
            // The result was two rings of different radii, with the green footprints sitting off
            // the grey ones. Filling the available width and forcing 1:1 keeps every layer on the
            // same circle at any screen size.
            .widthIn(max = CONTROL_SIZE)
            .fillMaxWidth()
            .aspectRatio(1f)
            .graphicsLayer { scaleX = appliedScale; scaleY = appliedScale }
            // Dimmed and inert while a chosen workout structure is still loading.
            .alpha(if (enabled) 1f else 0.5f)
            .clip(CircleShape)
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                detectTapGestures(
                    onPress = {
                        holding = true
                        // Returns when the finger lifts or the gesture is cancelled, which is what
                        // makes "let go to abort" work.
                        tryAwaitRelease()
                        holding = false
                    },
                )
            }
            // Holding is not a gesture TalkBack can perform, so it gets a plain activate action.
            .semantics {
                contentDescription = startLabel
                role = Role.Button
                if (enabled) onClick(label = startLabel) { onTriggered(); true }
            },
    ) {
        // Layer order matches the reference build: orange backlight, the muted orbit, the clockwise
        // active orbit, the sole edge glow, the sole itself, then the label. The artwork is the
        // extracted/recoloured ZidRun run layers (drawable-nodpi/zidrun_hold_*), so the foot
        // silhouette, contour lines and footprint rhythm stay exactly as designed.

        // Every inner layer is sized as a share of the control rather than in absolute dp, so a
        // control that had to shrink to fit a narrow screen shrinks the sole and its glow with it.
        // Fixed dp here would let the sole creep out toward the footprint ring on small phones and
        // swallow the breathing room the two elements need to read as separate things.
        val layerScale = maxWidth / CONTROL_SIZE

        // 1. Amber backlight — FOOT-SHAPED, not a disc: the asset is the blurred sole silhouette, so
        //    the warm glow radiates from the shoe exactly as in the reference. Sized a little larger
        //    than the sole; brightens with the hold, with a gentle breath when animations are on.
        val glowScale = if (animationsEnabled) 0.97f + progress * 0.06f else 1f
        Image(
            painter = painterResource(RunsR.drawable.zidrun_hold_orange_glow),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .height((SOLE_HEIGHT + 92.dp) * layerScale)
                .width((SOLE_WIDTH + 130.dp) * layerScale)
                .align(Alignment.Center)
                .graphicsLayer {
                    alpha = 0.20f + progress * 0.42f
                    scaleX = glowScale
                    scaleY = glowScale
                },
        )

        // 2. The resting orbit: every footprint muted and unfilled.
        Image(
            painter = painterResource(RunsR.drawable.zidrun_hold_orbit_inactive),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize(),
        )

        // 3. The active orbit, revealed clockwise from the top through a growing pie wedge. No
        //    separate progress arc — the footprints themselves are the meter.
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (progress <= 0f) return@Canvas
            val wedge = Path().apply {
                moveTo(center.x, center.y)
                arcTo(
                    rect = Rect(Offset.Zero, size),
                    startAngleDegrees = -90f,
                    sweepAngleDegrees = 360f * progress,
                    forceMoveTo = false,
                )
                close()
            }
            clipPath(wedge) {
                drawImage(
                    image = activeOrbit,
                    dstOffset = IntOffset.Zero,
                    dstSize = IntSize(size.width.roundToInt(), size.height.roundToInt()),
                )
            }
        }

        // 4. The BOLD lime edge — already a heavy neon outline at rest (the reference shows it lit),
        //    brightening to full by completion. Sized a touch larger than the sole so the rim sits
        //    just outside its silhouette.
        Image(
            painter = painterResource(RunsR.drawable.zidrun_hold_sole_edge_glow),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .height((SOLE_HEIGHT + 8.dp) * layerScale)
                .width((SOLE_WIDTH + 8.dp) * layerScale)
                .align(Alignment.Center)
                .alpha(0.6f + progress * 0.4f),
        )

        // 5. The sole itself: dark navy, internal contour lines, and a lime (not yellow) rim, never
        //    washed out by the glow.
        Image(
            painter = painterResource(RunsR.drawable.zidrun_hold_sole_base),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .height(SOLE_HEIGHT * layerScale)
                .width(SOLE_WIDTH * layerScale)
                .align(Alignment.Center),
        )

        // Completion pulse: one lime edge flash hugging the sole, expanding and fading a single
        // time (never a loop). Reduced motion leaves `aura` at 0, so this never runs there.
        if (aura > 0f) {
            val pulseScale = 1f + aura * 0.12f
            Image(
                painter = painterResource(RunsR.drawable.zidrun_hold_sole_edge_glow),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .height((SOLE_HEIGHT + 12.dp) * layerScale)
                    .width((SOLE_WIDTH + 12.dp) * layerScale)
                    .align(Alignment.Center)
                    .graphicsLayer {
                        alpha = (1f - aura) * 0.9f
                        scaleX = pulseScale
                        scaleY = pulseScale
                    },
            )
        }

        // The label's own clear space: a scrim wide enough for the longest translation ("Maintenez
        // / pour commencer") and no wider than the ring's inner circle.
        Box(
            modifier = Modifier
                .widthIn(max = 136.dp)
                .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
                // Opaque enough to hold up against the glow at full brightness, which is exactly
                // when the label matters most — a 60% scrim washed out at the end of the hold.
                .background(zidRunOnDarkColors().background.copy(alpha = 0.88f))
                .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = stringResource(R.string.runs_hold),
                    style = MaterialTheme.typography.titleLarge,
                    color = zidRunOnDarkColors().primary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = holdLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    color = zidRunOnDarkColors().text,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** The hold control's overall diameter — dominant on screen, as in the reference. */
private val CONTROL_SIZE = 344.dp

/**
 * The sole silhouette inside the control. Kept well inside the orbit so the footprint ring reads as
 * a separate element with clear breathing room, not a frame the sole touches. Ratio ≈1:2, matching
 * the exported foot art.
 */
private val SOLE_HEIGHT = 208.dp
private val SOLE_WIDTH = 104.dp

/** How long an aborted hold takes to wind back to nothing. */
private const val RELEASE_MS = 220f

/** One success pulse on completion — a single flash, never a loop (UI_RULES §7). */
private const val AURA_MS = 300f

/** One full idle breath, and how far it travels. Slow and shallow enough to read as waiting. */
private const val BREATH_MS = 3_400L
private const val BREATH_DEPTH = 0.015f
