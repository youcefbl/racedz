package dz.racedz.nativeapp.feature.runs.record

/**
 * Whether a recording the OS killed mid-run may be continued, or only salvaged.
 *
 * Until 2026-11-17 every interrupted run was salvaged: the tracking service's sticky restart found
 * an empty recorder and stopped, and the run was cut where the process died with nothing telling
 * the runner (found by crashing the app mid-run on the M21). Continuing is right only when it is
 * clearly the same run, still going on, for the same person:
 *
 * - the snapshot is of a recording in progress, not a finished or save-requested run;
 * - it belongs to the account signed in now — never another person's route;
 * - location permission is still granted (revoked means the runner chose to stop it);
 * - it is fresh: written at most [MAX_INTERRUPTION_MS] ago. The service rewrites it every 15 s,
 *   paused or not, so its age is roughly how long the app has been dead. An app opened much
 *   later is not a continuation;
 * - it has full live state ([PendingRun.live]) — an older snapshot cannot say whether the run was
 *   paused or exactly where the clock stood;
 * - it has not already been continued [MAX_RECOVERIES] times, so a crash in the recorder itself
 *   cannot loop forever.
 *
 * Continuing happens only with the app in the foreground — opened by the runner, usually from
 * the [RunInterruptionNotice] tap. A background restart of the tracking service on Android 12+ is
 * neither allowed back into the foreground nor given location (measured on the M21), and the app
 * deliberately has no background location, so it only posts the notice.
 *
 * Android never restarts an app the user force-stopped and runs no code when the OS kills it
 * outright: then there is no notice, and opening the app later ends in salvage. Nothing may
 * promise recovery from a force-stop.
 */
internal object RecordingRecovery {

    const val MAX_INTERRUPTION_MS = 120_000L
    const val MAX_RECOVERIES = 3

    /** A snapshot dated this far in the future is a clock change, not a fresh write. */
    private const val CLOCK_SKEW_MS = 60_000L

    sealed interface Decision {
        /** Continue recording from the snapshot. */
        data object Resume : Decision

        /** Keep what was recorded for the runner to save or discard. [reason] goes to telemetry. */
        data class Salvage(val reason: String) : Decision

        /** Nothing here this account may touch, or nothing interrupted at all. */
        data object Nothing : Decision
    }

    fun decide(pending: PendingRun?, ownerUserId: String?, nowMs: Long, locationPermitted: Boolean): Decision {
        if (pending == null || ownerUserId.isNullOrBlank() || pending.ownerUserId != ownerUserId) return Decision.Nothing
        if (pending.finished || pending.saveRequested) return Decision.Nothing
        val live = pending.live ?: return Decision.Salvage("no_live_state")
        if (!locationPermitted) return Decision.Salvage("no_location_permission")
        if (live.recoveries >= MAX_RECOVERIES) return Decision.Salvage("too_many_recoveries")
        val ageMs = nowMs - pending.updatedAtEpochMs
        if (ageMs < -CLOCK_SKEW_MS) return Decision.Salvage("clock_changed")
        if (ageMs > MAX_INTERRUPTION_MS) return Decision.Salvage("stale")
        return Decision.Resume
    }
}
