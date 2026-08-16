package dz.racedz.nativeapp.feature.runs.record

import android.location.Location
import dz.racedz.nativeapp.core.network.RoutePointDto
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class RecordingStatus { Idle, Acquiring, Recording, Paused, Finished }

/** Why the recorder paused on its own. */
enum class AutoPauseReason {
    /** Standing still (a light, a stop). Resumes by itself on the first real movement. */
    Stationary,
    /** Sustained vehicle speed. Never resumes by itself — the runner decides. */
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
    /** Manual lap boundaries pressed so far, from the start of the run (NATRUN-06.5). */
    val laps: List<dz.racedz.nativeapp.core.network.LapMarkDto> = emptyList(),
) {
    val distanceKm: Double get() = distanceMeters / 1000.0

    val autoPaused: Boolean get() = autoPauseReason != null

    /**
     * Average step cadence in steps per minute over moving time, or null.
     *
     * Null until there is enough of a run to mean something — a stray handful of steps over ten
     * seconds is noise, not a cadence — and null on devices with no step counter. The server reads
     * this to distinguish a genuine run from a ride at running pace; capped at 300 to stay inside
     * the wire contract's range.
     */
    val avgCadenceSpm: Int?
        get() = if (stepCount > 0 && movingSeconds >= 60) {
            (stepCount / (movingSeconds / 60.0)).toInt().coerceIn(0, 300)
        } else {
            null
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
        get() = GpsQuality.detectNonFootActivity(distanceKm, movingSeconds, avgCadenceSpm)

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
     * Completed kilometre splits, so the runner can see the last km's pace while still running.
     * Derived from the route's own timestamps, interpolating the boundary crossing.
     */
    val splits: List<LiveSplit>
        get() {
            if (route.size < 2) return emptyList()
            val out = mutableListOf<LiveSplit>()
            var kmStartMs = route.first().t ?: return emptyList()
            var travelled = 0.0
            var boundary = 1000.0
            var index = 1
            for (i in 1 until route.size) {
                val a = route[i - 1]
                val b = route[i]
                val segment = GpsQuality.haversineMeters(a.lat, a.lng, b.lat, b.lng)
                if (segment <= 0) continue
                val aMs = a.t ?: continue
                val bMs = b.t ?: continue
                val segmentStart = travelled
                travelled += segment
                while (travelled >= boundary) {
                    val fraction = (boundary - segmentStart) / segment
                    val crossedMs = aMs + ((bMs - aMs) * fraction).toLong()
                    val seconds = ((crossedMs - kmStartMs) / 1000L).toInt()
                    if (seconds > 0) out += LiveSplit(index, seconds)
                    kmStartMs = crossedMs
                    boundary += 1000.0
                    index += 1
                }
            }
            return out
        }
}

enum class GpsStrength { Unknown, None, Weak, Good, Strong }

/** A completed kilometre during the run in progress. */
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

    /** Called when the signed-in account changes. Passing null (sign-out) drops the live state. */
    fun setOwner(userId: String?) {
        if (ownerUserId == userId) return
        ownerUserId = userId
        // A recording belongs to the person who started it. Switching accounts must not carry a
        // live run — or its route — into the new session; the snapshot stays on disk for its
        // owner to resolve when they sign back in.
        if (_state.value.status != RecordingStatus.Idle) {
            route.clear()
            lastFix = null
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

        val written = box.save(
            PendingRun(
                request = current.toCreateRequest(),
                finished = current.status == RecordingStatus.Finished,
                updatedAtEpochMs = now,
                ownerUserId = ownerUserId,
            )
        )
        // A failed write means the run is no longer backed by anything — the runner is told, rather
        // than discovering it only after a process kill (P234-R02).
        _snapshotFailing.value = !written
    }

    /**
     * Restores a recording left behind by a previous process — finished or not (RED-R01).
     *
     * An interrupted in-progress recording has no reliable way to resume its GPS stream, so it is
     * salvaged the same way as a finished one: [resumeFinished] presents what was measured for an
     * explicit save or discard. Filtering to `finished` here used to leave an interrupted run
     * invisible on disk while the Idle singleton offered Record — and the one-file outbox would
     * then overwrite it on the next recording's first snapshot.
     */
    fun restorePending(): PendingRun? = pendingFor(ownerUserId)

    private val _state = MutableStateFlow(RecordingState())
    val state: StateFlow<RecordingState> = _state.asStateFlow()

    private var lastFix: Location? = null
    private var lastAcceptedTimeMs: Long = 0
    private var pausedAccumMs: Long = 0
    private var pauseStartedMs: Long = 0
    private var highSpeedSeconds: Double = 0.0
    /** Seconds of consecutive usable-but-stationary fixes; drives the stationary auto-pause. */
    private var stationarySeconds: Double = 0.0
    private val paceWindow = PaceWindow()
    private val route = mutableListOf<RoutePointDto>()

    /**
     * Step-counter bookkeeping. The sensor reports steps cumulatively since boot, so a run counts
     * the delta between readings while it is recording. [lastStepCounter] is reset to -1 whenever
     * recording is not live (start, pause, resume) so steps taken while paused — or before the run —
     * never land in [recordedSteps].
     */
    private var recordedSteps: Long = 0
    private var lastStepCounter: Long = -1

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
    fun start(workoutId: String? = null): Boolean {
        if (_state.value.status != RecordingStatus.Idle) return false
        // Only a *resolvable* snapshot blocks a new run. An unreadable one also blocks — but the
        // caller learns which through [outboxBlocked], instead of Record silently doing nothing
        // and the app navigating to an empty live screen (P234-R02).
        when (outbox?.read(ownerUserId)) {
            is OutboxState.Present -> return false
            OutboxState.Unreadable -> {
                _outboxBlocked.value = true
                return false
            }
            else -> Unit
        }
        route.clear()
        lastFix = null
        lastAcceptedTimeMs = 0
        pausedAccumMs = 0
        pauseStartedMs = 0
        highSpeedSeconds = 0.0
        stationarySeconds = 0.0
        paceWindow.clear()
        recordedSteps = 0
        lastStepCounter = -1
        coachInteractionIds.clear()
        _state.value = RecordingState(
            status = RecordingStatus.Acquiring,
            clientId = UUID.randomUUID().toString(),
            startedAtEpochMs = System.currentTimeMillis(),
            workoutId = workoutId,
        )
        return true
    }

    fun pause() {
        if (_state.value.status != RecordingStatus.Recording && _state.value.status != RecordingStatus.Acquiring) return
        pauseStartedMs = System.currentTimeMillis()
        _state.update { it.copy(status = RecordingStatus.Paused, autoPauseReason = null, currentPaceSecondsPerKm = null, headingDegrees = null) }
        snapshot(force = true)
    }

    private fun autoPause(reason: AutoPauseReason) {
        pauseStartedMs = System.currentTimeMillis()
        stationarySeconds = 0.0
        _state.update { it.copy(status = RecordingStatus.Paused, autoPauseReason = reason, currentPaceSecondsPerKm = null, headingDegrees = null) }
        snapshot(force = true)
    }

    fun resume() {
        if (_state.value.status != RecordingStatus.Paused) return
        if (pauseStartedMs > 0) pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
        pauseStartedMs = 0
        // A fix from before the pause would otherwise be treated as the previous point and turn the
        // whole break into one enormous segment.
        lastFix = null
        highSpeedSeconds = 0.0
        stationarySeconds = 0.0
        paceWindow.clear()
        // Re-baseline the step counter so steps taken during the pause are not counted on resume.
        lastStepCounter = -1
        _state.update { it.copy(status = RecordingStatus.Recording, autoPauseReason = null) }
    }

    fun finish() {
        if (pauseStartedMs > 0) {
            pausedAccumMs += System.currentTimeMillis() - pauseStartedMs
            pauseStartedMs = 0
        }
        _state.update { it.copy(status = RecordingStatus.Finished, elapsedSeconds = elapsedSeconds()) }
        // The run is over and everything it measured is now at risk until the server has it.
        snapshot(force = true)
    }

    /**
     * Clears the recording and the outbox.
     *
     * Only after the server confirmed the save, or when the runner explicitly discarded. A failed
     * request must never reach here — the outbox exists precisely so the run survives it.
     */
    fun reset() {
        route.clear()
        lastFix = null
        lastSnapshotMs = 0L
        stationarySeconds = 0.0
        paceWindow.clear()
        recordedSteps = 0
        lastStepCounter = -1
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

    /** Restores a finished run into memory so the summary screen can show and save it. */
    fun resumeFinished(pending: PendingRun) {
        route.clear()
        pending.request.route?.let { route += it }
        val movingSeconds = pending.request.movingTimeSeconds ?: pending.request.durationSeconds
        // Rebuild the step total from the saved cadence so that re-saving this restored run posts the
        // same avgCadence rather than losing it — the request carries cadence, not the raw steps.
        recordedSteps = pending.request.avgCadence?.let { (it.toLong() * movingSeconds) / 60 } ?: 0
        lastStepCounter = -1
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
            askedCoachIds = coachInteractionIds.toList(),
            draftIsPublic = pending.request.isPublic == true,
            laps = pending.request.laps.orEmpty(),
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
        coachInteractionIds = askedCoachIds.takeIf { it.isNotEmpty() },
        // Never public for a run that fails the on-foot test — the server would refuse it anyway,
        // and a retry must not keep asking.
        isPublic = draftIsPublic && nonFootReason == null,
        laps = laps.takeIf { it.isNotEmpty() },
    )

    /** Ticks elapsed time so the display keeps counting between fixes. */
    fun tick() {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) return
        // The pace reading expires with the window, not with the next fix — a runner who stopped
        // under a bridge should watch it go to "—", not keep reading their last stride.
        val pace = paceWindow.paceSecondsPerKm(System.currentTimeMillis())
        _state.update { it.copy(elapsedSeconds = elapsedSeconds(), currentPaceSecondsPerKm = pace) }
    }

    /**
     * Records a step-counter reading. [cumulativeSinceBoot] is the sensor's running total since the
     * device booted; the difference between consecutive readings, taken only while recording, is the
     * steps this run has accumulated. A reading arriving while paused or idle re-baselines instead of
     * counting, so a break — or steps before the run — never inflates the cadence.
     */
    fun onSteps(cumulativeSinceBoot: Long) {
        val status = _state.value.status
        if (status != RecordingStatus.Recording && status != RecordingStatus.Acquiring) {
            lastStepCounter = -1
            return
        }
        // A reboot mid-run resets the sensor to a smaller total; treat that as a new baseline rather
        // than subtracting into the negatives.
        if (lastStepCounter in 0..cumulativeSinceBoot) {
            recordedSteps += cumulativeSinceBoot - lastStepCounter
        }
        lastStepCounter = cumulativeSinceBoot
        _state.update { it.copy(stepCount = recordedSteps) }
    }

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
            // Only a stationary auto-pause resumes by itself. A hand pause is the runner's, and the
            // vehicle pause exists precisely because the phone is moving fast.
            if (current.autoPauseReason == AutoPauseReason.Stationary && shouldAutoResume(location)) {
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

        if (previous == null) {
            route += location.toRoutePoint()
            lastAcceptedTimeMs = location.time
            lastFix = location
            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    gpsAccuracyM = accuracy,
                    route = route.toList(),
                )
            }
            return
        }

        val distanceM = GpsQuality.haversineMeters(
            previous.latitude, previous.longitude, location.latitude, location.longitude,
        )
        val elapsed = (location.time - previous.time) / 1000.0
        val speedDistance = if (speed != null && speed >= 0 && elapsed > 0) speed * elapsed else distanceM
        highSpeedSeconds = GpsQuality.advanceHighSpeedWindow(highSpeedSeconds, speedDistance, elapsed)

        val counts = GpsQuality.shouldCountSegment(
            distanceM = distanceM,
            elapsedSeconds = elapsed,
            reportedSpeedMps = speed,
            recordingAgeSeconds = (location.time - current.startedAtEpochMs) / 1000.0,
        )

        // Standing-still bookkeeping. Only usable fixes reach here, so a signal loss (no fixes at
        // all) never counts as stationary. Any accepted segment resets the window; a run that has
        // not moved yet is still acquiring, not paused — auto-pause only applies once underway.
        stationarySeconds = when {
            counts -> 0.0
            elapsed > 0 && GpsQuality.isStationaryFix(distanceM, speed) -> stationarySeconds + elapsed
            else -> stationarySeconds
        }

        if (counts) {
            paceWindow.add(location.time, distanceM, elapsed)
            var gain = current.elevationGainM
            if (previous.hasAltitude() && location.hasAltitude()) {
                val delta = location.altitude - previous.altitude
                // Only rises above a metre count: GPS altitude noise would otherwise invent climb on
                // a flat road.
                if (delta > 1) gain += delta
            }
            route += location.toRoutePoint()
            if (route.size >= MAX_ROUTE_POINTS * 2) downsampleRoute()
            lastAcceptedTimeMs = location.time

            _state.update {
                it.copy(
                    status = RecordingStatus.Recording,
                    distanceMeters = it.distanceMeters + distanceM,
                    // Summed from GPS timestamps, not a wall clock, so it survives the OS throttling
                    // our timer while the screen is off.
                    movingSeconds = it.movingSeconds + if (elapsed < GpsQuality.MAX_MOVING_GAP_S) elapsed.toInt() else 0,
                    elevationGainM = gain,
                    gpsAccuracyM = accuracy,
                    currentPaceSecondsPerKm = paceWindow.paceSecondsPerKm(location.time),
                    route = route.toList(),
                    elapsedSeconds = elapsedSeconds(),
                    headingDegrees = reliableHeading(location),
                )
            }
        } else if (current.distanceMeters == 0.0 && route.size == 1) {
            // Still stationary: keep replacing the acquisition fix rather than saving its drift as
            // the start of the route, so the first real movement is measured from a settled position.
            route[0] = location.toRoutePoint()
            lastAcceptedTimeMs = location.time
            _state.update { it.copy(gpsAccuracyM = accuracy, route = route.toList()) }
        } else {
            // A fix that did not count is a runner who is not moving on foot: no heading either.
            _state.update { it.copy(gpsAccuracyM = accuracy, headingDegrees = null) }
        }

        lastFix = location

        if (highSpeedSeconds >= GpsQuality.NON_FOOT_AUTO_PAUSE_SECONDS) {
            // Sustained vehicle speed. Pause rather than discard: the runner may have genuinely run
            // and then got in a car, and deleting their run would be far worse than a stray pause.
            autoPause(AutoPauseReason.Vehicle)
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
     * The GPS velocity decides when it exists. Without one (some providers, the emulator), moving
     * [AUTO_RESUME_DISPLACEMENT_M] from where the pause began is the signal — [lastFix] is frozen
     * for the whole pause, so drift has to add up to a real displacement, not a jitter step.
     */
    private fun shouldAutoResume(location: Location): Boolean {
        if (!GpsQuality.isUsableFix(if (location.hasAccuracy()) location.accuracy else null)) return false
        val speedIsUsable = location.hasSpeed() && location.speed.isFinite() &&
            !(GpsQuality.trustDisplacementWhenSpeedIsZero && location.speed == 0f)
        if (speedIsUsable) return location.speed >= GpsQuality.AUTO_RESUME_SPEED_MPS
        val origin = lastFix ?: return false
        return GpsQuality.haversineMeters(origin.latitude, origin.longitude, location.latitude, location.longitude) >=
            AUTO_RESUME_DISPLACEMENT_M
    }

    private const val AUTO_RESUME_DISPLACEMENT_M = 8.0

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
     * Halves the buffer, keeping the first and last point.
     *
     * Distance, elevation and pace are summed per fix as they arrive, never recomputed from this
     * list, so thinning it changes nothing that was measured — only the drawn line's resolution.
     */
    private fun downsampleRoute() {
        val kept = ArrayList<RoutePointDto>(MAX_ROUTE_POINTS + 1)
        val step = route.size.toDouble() / MAX_ROUTE_POINTS
        var i = 0.0
        while (i < route.size) {
            kept += route[i.toInt()]
            i += step
        }
        if (kept.lastOrNull() != route.last()) kept += route.last()
        route.clear()
        route += kept
    }

    private fun Location.toRoutePoint() = RoutePointDto(
        lat = latitude,
        lng = longitude,
        ele = if (hasAltitude()) altitude else null,
        // Milliseconds, matching the website's route-point contract.
        t = time,
    )

    private fun MutableStateFlow<RecordingState>.update(block: (RecordingState) -> RecordingState) {
        value = block(value)
    }
}
