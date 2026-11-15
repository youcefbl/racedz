package dz.racedz.nativeapp

import android.Manifest
import android.location.Location
import android.location.LocationManager
import android.os.SystemClock
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import dz.racedz.nativeapp.feature.runs.record.RecordingStatus
import dz.racedz.nativeapp.feature.runs.record.RunCueDirector
import dz.racedz.nativeapp.feature.runs.record.RunRecorder
import dz.racedz.nativeapp.feature.runs.record.RunSettings
import dz.racedz.nativeapp.feature.runs.record.RunTrackingService
import java.util.Locale
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The run voice end to end, with the screen OFF — the case that was silent before, because cues
 * fired from the recording screen's composition. A real recording is driven with real-time GPS fixes
 * (a 4 m/s jog, Algiers), while [RunCueDirector] — started exactly as RunTrackingService starts it —
 * must announce start, pause, resume, the 0.5 km mark and the finish, from the bundled clips.
 * The real [RunTrackingService] is started as the run screen starts it: its foreground location
 * service is what keeps the process alive and un-frozen with the screen off (without it, ColorOS
 * froze the test process right after "resumed").
 *
 * Takes about three minutes and speaks out loud (Darija). Debug app only; the run is discarded.
 */
@RunWith(AndroidJUnit4::class)
class RunCueScreenOffDeviceTest {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val device = UiDevice.getInstance(instrumentation)

    @After
    fun tearDown() {
        device.wakeUp()
        RunTrackingService.stop(context)
        instrumentation.runOnMainSync {
            if (RunRecorder.state.value.status != RecordingStatus.Idle) RunRecorder.discard()
        }
    }

    @Test
    fun cuesPlayWithTheScreenOff() {
        val previousInterval = RunSettings.cueInterval
        RunSettings.audioCuesEnabled = true
        RunSettings.cueInterval = RunSettings.CueInterval.Half
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.ACCESS_FINE_LOCATION)
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
        try {
            var started = false
            instrumentation.runOnMainSync {
                if (RunRecorder.state.value.status != RecordingStatus.Idle) RunRecorder.discard()
                started = RunRecorder.start()
                RunCueDirector.setLocale(Locale.forLanguageTag("ar"))
                RunTrackingService.start(context) // starts RunCueDirector, exactly as in the app
            }
            assertTrue("recorder refused to start (pending run in the outbox?)", started)
            val before = RunCueDirector.recentlySpoken.size

            device.sleep()
            SystemClock.sleep(1_500)
            assertTrue("screen should be off", !device.isScreenOn)

            var lat = 36.7525
            val lng = 3.0420
            val metresPerDegree = 111_320.0
            fun fix() {
                lat += 4.0 / metresPerDegree // 4 m north per second
                val location = Location(LocationManager.GPS_PROVIDER).apply {
                    latitude = lat
                    longitude = lng
                    accuracy = 4f
                    speed = 4f
                    bearing = 0f
                    time = System.currentTimeMillis()
                    elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
                }
                instrumentation.runOnMainSync {
                    RunRecorder.onLocation(location)
                    RunRecorder.tick()
                }
            }

            repeat(20) { fix(); SystemClock.sleep(1_000) }
            instrumentation.runOnMainSync { RunRecorder.pause() }
            SystemClock.sleep(4_000)
            instrumentation.runOnMainSync { RunRecorder.resume() }
            // Until the 0.5 km mark has been passed and spoken (bounded at 4 minutes).
            val deadline = SystemClock.elapsedRealtime() + 240_000
            while (SystemClock.elapsedRealtime() < deadline &&
                RunCueDirector.recentlySpoken.drop(before).none { it.startsWith("Progress") }
            ) {
                fix()
                SystemClock.sleep(1_000)
            }
            Log.i(TAG, "distance=${RunRecorder.state.value.distanceMeters} m, elapsed=${RunRecorder.state.value.elapsedSeconds} s")
            assertTrue("screen stayed off during the run", !device.isScreenOn)

            instrumentation.runOnMainSync { RunRecorder.finish() }
            val finishDeadline = SystemClock.elapsedRealtime() + 30_000
            while (SystemClock.elapsedRealtime() < finishDeadline &&
                RunCueDirector.recentlySpoken.drop(before).none { it.startsWith("Finished") }
            ) SystemClock.sleep(250)

            val spoken = RunCueDirector.recentlySpoken.drop(before)
            Log.i(TAG, "spoken with the screen off: $spoken")
            assertEquals(
                listOf("Started:clips", "Paused:clips", "Resumed:clips", "Progress:clips", "Finished:clips"),
                spoken,
            )
        } finally {
            RunSettings.cueInterval = previousInterval
        }
    }

    private companion object {
        const val TAG = "RunCueScreenOffTest"
    }
}
