package dz.racedz.nativeapp.feature.runs.record

import android.location.Location
import dz.racedz.nativeapp.core.network.RoutePointDto
import dz.racedz.nativeapp.core.network.downsampleKeepingSegments
import dz.racedz.nativeapp.core.network.segmentIndex
import dz.racedz.nativeapp.core.network.startsSegmentAt
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class RecordingStatus { Idle, Acquiring, Recording, Paused, Finished }

/** Why the recorder paused on its own. */
enum class AutoPauseReason {
    /** Standing still (a light, a stop). Resumes by itself on the first real movement. */
    Stationary,
    /**
     * Sustained vehicle speed. No longer raised (a recording now keeps going at any speed, as a
     * watch does — pausing a motorbike ride after two minutes and never resuming lost the ride);
     * kept so a snapshot written by an older build still restores, and resumes on movement.
     */
    Vehicle,
}

data class RecordingState(
    val status: RecordingStatus = RecordingStatus.Idle,
    /** Generated once per recording and reused on every save attempt — see [RunRecorder.clientId]. */
    val clientId: String = "",
    val startedAtEpochMs: Long = 0,
    val distanceMeters: Double = 0.0,
    val elapsedSeconds: Int = 0,
    val movingSeconds: Int = 0,
    val elevationGainM: Double = 0.0,
    val currentPaceSecondsPerKm: Int? = null,
    val gpsAccuracyM: Float? = null,
    val route: List<RoutePointDto> = emptyList(),
    /** Set while the recorder is paused on its own initiative; null when idle, recording, or paused by hand. */
    val autoPauseReason: AutoPauseReason? = null,
    /** The planned session this run is being logged for, or null for a free run. */
    val workoutId: String? = null,
    /** Steps counted while actually recording, from the device step counter. 0 with no sensor. */
    val stepCount: Long = 0,
    /**
     * Seconds the step counter says the runner was actually stepping. Measured from the sensor, not
     * from GPS, so steps taken while the GPS was unusable are timed too — see [avgCadenceSpm].
     */
    val steppingSeconds: Int = 0,
    /**
     * Coach interactions the runner started during this run, before it had a server id. Buffered so
     * they can be handed to the server at save and linked to the run they were asked on.
     */
    val askedCoachIds: List<String> = emptyList(),
    /**
     * Whether the runner chose to publish this run on the summary screen. Part of the recording
     * state rather than the screen's own memory so it rides in the outbox: a save that failed and
     * is retried after a process death must post the visibility that was chosen, not a default.
     * Off by default — a run records where someone was, and publishing is opt-in (NATRUN-06.1).
     */
    val draftIsPublic: Boolean = false,
    /**
     * Direction of travel in degrees from north, from the GPS bearing, only while moving at a speed
     * where the bearing means something (≥ [GpsQuality.AUTO_RESUME_SPEED_MPS]). Null when stopped or
     * unknown, so the live map draws a dot rather than an arrow pointing somewhere random.
     */
    val headingDegrees: Float? = null,
    /**
     * Cadence right now, over the last ~20 s of steps (NATRUN-06.6); null until enough steps exist,
     * while stopped, or on devices with no step counter. The whole-run [avgCadenceSpm] is separate.
     */
    val liveCadenceSpm: Int? = null,
    /** Latest heart rate from a connected sensor (NATRUN-07.3); null without one. Never estimated. */
    val heartRateBpm: Int? = null,
    /** Mean of the sensor samples received while recording; posted as averageHeartRate. */
    val averageHeartRate: Int? = null,
    /** Touch guard (NATRUN-07.7): the live screen ignores taps until the runner holds to unlock. */
    val touchLocked: Boolean = false,
    /** "GPS" or "BARO" (NATRUN-07.6): where elevation gain and route altitude come from this run. */
    val elevationSource: String = "GPS",
    /** RUN | WALK | TRAIL | RIDE (NATRUN-07.1); chosen before the start, stored with the run. */
    val sport: String = "RUN",
    /** Manual lap boundaries pressed so far, from the start of the run (NATRUN-06.5). */
    val laps: List<dz.racedz.nativeapp.core.network.LapMarkDto> = emptyList(),
    /**
     * This recording was continued after the OS killed the app mid-run ([RecordingRecovery]). The
     * live screen and the notification say so; the time the app was dead is not on the clock.
     */
    val resumedAfterInterruption: Boolean = false,
    /**
     * Set when this run was restored for saving after the recording stopped unexpectedly and could
     * not be continued: when the last snapshot was written, i.e. roughly when it stopped.
     */
    val interruptedAtEpochMs: Long? = null,
) {
    val distanceKm: Double get() = distanceMeters / 1000.0

    val autoPaused: Boolean get() = autoPauseReason != null

    /**
     * Average step cadence in steps per minute over the time spent stepping, or null.
     *
     * The denominator is [steppingSeconds] — time measured by the step counter itself — and only
     * falls back to GPS [movingSeconds] when there is no stepping time (a run restored from a
     * snapshot that only kept the cadence). Dividing every step by GPS moving time inflated cadence
     * whenever the GPS was unusable while the runner kept walking: the 2026-11-15 M21 walk counted
     * 1,171 steps over 331 GPS-moving seconds and reported 212 spm for a stroll.
     *
     * Null until there is enough of a run to mean something — a stray handful of steps over ten
     * seconds is noise, not a cadence — and null on devices with no step counter. The server reads
     * this to distinguish a genuine run from a ride at running pace; capped at 300 to stay inside
     * the wire contract's range.
     */
    val avgCadenceSpm: Int?
        get() {
            val seconds = if (steppingSeconds >= 60) steppingSeconds else movingSeconds
            return if (stepCount > 0 && seconds >= 60) {
                (stepCount / (seconds / 60.0)).toInt().coerceIn(0, 300)
            } else {
                null
            }
        }

    /** Average pace over moving time, which is what runners compare against. */
    val averagePaceSecondsPerKm: Int?
        get() = if (distanceMeters > 50 && movingSeconds > 0) {
            (movingSeconds / (distanceMeters / 1000.0)).toInt()
        } else {
            null
        }

    val hasUsableFix: Boolean get() = GpsQuality.isUsableFix(gpsAccuracyM)

    /** Same MET estimate the website uses, so both show one number for one run. */
    val calories: Int? get() = GpsQuality.estimateCalories(distanceKm, movingSeconds)

    /**
     * Why this recording does not look like it was covered on foot, or null.
     *
     * The same test the server applies at save time. Surfacing it live means a ride logged by
     * mistake can be stopped or discarded on the spot, instead of being saved, silently excluded
     * from every number that matters, and only explained on the run's detail screen afterwards.
     */
    val nonFootReason: GpsQuality.NonFootReason?
        get() = if (sport == "RIDE") null else GpsQuality.detectNonFootActivity(distanceKm, movingSeconds, avgCadenceSpm)

    /**
     * GPS strength, from the reported accuracy. Four buckets rather than a number, because a runner
     * glancing mid-stride needs "is it working", not "12.4 m".
     */
    val gpsStrength: GpsStrength
        get() = when {
            gpsAccuracyM == null -> GpsStrength.Unknown
            gpsAccuracyM <= 8f -> GpsStrength.Strong
            gpsAccuracyM <= 15f -> GpsStrength.Good
            gpsAccuracyM <= GpsQuality.MAX_RECORDING_ACCURACY_M.toFloat() -> GpsStrength.Weak
            // Beyond the recording ceiling nothing is being accumulated at all.
            else -> GpsStrength.None
        }

    /**
     * Completed splits — one per kilometre, or per mile for an account set to miles (NATRUN-06.8) —
     * so the runner can see the last one's pace while still running. Derived from the route's own
     * timestamps, interpolating the boundary crossing. [LiveSplit.paceSecondsPerKm] stays per km
     * whatever the split length; display converts. Nothing is measured across a pause (a route
     * segment break), and the paused time is not part of the split it falls in.
     */
    val splits: List<LiveSplit>
        get() {
            if (route.size < 2) return emptyList()
            val unitMeters = dz.racedz.nativeapp.core.design.ZidRunUnits.current.meters
            val out = mutableListOf<LiveSplit>()
            var kmStartMs = route.first().t ?: return emptyList()
            var travelled = 0.0
            var boundary = unitMeters
            var index = 1
            /** Paused time inside the split in progress, taken out of its duration. */
            var pausedMs = 0L
            for (i in 1 until route.size) {
                val a = route[i - 1]
                val b = route[i]
                if (route.startsSegmentAt(i)) {
                    val aT = a.t
                    val bT = b.t
                    if (aT != null && bT != null && bT > aT) pausedMs += bT - aT
                    continue
                }
                val segment = GpsQuality.haversineMeters(a.lat, a.lng, b.lat, b.lng)
                if (segment <= 0) continue
                val aMs = a.t ?: continue
                val bMs = b.t ?: continue
                val segmentStart = travelled
                travelled += segment
                while (travelled >= boundary) {
                    val fraction = (boundary - segmentStart) / segment
                    val crossedMs = aMs + ((bMs - aMs) * fraction).toLong()
                    val seconds = ((crossedMs - kmStartMs - pausedMs) / 1000L).toInt()
                    // Pace stays per kilometre whatever the split length.
                    if (seconds > 0) out += LiveSplit(index, (seconds * 1000.0 / unitMeters).toInt())
                    kmStartMs = crossedMs
                    pausedMs = 0L
                    boundary += unitMeters
                    index += 1
                }
            }
            return out
        }
}

enum class GpsStrength { Unknown, None, Weak, Good, Strong }

/** A completed split (km or mile, per the account's unit) during the run in progress; pace is per km. */
data class LiveSplit(val km: Int, val paceSecondsPerKm: Int)

/**
 * Accumulates a run from GPS fixes.
 *
 * A singleton with no Android dependencies beyond [Location], so the foreground service, the UI, and
 * a unit test all observe the same state. It deliberately owns no service or permission logic: the
 * service feeds it fixes and it decides what they mean.
 *
 * Every acceptance rule comes from [GpsQuality], which is a port of the website's, so a run recorded
 * on the native app and one recorded in the Capacitor app measure the same.
 */
object RunRecorder {

    private const val MAX_ROUTE_POINTS = 1500

    /**
     * How often the in-progress recording is written to disk.
     *
     * Every fix would mean ~1 write per second with a growing route, which is wasteful and wears
     * flash for no gain. Every 15s bounds the worst case to a quarter-minute of a run lost to a
     * process kill, against a run that is still in progress and can be resumed anyway.
     */
    private const val SNAPSHOT_INTERVAL_MS = 15_000L

    /** Set once at startup. Null in unit tests, which exercise the accumulation logic only. */
    private var outbox: RunOutbox? = null
    private var lastSnapshotMs = 0L

    /**
     * The account whose runs this process may record and recover (P234-R01). Set on sign-in and
     * cleared on sign-out; a snapshot belonging to anyone else is never hydrated, shown or saved.
     */
    private var ownerUserId: String? = null

    /** True when a snapshot exists that this device cannot read — recording stays blocked until
     * the runner resolves it, and the UI must say so rather than offering a dead Record button. */
    private val _outboxBlocked = MutableStateFlow(false)
    val outboxBlocked: StateFlow<Boolean> = _outboxBlocked.asStateFlow()

    /** True when the last snapshot attempt failed, so the run in progress is not durable. */
    private val _snapshotFailing = MutableStateFlow(false)
    val snapshotFailing: StateFlow<Boolean> = _snapshotFailing.asStateFlow()

    fun attachOutbox(outbox: RunOutbox) {
        this.outbox = outbox
    }

    /** The account currently allowed to record and sync, or null when signed out. */
    fun currentOwnerUserId(): String? = ownerUserId

    /** Called when the signed-in account changes. Passing null (sign-out) drops the live state. */
    fun setOwner(userId: String?) {
        if (ownerUserId == userId) return
        ownerUserId = userId
        // A recording belongs to the person who started it. Switching accounts must not carry a
        // live run — or its route — into the new session; the snapshot stays on disk for its
        // owner to resolve when they sign back in.
        if (_state.value.status != RecordingStatus.Idle) {
            val dropped = _state.value
            if (dropped.clientId.isNotEmpty()) {
                RunTelemetry.emit { sessionEnded(dropped.clientId, "SIGNED_OUT", RunTelemetry.summaryOf(dropped, autoPauseCounts())) }
            }
            route.clear()
            routeSegment = 0
            lastFix = null
            anchorFix = null
            distance.reset()
            gpsElevation.reset()
            elevationBaseM = 0.0
            recoveries = 0
            movingSecondsExact = 0.0
            _state.value = RecordingState()
        }
        refreshOutboxBlocked()
    }

    /**
     * The pending run for an account, or null. Storage is per-account, and the owner recorded
     * inside the snapshot is checked as well — a file copied or restored into the wrong slot is
     * still refused rather than shown to the wrong person.
     */
    fun pendingFor(userId: String?): PendingRun? {
        if (userId.isNullOrBlank()) return null
        val state = outbox?.read(userId) ?: return null
        return (state as? OutboxState.Present)?.run?.takeIf { it.ownerUserId == userId }
    }

    /** Moves this account's unreadable snapshot aside so recording can resume. */
    fun resolveUnreadableOutbox() {
        outbox?.quarantineUnreadable(ownerUserId)
        refreshOutboxBlocked()
    }

    private fun refreshOutboxBlocked() {
        _outboxBlocked.value = outbox?.read(ownerUserId) is OutboxState.Unreadable
    }

    /**
     * Writes the current recording to the outbox.
     *
     * [force] bypasses the interval — used on pause and finish, the two moments where losing what
     * has been recorded so far would be most obviously the app's fault.
     */
    fun snapshot(force: Boolean = false) {
        val box = outbox ?: return
        val current = _state.value
        if (current.status == RecordingStatus.Idle || current.clientId.isEmpty()) return

        val now = System.currentTimeMillis()
        if (!force && now - lastSnapshotMs < SNAPSHOT_INTERVAL_MS) return
        lastSnapshotMs = now

        // A slot the runner already asked to save holds their full request; the recorder's own
        // snapshot (defaults, no title) must not replace it (NATRUN-07.2).
        val existing = box.load(ownerUserId)
        if (existing?.saveRequested == true && existing.request.clientId == current.clientId) return

        val finished = current.status == RecordingStatus.Finished
        val written = box.save(
            PendingRun(
                request = current.toCreateRequest(),
                finished = finished,
                updatedAtEpochMs = now,
                ownerUserId = ownerUserId,
                live = if (finished) null else current.toLiveRecording(),
            )
        )
        // A failed write means the run is no longer backed by anything — the runner is told, rather
        // than discovering it only after a process kill (P234-R02).
        _snapshotFailing.value = !written
        if (!written && !snapshotFailureReported) {
            snapshotFailureReported = true
            RunTelemetry.emit { issue("recorder.snapshot_failed", context = RunTelemetry.summaryOf(current), runClientId = current.clientId) }
        }
    }

    /**
     * Writes the runner's full save request into the outbox and marks it for background retry
     * (NATRUN-07.2). Called by the summary screen when a Save fails; the worker posts this body.
     */
    fun markSaveRequested(request: dz.racedz.nativeapp.core.network.CreateRunRequest): Boolean {
        val box = outbox ?: return false
        return box.save(
            PendingRun(request = request, finished = true, updatedAtEpochMs = System.currentTimeMillis(), ownerUserId = ownerUserId, saveRequested = true)
        )
    }

    /** Server ids of runs the background worker saved while a screen may still be showing them. */
    private val _syncedRunIds = MutableStateFlow<Map<String, String>>(emptyMap())
    val syncedRunIds: StateFlow<Map<String, String>> = _syncedRunIds.asStateFlow()

    /**
     * The background worker saved [clientId] as [runId]: clear the slot the way a foreground save
     * does, drop the in-memory recording if it is that run, and tell any open summary.
     */
    fun onSyncedInBackground(clientId: String, runId: String, ownerUserId: String?) {
        // Clear the slot ONLY while it still holds the run that was uploaded. Between the worker
        // starting and finishing, the runner may have discarded that run and recorded a new one
        // into the same per-owner slot — clearing by owner alone would silently destroy the newer
        // run's only durable copy (review P1).
        val slot = outbox?.load(ownerUserId)
        if (slot?.request?.clientId == clientId) {
            if (outbox?.clear(ownerUserId) == false) outbox?.quarantineUnreadable(ownerUserId)
        }
        refreshOutboxBlocked()
        if (_state.value.clientId == clientId && _state.value.status == RecordingStatus.Finished) {
            route.clear()
            routeSegment = 0
            lastFix = null
            anchorFix = null
            distance.reset()
            gpsElevation.reset()
            elevationBaseM = 0.0
            recoveries = 0
            movingSecondsExact = 0.0
            coachInteractionIds.clear()
            _state.value = RecordingState()
        }
        _syncedRunIds.value = _syncedRunIds.value + (clientId to runId)
    }

    /**
     * The recording left behind by a previous process — finished or not (RED-R01).
     *
     * An interrupted one is continued by [recoverInterrupted] when [RecordingRecovery] allows it,
     * and otherwise salvaged like a finished one: [resumeFinished] presents what was measured for
     * an explicit save or discard. Filtering to `finished` here used to leave an interrupted run
     * invisible on disk while the Idle singleton offered Record — and the one-file outbox would
     * then overwrite it on the next recording's first snapshot.
     */
    fun restorePending(): PendingRun? = pendingFor(ownerUserId)

    private val _state = MutableStateFlow(RecordingState())
    val state: StateFlow<RecordingState> = _state.asStateFlow()

    private var lastFix: Location? = null
    /** The last fix that was counted — where the next counted stretch starts (elevation baseline). */
    private var anchorFix: Location? = null
    private val gpsElevation = GpsElevationGain()
    /**
     * Climb counted before the barometer's own total started — a run continued after a process
     * death starts a fresh barometer, whose gain is added to this. 0 for a run recorded in one go.
     */
    private var elevationBaseM = 0.0
    /** Times this recording was continued after a process death; see [RecordingRecovery]. */
    private var recoveries = 0
    /** Distance and moving time from the fix stream; see [DistanceAccumulator]. */
    private val distance = DistanceAccumulator()
    /** Moving time with its fractions kept; the state's whole seconds are derived from it. */
    private var movingSecondsExact: Double = 0.0
    /** Auto-pauses this recording, by reason — reported with the session so flapping is visible. */
    private var stationaryAutoPauses = 0
    /** Real vehicle auto-pauses — only builds before 0.8.4 raised them; kept for their snapshots. */
    private var vehicleAutoPauses = 0
    /** Stretches of sustained vehicle speed seen while recording went on (0.8.5+; never a pause). */
    private var vehicleSpeedWindows = 0
    /** One snapshot-failure report per recording, not one per tick. */
    private var snapshotFailureReported = false
    private var lastAcceptedTimeMs: Long = 0
    private var pausedAccumMs: Long = 0
    private var pauseStartedMs: Long = 0
    private var highSpeedSeconds: Double = 0.0
    /** Seconds of consecutive usable-but-stationary fixes; drives the stationary auto-pause. */
    private var stationarySeconds: Double = 0.0
    private val paceWindow = PaceWindow()
    private val cadenceWindow = CadenceWindow()
    private val heartRate = dz.racedz.nativeapp.feature.runs.record.hr.HeartRateAverager()
    /** Present only while the service reports a pressure sensor (NATRUN-07.6). */
    private var barometer: Barometer? = null
    private val route = mutableListOf<RoutePointDto>()

    /**
     * Route segment of the points being recorded now. Bumped on every resume, so the server, the
     * maps and the GPX export see each pause as a hard break and never bridge it (the server used
     * to join a manual pause with a straight line and count it as distance and moving time).
     */
    private var routeSegment = 0

    /**
     * Step-counter bookkeeping. The sensor reports steps cumulatively since boot, so a run counts
     * the delta between readings while it is recording. [lastStepCounter] is reset to -1 whenever
     * recording is not live (start, pause, resume) so steps taken while paused — or before the run —
     * never land in [recordedSteps].
     */
    private var recordedSteps: Long = 0
    private var lastStepCounter: Long = -1

    /** When [lastStepCounter] was read, for timing the stepping between readings. */
    private var lastStepAtMs: Long = -1
    private var steppingMs: Long = 0

    /** Ids of coach interactions asked during this run, in order, deduped. Sent at save to be linked. */
    private val coachInteractionIds = mutableListOf<String>()

    /**
     * The id this recording will be saved under. Generated at start and kept for the life of the
     * recording so that a save which times out can be retried without creating a second run — it is
     * the idempotency key the server dedupes on.
     */
    val clientId: String get() = _state.value.clientId

    /**
     * @param workoutId the planned session this run is being logged for, when the runner arrived
     *   from the coach's plan. It rides in the recording state so it survives the app being killed
     *   mid-run: the outbox restores the request, and the request is where the link lives.
     * @return false when a recording already exists — in memory (recording, paused, or
     *   finished-unsaved) or as an unresolved snapshot on disk — in which case nothing is touched.
     *   Starting used to clear the previous run unconditionally, which turned any stray "start"
     *   into silent route loss (NDP-R05); and an Idle singleton alone is not proof of a clean
     *   slate, because a killed process leaves its run only in the outbox (RED-R01). Replacing
     *   either requires the runner to resolve it first (save, or discard via [reset]).
     */
    fun start(workoutId: String? = null, sport: String = "RUN"): Boolean {
        if (_state.value.status != RecordingStatus.Idle) return false
        // Only a *resolvable* snapshot blocks a new run. An unreadable one also blocks — but the
        // caller learns which through [outboxBlocked], instead of Record silently doing nothing
        // and the app navigating to an empty live screen (P234-R02).
        when (outbox?.read(ownerUserId)) {
            is OutboxState.Present -> return false
            OutboxState.Unreadable -> {
                _outboxBlocked.value = true
                RunTelemetry.emit { issue("recorder.outbox_unreadable") }
                return false
            }
            else -> Unit
        }
        route.clear()
        routeSegment = 0
        lastFix = null
        anchorFix = null
        distance.reset()
        gpsElevation.reset()
        elevationBaseM = 0.0
        recoveries = 0
        movingSecondsExact = 0.0
        lastAcceptedTimeMs = 0
        pausedAccumMs = 0
        pauseStartedMs = 0
        highSpeedSeconds = 0.0
        stationarySeconds = 0.0
        paceWindow.clear()
        cadenceWindow.clear()
        barometer?.reset()
        heartRate.reset()
        recordedSteps = 0
        lastStepCounter = -1
        lastStepAtMs = -1
        steppingMs = 0
        coachInteractionIds.clear()
        _state.value = RecordingState(
            status = RecordingStatus.Acquiring,
            clientId = UUID.randomUUID().toString(),
            startedAtEpochMs = System.currentTimeMillis(),
            workoutId = workoutId,
            sport = sport,
            elevationSource = if (barometer != null) "BARO" else "GPS",
        )
        stationaryAutoPauses = 0
        vehicleAutoPauses = 0
        vehicleSpeedWindows = 0
        snapshotFailureReported = false
        val started = _state.value
        RunTelemetry.emit {
            breadcrumb("recorder.start sport=$sport")
            sessionStarted(started.clientId, sport, started.startedAtEpochMs)
        }
        return true
    }

    fun pause() {
        if (_state.value.status != RecordingStatus.Recording && _state.value.status != RecordingStatus.Acquiring) return
        pauseStartedMs = System.currentTimeMillis()
        _state.update { it.copy(status = RecordingStatus.Paused, autoPauseReason = null, currentPaceSecondsPerKm = null, headingDegrees = null, liveCadenceSpm = null) }
        snapshot(force = true)
    }

    private fun autoPause(reason: AutoPauseReason) {
        if (reason == AutoPauseReason.Vehicle) vehicleAutoPauses++ else stationaryAutoPauses++
        RunTelemetry.emit { breadcrumb("recorder.autopause ${reason.name}") }
        pauseStartedMs = System.currentTimeMillis()
        stationarySeconds = 0.0
        _state.update { it.copy(status = RecordingStatus.Paused, autoPauseReason = reason, currentPaceSecondsPerKm = null, headingDegrees = null, liveCadenceSpm = null) }
        snapshot(force = true)
    }

    fun resume() {
        if (_state.value.status != RecordingStatus.Paused) return
        if (pauseStartedMs > 0) pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
        pauseStartedMs = 0
        // Everything recorded from here is a new route segment — a hard break nothing measures or
        // draws across (RouteSegments.kt).
        routeSegment += 1
        // A fix from before the pause would otherwise be treated as the previous point and turn the
        // whole break into one enormous segment.
        lastFix = null
        anchorFix = null
        distance.reset()
        // New smoothing window, same total: nothing measured across the pause, nothing lost.
        gpsElevation.restartWindow()
        highSpeedSeconds = 0.0
        stationarySeconds = 0.0
        paceWindow.clear()
        cadenceWindow.clear()
        // Re-baseline the step counter so steps taken during the pause are not counted on resume.
        lastStepCounter = -1
        lastStepAtMs = -1
        _state.update { it.copy(status = RecordingStatus.Recording, autoPauseReason = null) }
    }

    fun finish() {
        if (pauseStartedMs > 0) {
            pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
            pauseStartedMs = 0
        }
        _state.update { it.copy(status = RecordingStatus.Finished, elapsedSeconds = elapsedSeconds(), touchLocked = false) }
        // The run is over and everything it measured is now at risk until the server has it.
        snapshot(force = true)
        val finished = _state.value
        RunTelemetry.emit { sessionEnded(finished.clientId, "FINISHED", RunTelemetry.summaryOf(finished, autoPauseCounts())) }
    }

    /**
     * The runner chose to throw this recording away (live screen or summary). Reported before the
     * state is cleared, so the server can tell a discarded run from a lost one.
     */
    fun discard() {
        val current = _state.value
        if (current.clientId.isNotEmpty()) {
            RunTelemetry.emit { sessionEnded(current.clientId, "DISCARDED", RunTelemetry.summaryOf(current, autoPauseCounts())) }
        }
        reset()
    }

    private fun autoPauseCounts(): Map<String, Any?> = mapOf(
        "stationaryAutoPauses" to stationaryAutoPauses,
        "vehicleAutoPauses" to vehicleAutoPauses,
        "vehicleSpeedWindows" to vehicleSpeedWindows,
    )

    /**
     * Clears the recording and the outbox.
     *
     * Only after the server confirmed the save, or when the runner explicitly discarded. A failed
     * request must never reach here — the outbox exists precisely so the run survives it.
     */
    fun reset() {
        route.clear()
        routeSegment = 0
        lastFix = null
        anchorFix = null
        distance.reset()
        gpsElevation.reset()
        elevationBaseM = 0.0
        recoveries = 0
        movingSecondsExact = 0.0
        lastSnapshotMs = 0L
        stationarySeconds = 0.0
        paceWindow.clear()
        cadenceWindow.clear()
        recordedSteps = 0
        lastStepCounter = -1
        lastStepAtMs = -1
        steppingMs = 0
        coachInteractionIds.clear()
        _snapshotFailing.value = false
        // A delete that fails would otherwise leave the file blocking every future recording with
        // no way out; quarantining it keeps the bytes for support while unblocking the runner.
        if (outbox?.clear(ownerUserId) == false) outbox?.quarantineUnreadable(ownerUserId)
        refreshOutboxBlocked()
        _state.value = RecordingState()
    }

    /** Outcome of a Lap press. */
    enum class LapResult { Marked, TooSoon, NotRecording }

    /**
     * Marks a lap at the current distance and elapsed time.
     *
     * Only while recording (a lap while paused would be zero-length by definition), and only when
     * it is far enough from the previous mark to be a lap and not a double tap. Durable at once:
     * the mark rides in the recording state and therefore in the outbox and the create request.
     */
    fun markLap(): LapResult {
        val current = _state.value
        if (current.status != RecordingStatus.Recording) return LapResult.NotRecording
        val atMeters = current.distanceMeters
        val atSeconds = elapsedSeconds()
        if (!LapMath.accepts(current.laps.lastOrNull(), atMeters, atSeconds, current.laps.size)) return LapResult.TooSoon
        _state.update {
            it.copy(laps = it.laps + dz.racedz.nativeapp.core.network.LapMarkDto(atMeters = atMeters, atSeconds = atSeconds))
        }
        snapshot(force = true)
        return LapResult.Marked
    }

    /**
     * Records the visibility chosen on the summary screen and makes it durable at once — the
     * choice must survive the same process death the run itself survives.
     */
    fun setDraftVisibility(isPublic: Boolean) {
        if (_state.value.draftIsPublic == isPublic) return
        _state.update { it.copy(draftIsPublic = isPublic) }
        snapshot(force = true)
    }

    private fun RecordingState.toLiveRecording() = LiveRecording(
        paused = status == RecordingStatus.Paused,
        autoPauseReason = autoPauseReason?.name,
        elapsedSeconds = elapsedSeconds(),
        stepCount = stepCount,
        steppingSeconds = steppingSeconds,
        elevationGainM = elevationGainM,
        heartRateSamples = heartRate.samples,
        guided = GuidedSessionController.snapshot(),
        recoveries = recoveries,
    )

    /** What [recoverInterrupted] did. */
    sealed interface RecoveryOutcome {
        /** Recording again; the caller must (re)start the tracking service. */
        data object Resumed : RecoveryOutcome

        /** Restored as a stopped run for the runner to save or discard; [stoppedAtEpochMs] is when. */
        data class Salvaged(val stoppedAtEpochMs: Long) : RecoveryOutcome

        /** Nothing interrupted for this account, or a recording is already in memory. */
        data object Nothing : RecoveryOutcome
    }

    /**
     * Continues — or failing that salvages — a recording the OS killed mid-run (see
     * [RecordingRecovery] for exactly when it may continue). Called from the tracking service's
     * sticky restart and when the app is opened; whichever comes first wins, the other finds the
     * recorder busy and does nothing.
     *
     * Continuing never bridges the dead time: the clock resumes where the last snapshot left it (the
     * time the app was dead, and the few seconds between that snapshot and the death, count as
     * paused), the route starts a new segment, and GPS, steps, barometer and heart rate all start
     * from fresh baselines.
     */
    fun recoverInterrupted(nowMs: Long, locationPermitted: Boolean, trigger: String): RecoveryOutcome {
        if (_state.value.status != RecordingStatus.Idle) return RecoveryOutcome.Nothing
        val pending = pendingFor(ownerUserId)
        return when (val decision = RecordingRecovery.decide(pending, ownerUserId, nowMs, locationPermitted)) {
            RecordingRecovery.Decision.Nothing -> RecoveryOutcome.Nothing
            is RecordingRecovery.Decision.Salvage -> {
                val run = pending ?: return RecoveryOutcome.Nothing
                resumeFinished(run, reason = "${trigger}:${decision.reason}")
                RecoveryOutcome.Salvaged(run.updatedAtEpochMs)
            }
            RecordingRecovery.Decision.Resume -> {
                val run = pending ?: return RecoveryOutcome.Nothing
                continueRecording(run, run.live ?: return RecoveryOutcome.Nothing, nowMs, trigger)
                RecoveryOutcome.Resumed
            }
        }
    }

    /**
     * The service could not get back into the foreground after a recovery (Android refused the
     * start, or permission vanished in between): stop here and keep what was recorded for saving.
     */
    fun abandonRecovery(reason: String) {
        val current = _state.value
        if (current.status == RecordingStatus.Idle || current.status == RecordingStatus.Finished) return
        RunTelemetry.emit { issue("recorder.recovery_abandoned", reason, runClientId = current.clientId) }
        finish()
        _state.update { it.copy(interruptedAtEpochMs = System.currentTimeMillis(), resumedAfterInterruption = false) }
    }

    private fun continueRecording(pending: PendingRun, live: LiveRecording, nowMs: Long, trigger: String) {
        val request = pending.request
        route.clear()
        request.route?.let { route += it }
        // Whatever the runner did while the app was dead is a break nothing measures or draws across.
        routeSegment = (route.maxOfOrNull { it.segmentIndex } ?: 0) + 1
        lastFix = null
        anchorFix = null
        distance.reset()
        gpsElevation.seed(live.elevationGainM)
        elevationBaseM = live.elevationGainM
        movingSecondsExact = (request.movingTimeSeconds ?: 0).toDouble()
        lastAcceptedTimeMs = 0
        highSpeedSeconds = 0.0
        stationarySeconds = 0.0
        paceWindow.clear()
        cadenceWindow.clear()
        heartRate.seed(request.averageHeartRate, live.heartRateSamples)
        recordedSteps = live.stepCount
        lastStepCounter = -1
        lastStepAtMs = -1
        steppingMs = live.steppingSeconds * 1000L
        coachInteractionIds.clear()
        request.coachInteractionIds?.let { coachInteractionIds += it }
        stationaryAutoPauses = 0
        vehicleAutoPauses = 0
        vehicleSpeedWindows = 0
        snapshotFailureReported = false
        lastSnapshotMs = 0L
        recoveries = live.recoveries + 1

        val startedAt = runCatching { java.time.Instant.parse(request.startedAt).toEpochMilli() }.getOrDefault(pending.updatedAtEpochMs)
        val elapsedMs = live.elapsedSeconds * 1000L
        // The clock carries on from the snapshot: everything since — the dead time and the last
        // few seconds before the death that no snapshot kept — counts as paused.
        pausedAccumMs = (nowMs - startedAt - elapsedMs).coerceAtLeast(0L)
        pauseStartedMs = if (live.paused) nowMs else 0L
        val autoPauseReason = live.autoPauseReason?.let { name -> AutoPauseReason.entries.firstOrNull { it.name == name } }

        GuidedSessionController.restore(live.guided)
        _state.value = RecordingState(
            status = if (live.paused) RecordingStatus.Paused else RecordingStatus.Recording,
            clientId = request.clientId,
            startedAtEpochMs = startedAt,
            distanceMeters = request.distanceKm * 1000.0,
            elapsedSeconds = live.elapsedSeconds,
            movingSeconds = movingSecondsExact.toInt(),
            elevationGainM = live.elevationGainM,
            route = route.toList(),
            autoPauseReason = if (live.paused) autoPauseReason else null,
            workoutId = request.workoutId,
            stepCount = recordedSteps,
            steppingSeconds = live.steppingSeconds,
            askedCoachIds = coachInteractionIds.toList(),
            draftIsPublic = request.isPublic == true,
            averageHeartRate = heartRate.average,
            elevationSource = if (barometer != null) "BARO" else "GPS",
            sport = request.sport ?: "RUN",
            laps = request.laps.orEmpty(),
            resumedAfterInterruption = true,
        )
        RunTelemetry.emit {
            issue(
                "recorder.resumed_after_interruption",
                context = mapOf(
                    "trigger" to trigger,
                    "deadSeconds" to (nowMs - pending.updatedAtEpochMs) / 1000,
                    "recoveries" to recoveries,
                    "paused" to live.paused,
                    "guided" to (live.guided != null),
                    "routePoints" to route.size,
                ),
                runClientId = request.clientId,
            )
        }
        // Durable at once with the new recovery count, so a crash straight after cannot loop.
        snapshot(force = true)
    }

    /** Restores a finished run into memory so the summary screen can show and save it. */
    fun resumeFinished(pending: PendingRun, reason: String? = null) {
        if (!pending.finished) {
            // The process died mid-recording (OS kill, crash) and this is what the snapshot kept.
            RunTelemetry.emit {
                issue(
                    "recorder.restored_interrupted",
                    reason,
                    context = mapOf(
                        "distanceM" to Math.round(pending.request.distanceKm * 1000),
                        "durationSeconds" to pending.request.durationSeconds,
                        "routePoints" to (pending.request.route?.size ?: 0),
                        "snapshotAgeSeconds" to (System.currentTimeMillis() - pending.updatedAtEpochMs) / 1000,
                    ),
                    runClientId = pending.request.clientId,
                )
            }
        }
        route.clear()
        pending.request.route?.let { route += it }
        routeSegment = route.maxOfOrNull { it.segmentIndex } ?: 0
        val movingSeconds = pending.request.movingTimeSeconds ?: pending.request.durationSeconds
        movingSecondsExact = movingSeconds.toDouble()
        // Rebuild the step total from the saved cadence so that re-saving this restored run posts the
        // same avgCadence rather than losing it — the request carries cadence, not the raw steps.
        recordedSteps = pending.request.avgCadence?.let { (it.toLong() * movingSeconds) / 60 } ?: 0
        lastStepCounter = -1
        lastStepAtMs = -1
        steppingMs = movingSeconds * 1000L
        coachInteractionIds.clear()
        pending.request.coachInteractionIds?.let { coachInteractionIds += it }
        _state.value = RecordingState(
            status = RecordingStatus.Finished,
            clientId = pending.request.clientId,
            startedAtEpochMs = runCatching { java.time.Instant.parse(pending.request.startedAt).toEpochMilli() }
                .getOrDefault(pending.updatedAtEpochMs),
            distanceMeters = pending.request.distanceKm * 1000.0,
            elapsedSeconds = pending.request.durationSeconds,
            movingSeconds = movingSeconds,
            elevationGainM = (pending.request.elevationGainM ?: 0).toDouble(),
            route = route.toList(),
            workoutId = pending.request.workoutId,
            stepCount = recordedSteps,
            steppingSeconds = movingSeconds,
            askedCoachIds = coachInteractionIds.toList(),
            draftIsPublic = pending.request.isPublic == true,
            laps = pending.request.laps.orEmpty(),
            sport = pending.request.sport ?: "RUN",
            interruptedAtEpochMs = if (pending.finished) null else pending.updatedAtEpochMs,
        )
    }

    /** The body this recording will be posted as. Shared by the outbox and the save call. */
    fun RecordingState.toCreateRequest() = dz.racedz.nativeapp.core.network.CreateRunRequest(
        clientId = clientId,
        startedAt = java.time.Instant.ofEpochMilli(startedAtEpochMs).toString(),
        distanceKm = distanceKm,
        durationSeconds = elapsedSeconds.coerceAtLeast(1),
        perceivedEffort = 5,
        movingTimeSeconds = movingSeconds.takeIf { it > 0 },
        elevationGainM = elevationGainM.toInt().takeIf { it > 0 },
        route = route.takeIf { it.size >= 2 },
        source = "GPS",
        workoutId = workoutId,
        avgCadence = avgCadenceSpm,
        averageHeartRate = averageHeartRate,
        coachInteractionIds = askedCoachIds.takeIf { it.isNotEmpty() },
        // Never public for a run that fails the on-foot test — the server would refuse it anyway,
        // and a retry must not keep asking.
        isPublic = draftIsPublic && nonFootReason == null,
        laps = laps.takeIf { it.isNotEmpty() },
        sport = sport,
    )

    /** Ticks elapsed time so the display keeps counting between fixes. */
    fun tick() {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) return
        // The pace reading expires with the window, not with the next fix — a runner who stopped
        // under a bridge should watch it go to "—", not keep reading their last stride.
        val now = System.currentTimeMillis()
        val pace = paceWindow.paceSecondsPerKm(now)
        val cadence = cadenceWindow.cadenceSpm(now)
        _state.update { it.copy(elapsedSeconds = elapsedSeconds(), currentPaceSecondsPerKm = pace, liveCadenceSpm = cadence) }
    }

    /** One sample from the sensor (NATRUN-07.3); counted only while recording. */
    fun onHeartRate(bpm: Int) {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) return
        heartRate.add(bpm)
        _state.update { it.copy(heartRateBpm = bpm, averageHeartRate = heartRate.average) }
    }

    /** The sensor is gone: no live number, the average so far stands. */
    fun onHeartRateLost() = _state.update { it.copy(heartRateBpm = null) }

    /** Touch guard on/off (NATRUN-07.7). Lives here so minimise/return keeps the lock. */
    fun setTouchLocked(locked: Boolean) {
        val status = _state.value.status
        if (locked && status != RecordingStatus.Recording && status != RecordingStatus.Acquiring && status != RecordingStatus.Paused) return
        _state.update { it.copy(touchLocked = locked) }
    }

    /** The service found a pressure sensor: elevation comes from it for this recording. */
    fun enableBarometer() {
        if (barometer == null) barometer = Barometer()
        _state.update { it.copy(elevationSource = "BARO") }
    }

    /** No pressure sensor, or the service stopped: back to GPS altitude. */
    fun disableBarometer() {
        barometer = null
        _state.update { it.copy(elevationSource = "GPS") }
    }

    /** One pressure sample in hPa from the service. */
    fun onPressure(hPa: Float) {
        val baro = barometer ?: return
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) return
        baro.add(hPa.toDouble())
        // Gain is what the barometer owns; the state mirrors it so the live screen counts climb
        // between fixes too.
        if (baro.ready) _state.update { it.copy(elevationGainM = elevationBaseM + baro.gainM) }
    }

    /**
     * Records a step-counter reading. [cumulativeSinceBoot] is the sensor's running total since the
     * device booted; the difference between consecutive readings, taken only while recording, is the
     * steps this run has accumulated. A reading arriving while paused or idle re-baselines instead of
     * counting, so a break — or steps before the run — never inflates the cadence.
     */
    fun onSteps(cumulativeSinceBoot: Long, atMs: Long = System.currentTimeMillis()) {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) {
            lastStepCounter = -1
            lastStepAtMs = -1
            return
        }
        // A reboot mid-run resets the sensor to a smaller total; treat that as a new baseline rather
        // than subtracting into the negatives.
        if (lastStepCounter in 0..cumulativeSinceBoot) {
            val delta = cumulativeSinceBoot - lastStepCounter
            recordedSteps += delta
            if (delta > 0 && lastStepAtMs in 0 until atMs) {
                steppingMs += steppingCreditMs(atMs - lastStepAtMs, delta)
            }
        }
        lastStepCounter = cumulativeSinceBoot
        lastStepAtMs = atMs
        cadenceWindow.add(atMs, recordedSteps)
        _state.update {
            it.copy(
                stepCount = recordedSteps,
                steppingSeconds = (steppingMs / 1000).toInt(),
                liveCadenceSpm = cadenceWindow.cadenceSpm(atMs),
            )
        }
    }

    /**
     * How much of the [gapMs] between two step readings the runner spent stepping, given [steps]
     * were counted in it. The sensor reports every few seconds while feet are moving, so a short gap
     * is all stepping. After a long silence — standing at a crossing, a stop — the steps arrive in
     * one reading at the end; crediting the whole gap would hide the stop, so it is capped at one
     * second per step (60 spm, slower than any walk), which keeps the stop out of the denominator.
     */
    internal fun steppingCreditMs(gapMs: Long, steps: Long): Long =
        if (gapMs <= CONTINUOUS_STEPPING_GAP_MS) gapMs else minOf(gapMs, steps * 1_000L)

    private const val CONTINUOUS_STEPPING_GAP_MS = 10_000L

    /**
     * Remembers a coach interaction the runner started mid-run, so its id rides to the server at
     * save and is linked to this run. Deduped and persisted with the next snapshot, so a question
     * asked mid-run survives the app being killed before the run is saved.
     */
    fun recordCoachInteraction(interactionId: String) {
        if (interactionId.isBlank() || interactionId in coachInteractionIds) return
        coachInteractionIds += interactionId
        _state.update { it.copy(askedCoachIds = coachInteractionIds.toList()) }
        // Durable immediately: the link matters most exactly when a run is interrupted after asking.
        snapshot(force = true)
    }

    fun onLocation(location: Location) {
        val current = _state.value
        if (current.status == RecordingStatus.Finished) return
        if (current.status == RecordingStatus.Paused) {
            // Any auto-pause resumes by itself on real movement; a hand pause is the runner's.
            if (current.autoPauseReason != null && shouldAutoResume(location)) {
                resume()
                // Fall through: this fix is the first of the resumed stretch.
                onLocation(location)
            }
            return
        }

        val accuracy = if (location.hasAccuracy()) location.accuracy else null
        if (!GpsQuality.isUsableFix(accuracy)) {
            // Still worth surfacing: the recording screen shows GPS strength, and a run that is not
            // accumulating should say why.
            _state.update { it.copy(gpsAccuracyM = accuracy) }
            return
        }

        val previous = lastFix
        val speed = if (location.hasSpeed()) location.speed else null
        val recordingAgeSeconds = (location.time - current.startedAtEpochMs) / 1000.0
        val step = distance.onFix(
            DistanceAccumulator.Fix(location.latitude, location.longitude, location.time, accuracy, speed),
            recordingAgeSeconds = recordingAgeSeconds,
        )

        if (previous == null) {
            route += location.toRoutePoint()
            lastAcceptedTimeMs = location.time
            lastFix = location
            anchorFix = location
            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    gpsAccuracyM = accuracy,
                    route = route.toList(),
                )
            }
            return
        }
        // A teleport is ignored entirely — it is not the previous point for anything that follows.
        if (step.rejected) return

        val speedDistance = if (speed != null && speed >= 0 && step.elapsedSeconds > 0) speed * step.elapsedSeconds else step.fixDistanceM
        highSpeedSeconds = GpsQuality.advanceHighSpeedWindow(highSpeedSeconds, speedDistance, step.elapsedSeconds)

        // Standing-still bookkeeping. Only usable fixes reach here, so a signal loss (no fixes at
        // all) never counts as stationary. The window is *consecutive* stationary time: any fix that
        // reads as movement resets it, so a slow walker whose Doppler dips below the floor for a
        // second now and then is not auto-paused (which used to flap pause/resume every few
        // seconds on a walk). A run that has not moved yet is still acquiring, not paused.
        stationarySeconds = when {
            step.moving -> 0.0
            step.stationary -> stationarySeconds + step.elapsedSeconds
            else -> stationarySeconds
        }
        // Summed from GPS timestamps, not a wall clock, so it survives the OS throttling our timer
        // while the screen is off; per fix, so a slow walk between counted points is moving time.
        movingSecondsExact += step.movingSeconds

        if (step.counted) {
            paceWindow.add(location.time, step.countedMeters, step.countedSeconds)
            val baro = barometer
            var gain = current.elevationGainM
            if (baro != null && baro.ready) {
                // The barometer owns climb once it has settled (NATRUN-07.6).
                gain = elevationBaseM + baro.gainM
            } else if (location.hasAltitude()) {
                // Smoothed with the server's own rule (see GpsElevationGain): summing every rise
                // over a metre between counted points turned altitude jitter into tens of metres of
                // climb on flat runs, which the saved run then contradicted.
                gain = gpsElevation.add(location.altitude)
            }
            anchorFix = location
            route += location.toRoutePoint()
            if (route.size >= MAX_ROUTE_POINTS * 2) downsampleRoute()
            lastAcceptedTimeMs = location.time

            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    distanceMeters = it.distanceMeters + step.countedMeters,
                    movingSeconds = movingSecondsExact.toInt(),
                    elevationGainM = gain,
                    gpsAccuracyM = accuracy,
                    currentPaceSecondsPerKm = paceWindow.paceSecondsPerKm(location.time),
                    route = route.toList(),
                    elapsedSeconds = elapsedSeconds(),
                    headingDegrees = reliableHeading(location),
                )
            }
        } else if (
            current.distanceMeters == 0.0 && route.size == 1 && !step.moving &&
            // Without Doppler speed, "not moving" only means "not yet [stepFloorMeters] from the
            // anchor" — so re-anchoring on every such fix kept a walker's anchor one stride behind
            // them forever, and the run never started (found 2026-11-16 with speedless mock fixes
            // on the M21: 194 fixes at 10 km/h, 0.00 km). Once the start has settled, hold the
            // anchor still and let the distance build up to the floor.
            (speed != null || recordingAgeSeconds < GpsQuality.SPEEDLESS_STARTUP_SETTLE_SECONDS)
        ) {
            // Still stationary: keep replacing the acquisition fix rather than saving its drift as
            // the start of the route, so the first real movement is measured from a settled position.
            // Only while not moving — re-anchoring a slow first stride would mean it never adds up.
            route[0] = location.toRoutePoint()
            distance.resettle(DistanceAccumulator.Fix(location.latitude, location.longitude, location.time, accuracy, speed))
            anchorFix = location
            lastAcceptedTimeMs = location.time
            _state.update { it.copy(gpsAccuracyM = accuracy, route = route.toList(), movingSeconds = movingSecondsExact.toInt()) }
        } else {
            // Moving but still inside the jitter floor keeps its heading; standing still has none.
            _state.update {
                it.copy(
                    gpsAccuracyM = accuracy,
                    movingSeconds = movingSecondsExact.toInt(),
                    headingDegrees = if (step.moving) reliableHeading(location) else null,
                )
            }
        }

        lastFix = location

        if (highSpeedSeconds >= GpsQuality.NON_FOOT_AUTO_PAUSE_SECONDS) {
            // Sustained vehicle speed. Keep recording — what was covered is the runner's record,
            // and the live non-foot banner plus the server's motion check already say it does not
            // look like a run. Counted once per stretch for diagnostics — as a speed window, not a
            // pause, since nothing paused; the window restarts so the next stretch is a new one.
            vehicleSpeedWindows++
            RunTelemetry.emit { breadcrumb("recorder.vehicle_speed") }
            highSpeedSeconds = 0.0
        } else if (
            RunSettings.autoPauseEnabled &&
            current.distanceMeters > 0.0 &&
            stationarySeconds >= GpsQuality.STATIONARY_AUTO_PAUSE_SECONDS
        ) {
            autoPause(AutoPauseReason.Stationary)
        }
    }

    /**
     * Whether a fix while stationary-paused means the runner is off again.
     *
     * See [GpsQuality.shouldAutoResume]. [lastFix] is frozen for the whole pause, so the
     * displacement is measured from where the runner stopped and drift has to add up to a real
     * distance, not a jitter step.
     */
    private fun shouldAutoResume(location: Location): Boolean {
        val accuracy = if (location.hasAccuracy()) location.accuracy else null
        if (!GpsQuality.isUsableFix(accuracy)) return false
        val origin = lastFix
        val displacement = origin?.let {
            GpsQuality.haversineMeters(it.latitude, it.longitude, location.latitude, location.longitude)
        }
        return GpsQuality.shouldAutoResume(
            reportedSpeedMps = if (location.hasSpeed()) location.speed else null,
            displacementFromPauseM = displacement,
            accuracyM = accuracy,
        )
    }


    /** The GPS bearing, only when the phone is moving fast enough for it to be a direction. */
    private fun reliableHeading(location: Location): Float? {
        if (!location.hasBearing() || !location.hasSpeed()) return null
        if (location.speed < GpsQuality.AUTO_RESUME_SPEED_MPS) return null
        val bearing = location.bearing
        return if (bearing.isFinite()) ((bearing % 360f) + 360f) % 360f else null
    }

    private fun elapsedSeconds(): Int {
        val current = _state.value
        if (current.startedAtEpochMs == 0L) return 0
        val paused = pausedAccumMs + if (pauseStartedMs > 0) System.currentTimeMillis() - pauseStartedMs else 0
        return ((System.currentTimeMillis() - current.startedAtEpochMs - paused) / 1000).toInt().coerceAtLeast(0)
    }

    /**
     * Halves the buffer, keeping the first and last point and both sides of every pause, so the
     * thinned route still breaks exactly where the runner paused.
     *
     * Distance, elevation and pace are summed per fix as they arrive, never recomputed from this
     * list, so thinning it changes nothing that was measured — only the drawn line's resolution.
     */
    private fun downsampleRoute() {
        val kept = route.downsampleKeepingSegments(MAX_ROUTE_POINTS)
        route.clear()
        route += kept
    }

    private fun Location.toRoutePoint(): RoutePointDto {
        val baro = barometer
        // Anchor the barometer to the first GPS altitude so route points stay metres above sea
        // level; afterwards the barometer's smoothed altitude replaces GPS's noisy one.
        if (baro != null && baro.anchor == null && hasAltitude() && baro.ready) baro.anchor = altitude
        val ele = baro?.absoluteAltitudeM ?: (if (hasAltitude()) altitude else null)
        return RoutePointDto(
            lat = latitude,
            lng = longitude,
            ele = ele,
            // Milliseconds, matching the website's route-point contract.
            t = time,
            segment = routeSegment,
        )
    }

    private fun MutableStateFlow<RecordingState>.update(block: (RecordingState) -> RecordingState) {
        value = block(value)
    }
}
