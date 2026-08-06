package dz.racedz.nativeapp.macrobenchmark

import android.os.SystemClock
import androidx.benchmark.macro.CompilationMode
import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Physical-device performance baselines for the three high-frequency runner surfaces.
 *
 * CompilationMode.Ignore preserves the dedicated local test account on Android 13, where resetting
 * compilation can require reinstalling the APK. The target is still non-debuggable/profileable;
 * JSON results and Perfetto traces are copied to macrobenchmark/build/outputs automatically.
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
class NativeAppBenchmark {

    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    private val iterations: Int
        get() = InstrumentationRegistry.getArguments()
            .getString("zidrunIterations")
            ?.toIntOrNull()
            ?.coerceIn(3, 20)
            ?: DEFAULT_ITERATIONS

    @Test
    fun signedInColdStartup() = benchmarkRule.measureRepeated(
        packageName = TARGET_PACKAGE,
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.Ignore(),
        startupMode = StartupMode.COLD,
        iterations = iterations,
        setupBlock = {
            // COLD kills the target between setup and measure. Setup may sign in on iteration one;
            // the encrypted session then remains stable for every measured launch.
            resetAndEnsureSignedIn()
            pressHome()
        },
    ) {
        startActivityAndWait()
        waitForTag(Tags.TabRaces)
    }

    @Test
    fun runsOverviewScroll() = scrollBenchmark(Tags.TabRuns, Tags.RunsOverviewScroll)

    @Test
    fun coachOverviewScroll() = scrollBenchmark(Tags.TabCoach, Tags.CoachOverviewScroll)

    @Test
    fun registrationDetailsScroll() = benchmarkRule.measureRepeated(
        packageName = TARGET_PACKAGE,
        metrics = listOf(FrameTimingMetric()),
        compilationMode = CompilationMode.Ignore(),
        iterations = iterations,
        setupBlock = {
            resetAndEnsureSignedIn()
            openRaceRegistration()
        },
    ) {
        flingTaggedSurface(Tags.RegistrationScroll)
    }

    private fun scrollBenchmark(tabTag: String, surfaceTag: String) =
        benchmarkRule.measureRepeated(
            packageName = TARGET_PACKAGE,
            metrics = listOf(FrameTimingMetric()),
            compilationMode = CompilationMode.Ignore(),
            iterations = iterations,
            setupBlock = {
                resetAndEnsureSignedIn()
                waitForTag(tabTag).click()
                waitForTag(surfaceTag)
            },
        ) {
            flingTaggedSurface(surfaceTag)
        }

    private fun MacrobenchmarkScope.resetAndEnsureSignedIn() {
        device.executeShellCommand("cmd locale set-app-locales $TARGET_PACKAGE --locales en")
        device.executeShellCommand("am force-stop $TARGET_PACKAGE")
        startActivityAndWait()

        if (device.wait(Until.hasObject(By.res(Tags.TabRaces)), SHORT_TIMEOUT_MS)) return

        waitForTag(Tags.AuthEmail).text = TEST_EMAIL
        waitForTag(Tags.AuthPassword).text = TEST_PASSWORD
        device.pressBack()
        waitForTag(Tags.AuthSignIn).click()

        waitForEither(Tags.TabRaces, Tags.OnboardingSkip)
        if (device.hasObject(By.res(Tags.OnboardingSkip))) {
            waitForTag(Tags.OnboardingSkip).click()
        }
        waitForTag(Tags.TabRaces, LOGIN_TIMEOUT_MS)
    }

    private fun MacrobenchmarkScope.openRaceRegistration() {
        device.executeShellCommand(
            "am start -W -a android.intent.action.VIEW " +
                "-d zidrun://race/tizi-ouzou-trail-challenge " +
                "$TARGET_PACKAGE/dz.racedz.nativeapp.MainActivity"
        )
        waitForTag(Tags.RaceDetailScroll)
        scrollUntilVisible(Tags.RaceDetailScroll, Tags.RaceRegister).click()
        waitForTag(Tags.RegistrationDetails)
    }

    private fun MacrobenchmarkScope.flingTaggedSurface(tag: String) {
        val surface = waitForTag(tag)
        surface.setGestureMargin(device.displayWidth / 6)
        surface.fling(Direction.DOWN)
        surface.fling(Direction.UP)
    }

    private fun MacrobenchmarkScope.scrollUntilVisible(scrollTag: String, targetTag: String): UiObject2 {
        repeat(MAX_SCROLLS) {
            device.findObject(By.res(targetTag))?.let { return it }
            waitForTag(scrollTag).scroll(Direction.DOWN, 0.8f)
            SystemClock.sleep(150)
        }
        return waitForTag(targetTag)
    }

    private fun MacrobenchmarkScope.waitForEither(first: String, second: String) {
        val deadline = SystemClock.elapsedRealtime() + LOGIN_TIMEOUT_MS
        while (SystemClock.elapsedRealtime() < deadline) {
            if (device.hasObject(By.res(first)) || device.hasObject(By.res(second))) return
            SystemClock.sleep(200)
        }
        error("Timed out waiting for $first or $second")
    }

    private fun MacrobenchmarkScope.waitForTag(
        tag: String,
        timeoutMs: Long = LONG_TIMEOUT_MS,
    ): UiObject2 = requireNotNull(device.wait(Until.findObject(By.res(tag)), timeoutMs)) {
        "Timed out waiting for Compose test tag '$tag' in $TARGET_PACKAGE"
    }

    private object Tags {
        const val AuthEmail = "auth_email"
        const val AuthPassword = "auth_password"
        const val AuthSignIn = "auth_sign_in"
        const val OnboardingSkip = "onboarding_skip"
        const val TabRaces = "tab_races"
        const val TabRuns = "tab_runs"
        const val TabCoach = "tab_coach"
        const val RaceDetailScroll = "race_detail_scroll"
        const val RaceRegister = "race_register"
        const val RegistrationDetails = "registration_details"
        const val RegistrationScroll = "registration_scroll"
        const val RunsOverviewScroll = "runs_overview_scroll"
        const val CoachOverviewScroll = "coach_overview_scroll"
    }

    private companion object {
        const val TARGET_PACKAGE = "dz.racedz.nativeapp.benchmark"
        const val TEST_EMAIL = "runner@example.com"
        const val TEST_PASSWORD = "racedz-demo-password"
        const val DEFAULT_ITERATIONS = 5
        const val SHORT_TIMEOUT_MS = 5_000L
        const val LONG_TIMEOUT_MS = 20_000L
        const val LOGIN_TIMEOUT_MS = 30_000L
        const val MAX_SCROLLS = 10
    }
}
