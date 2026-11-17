package dz.racedz.nativeapp.feature.runs.record

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material.icons.filled.Timer
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.layout.widthIn
import kotlin.math.roundToInt

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
    // Bumped whenever a location request returns, so the warm-up re-reads the grant at once.
    var permissionRefresh by remember { mutableStateOf(0) }

    // Live conditions for where the run will happen. Read once on entry from the last known fix when
    // location is already granted; with no fix the server falls back to the runner's wilaya. A
    // nicety — never gated on permission and never blocking the run.
    // True once the town/weather come from a real position rather than the profile's wilaya.
    var placeFromFix by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        val fix = lastKnownLocation(context)
        viewModel.loadWeather(fix?.latitude, fix?.longitude)
        if (fix != null) {
            placeFromFix = true
            viewModel.setPlaceName(cityName(context, fix.latitude, fix.longitude))
        }
    }
    // Get the receiver searching now, not at start (see rememberGpsWarmup).
    val gpsWarmup = rememberGpsWarmup(permissionRefresh)
    // With no recent cached fix the weather above came from the profile's wilaya, and the card named
    // that wilaya as if it were where the runner stood ("Alger" for a runner in Blida, 2026-11-15).
    // As soon as the warm-up has a position, re-place the card on it — once.
    LaunchedEffect(gpsWarmup.placeable, placeFromFix) {
        val lat = gpsWarmup.latitude
        val lng = gpsWarmup.longitude
        if (placeFromFix || !gpsWarmup.placeable || lat == null || lng == null) return@LaunchedEffect
        placeFromFix = true
        viewModel.loadWeather(lat, lng)
        viewModel.setPlaceName(cityName(context, lat, lng))
    }
    // Arriving from the coach's "Log this run" means the runner already chose a planned session, so
    // Guided is the mode they asked for (DEV-R06). Starting in Free associated the workout but ran
    // no cues or steps unless they noticed the tabs and switched — the guidance simply never came.
    // Free remains one tap away as the "record without guidance" escape hatch.
    var mode by rememberSaveable {
        mutableStateOf(if (workoutId != null) RunMode.Guided else RunMode.Free)
    }
    var audioCues by rememberSaveable { mutableStateOf(true) }
    // The start that is waiting behind the countdown; null when no countdown is showing.
    var pendingStart by remember { mutableStateOf<(() -> Unit)?>(null) }

    // Location is asked for on its own, from "Enable GPS" (or from the hold, for a runner who starts
    // straight away), so the warm-up can begin the moment it is granted — before the first run, not
    // inside it. It used to ride in one request with the optional permissions, at hold-to-begin.
    val locationPermissions = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    // Optional, asked at the start: notifications (the recording notification is how a runner sees
    // GPS is on) and cadence (the run/ride check). Declining either still records.
    val optionalPermissions = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(Manifest.permission.ACTIVITY_RECOGNITION)
    }

    fun startNow() {
        // Guided mode runs the plan; Free mode runs the chosen workout type's structure (or
        // nothing, for a plain free run).
        val guidingSession = if (mode == RunMode.Guided) session.session else session.freeStructure
        // Only attach the planned workout when the runner is actually running it (Guided). If they
        // switched to Free/custom, the run must NOT complete the planned session (adherence bug).
        val effectiveWorkoutId = workoutId.takeIf { mode == RunMode.Guided }
        val begin = { beginRecording(context, audioCues, guidingSession, effectiveWorkoutId, onStarted) }
        // Optional 3-2-1 (NATRUN-06.7): only after the hold and the grant, and nothing — no
        // recorder, service, cue or clock — starts until it reaches zero.
        if (RunSettings.countdownEnabled) pendingStart = begin else begin()
    }

    // Whatever the runner answers, the run starts: these only add to it.
    val optionalLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { startNow() }
    fun requestOptionalThenStart() {
        val missing = optionalPermissions.filter { ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) startNow() else optionalLauncher.launch(missing.toTypedArray())
    }

    // Whether the location answer should go on to start the run (asked from the hold) or only
    // start the warm-up (asked from "Enable GPS").
    var startAfterLocation by remember { mutableStateOf(false) }
    var locationDenials by rememberSaveable { mutableStateOf(0) }
    val locationLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        permissionRefresh++
        // Coarse-only is not enough to measure a route, so precise is the one that decides.
        val precise = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val thenStart = startAfterLocation
        startAfterLocation = false
        if (precise) {
            permissionDenied = false
            if (thenStart) requestOptionalThenStart()
        } else {
            permissionDenied = true
            locationDenials++
        }
    }
    fun onHoldComplete() {
        if (gpsWarmup.permitted) {
            requestOptionalThenStart()
        } else {
            startAfterLocation = true
            locationLauncher.launch(locationPermissions)
        }
    }
    val openAppSettings = {
        runCatching {
            context.startActivity(
                android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(android.net.Uri.fromParts("package", context.packageName, null))
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
        Unit
    }

    pendingStart?.let { start ->
        CountdownOverlay(
            audioCues = audioCues,
            onFinished = {
                pendingStart = null
                start()
            },
            onCancelled = { pendingStart = null },
        )
        return
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

            // GPS status and the one thing to do about it. Every part keeps its height whatever
            // happens — permission granted, signal found, signal lost — so the controls below never
            // move under a finger (a late shift here once turned a tap into the wrong sport chip).
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg)) {
                    // Says what the warm-up actually sees, never "GPS ready" before permission (it
                    // used to, on a phone that then needed three minutes to find a usable fix).
                    GpsSignalChip(gpsWarmup, modifier = Modifier.weight(1f, fill = false))
                    ReadyChip(
                        icon = Icons.Filled.Lock,
                        label = stringResource(R.string.runs_private),
                        tint = zidRunOnDarkColors().textMuted,
                    )
                }
                GpsActionSlot(
                    warmup = gpsWarmup,
                    deniedOnce = locationDenials >= 2,
                    onEnable = {
                        startAfterLocation = false
                        locationLauncher.launch(locationPermissions)
                    },
                    onOpenSettings = openAppSettings,
                )
            }

            // Conditions where the run will happen. The slot is there from the first frame, with
            // dashes until the reading arrives (or if it never does), so it never pushes the
            // controls below down after the runner has started reaching for them.
            WeatherCard(
                weather = session.weather?.takeIf { it.temperatureC != null || it.humidityPct != null || it.windSpeedKmh != null },
                // The device's own reverse-geocoded town when there is a GPS fix, otherwise the
                // wilaya the server used.
                placeName = session.placeName ?: session.weather?.place,
            )

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

            // Activity kind (NATRUN-07.1): Run · Walk · Trail · Ride, last choice remembered. A ride
            // is never flagged non-foot and never counts as a run.
            SportPicker()

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

            // Optional countdown before the start (NATRUN-06.7), off by default; persisted.
            CountdownRow()

            // BLE heart-rate sensor (NATRUN-07.3): pair once here; the service connects per run.
            dz.racedz.nativeapp.feature.runs.record.hr.HeartRateSensorRow()

            // Hold waits while a chosen workout structure is still loading, so a run can never start
            // on an older structure than the one shown (or on no structure when one was picked).
            val awaitingStructure = mode == RunMode.Free &&
                (session.selectedType?.takeIf { it != FREE_RUN_TYPE } != null) &&
                (session.structureLoading || session.freeStructure == null)
            HoldToStartControl(
                enabled = !awaitingStructure,
                onTriggered = { onHoldComplete() },
            )

            // Notifications off means a crash mid-run goes unannounced (RunInterruptionNotice). Said
            // before the start, below the control, so it never moves what the runner reaches for.
            NotificationsOffNotice()

            // A search that drags on gets the few things a runner can actually do about it — below
            // the start control, so appearing 20 s in never moves what the runner is about to touch.
            if (gpsWarmup.showTips) GpsTipsCard()

            if (permissionDenied) {
                Text(
                    text = stringResource(R.string.runs_permission_denied),
                    style = MaterialTheme.typography.bodyMedium,
                    color = zidRunOnDarkColors().danger,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = ZidRunDimens.spaceLg),
                )
                ZidRunButton(
                    text = stringResource(if (locationDenials >= 2) R.string.runs_gps_open_settings else R.string.runs_grant_permission),
                    onClick = {
                        if (locationDenials >= 2) {
                            openAppSettings()
                        } else {
                            startAfterLocation = true
                            locationLauncher.launch(locationPermissions)
                        }
                    },
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
    if (!RunRecorder.start(workoutId ?: session?.workoutId, sport = RunSettings.lastSport)) {
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
/**
 * Live conditions, in a card whose height never changes: the place line, the three readings and
 * the "Regional estimate" line are always laid out, with dashes or blank text standing in until
 * (or unless) there is something to show. It loads, and is re-placed on the GPS fix, while the
 * runner is already scrolling and choosing — every height change here moved the controls below.
 */
@Composable
private fun WeatherCard(weather: WeatherDto?, placeName: String?) {
    val locale = currentLocale()
    val dash = "—"
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ZidRunDimens.cornerLg))
            .background(zidRunOnDarkColors().surface)
            .padding(ZidRunDimens.spaceMd),
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
    ) {
      // The city/town, above the temperature, so the reading is anchored to a place.
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs)) {
          Icon(
              Icons.Filled.LocationOn,
              contentDescription = null,
              tint = zidRunOnDarkColors().textMuted,
              modifier = Modifier.size(14.dp),
          )
          Text(
              text = placeName ?: dash,
              style = MaterialTheme.typography.labelLarge,
              color = zidRunOnDarkColors().textStrong,
              maxLines = 1,
              overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
          )
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        WeatherStat(
            value = weather?.temperatureC?.let { stringResource(R.string.runs_weather_temp, ZidRunFormat.count(it.roundToInt(), locale)) } ?: dash,
            label = weather?.apparentC?.let { feels ->
                stringResource(R.string.runs_weather_feels, ZidRunFormat.count(feels.roundToInt(), locale))
            } ?: weather?.weatherLabel?.replaceFirstChar { it.uppercase() } ?: " ",
        )
        WeatherStat(
            value = weather?.humidityPct?.let { stringResource(R.string.runs_weather_humidity_value, ZidRunFormat.count(it, locale)) } ?: dash,
            label = stringResource(R.string.runs_weather_humidity),
        )
        WeatherStat(
            value = weather?.windSpeedKmh?.let { stringResource(R.string.runs_weather_wind_value, ZidRunFormat.count(it, locale)) } ?: dash,
            label = stringResource(R.string.runs_weather_wind),
            // Meteorological direction is where the wind comes FROM; the arrow points where it blows TO.
            arrowDegrees = weather?.windDirectionDegrees?.let { it.toFloat() + 180f },
        )
      }
      // When the reading is only the wilaya centroid (no GPS fix), say so — on a large wilaya these
      // conditions can be far from the runner, and it should not read as street-level local weather.
      // The line is always laid out (blank otherwise): re-placing on the GPS fix drops it.
      Text(
          text = if (weather?.source == "wilaya") stringResource(R.string.runs_weather_region) else " ",
          style = MaterialTheme.typography.labelSmall,
          color = zidRunOnDarkColors().textMuted,
      )
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
                // "0.5 km" / "1 mi": the interval is a multiple of the account's unit.
                val unitLabel = dz.racedz.nativeapp.core.design.distanceUnitLabel()
                val label = if (interval.units == 0.0) {
                    stringResource(R.string.runs_cue_interval_off)
                } else {
                    (if (interval.units % 1.0 == 0.0) ZidRunFormat.count(interval.units.toInt(), locale)
                    else ZidRunFormat.decimal(interval.units, locale, digits = 1)) + "\u00A0" + unitLabel
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

/** Run · Walk · Trail · Ride, in the same pill row as the workout types; persisted last choice. */
@Composable
private fun SportPicker() {
    var selected by remember { mutableStateOf(RunSettings.lastSport) }
    Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm)) {
        Text(
            text = stringResource(R.string.runs_sport),
            style = MaterialTheme.typography.titleSmall,
            color = zidRunOnDarkColors().textMuted,
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            dz.racedz.nativeapp.core.design.RunSport.entries.forEach { sport ->
                val isSelected = sport.code == selected
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(ZidRunDimens.cornerPill))
                        .background(if (isSelected) zidRunOnDarkColors().primary else zidRunOnDarkColors().surface)
                        .selectable(selected = isSelected, role = Role.RadioButton) {
                            selected = sport.code
                            RunSettings.lastSport = sport.code
                        }
                        .padding(horizontal = ZidRunDimens.spaceMd, vertical = ZidRunDimens.spaceSm),
                ) {
                    Icon(
                        sport.icon,
                        contentDescription = null,
                        tint = if (isSelected) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textMuted,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(ZidRunDimens.spaceXs))
                    Text(
                        text = stringResource(sport.labelRes),
                        style = MaterialTheme.typography.labelLarge,
                        color = if (isSelected) zidRunOnDarkColors().onPrimary else zidRunOnDarkColors().textStrong,
                    )
                }
            }
        }
    }
}

/** The countdown switch (off by default), same row as auto-pause. */
@Composable
private fun CountdownRow() {
    var enabled by remember { mutableStateOf(RunSettings.countdownEnabled) }
    fun set(value: Boolean) {
        enabled = value
        RunSettings.countdownEnabled = value
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
            Icons.Filled.Timer,
            contentDescription = null,
            tint = if (enabled) zidRunOnDarkColors().primary else zidRunOnDarkColors().textMuted,
        )
        Spacer(Modifier.width(ZidRunDimens.spaceMd))
        Column(Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.runs_countdown),
                style = MaterialTheme.typography.titleSmall,
                color = zidRunOnDarkColors().textStrong,
            )
            Text(
                text = stringResource(R.string.runs_countdown_help),
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
