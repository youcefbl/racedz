package dz.racedz.nativeapp

import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import dz.racedz.nativeapp.core.design.ZidRunTestTags
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Black-box smoke tests for the journeys most likely to regress after Compose/navigation work.
 *
 * They deliberately run through the real debug app and local `/api/v1` server. The host runner
 * refuses a missing local server and wires it through `adb reverse`; no production URL is used.
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
class NativeDeviceUiRegressionTest {

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val device = UiDevice.getInstance(instrumentation)
    private val packageName = context.packageName

    @Before
    fun launchEnglishTestSession() {
        device.executeShellCommand("cmd locale set-app-locales $packageName --locales en")
        device.pressHome()
        startApp()
        ensureSignedIn()
    }

    @Test
    fun runsAndCoachStayReachable_andRecordDockSurvivesScrolling() {
        waitForTag(ZidRunTestTags.TabRuns).click()
        waitForTag(ZidRunTestTags.RunsOverviewScroll)
        val dockBefore = waitForTag(ZidRunTestTags.RunsRecordDock)
        assertTrue("Record dock must be visible before scrolling", dockBefore.visibleBounds.height() > 0)

        repeat(3) {
            waitForTag(ZidRunTestTags.RunsOverviewScroll).scroll(Direction.DOWN, 0.75f)
        }

        val dockAfter = waitForTag(ZidRunTestTags.RunsRecordDock)
        assertTrue("Record dock must remain visible after scrolling", dockAfter.visibleBounds.height() > 0)

        waitForTag(ZidRunTestTags.TabCoach).click()
        waitForTag(ZidRunTestTags.CoachOverviewScroll)
        assertTrue("Coach tab must remain selected and reachable", hasTag(ZidRunTestTags.TabCoach))
    }

    @Test
    fun selectedRaceCategoryReachesDetails_andArabicDobNormalizesToIsoDigits() {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse("zidrun://race/tizi-ouzou-trail-challenge"))
                .setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )

        waitForTag(ZidRunTestTags.RaceDetailScroll)
        scrollUntilVisible(ZidRunTestTags.RaceDetailScroll, ZidRunTestTags.RaceRegister).click()

        // G-01: Race Detail has already selected the shortest category, so Registration must not
        // ask for that same decision again. This caught a String/String handoff that sent the race
        // title where a category id was expected.
        waitForTag(ZidRunTestTags.RegistrationDetails)
        assertFalse(
            "A carried category must skip the distance chooser",
            hasTag(ZidRunTestTags.RegistrationDistance),
        )

        val dob = scrollUntilVisible(
            ZidRunTestTags.RegistrationScroll,
            ZidRunTestTags.RegistrationDateOfBirth,
        )
        dob.click()
        dob.text = "١٩٩٦٠٥٢١"

        assertTrue(
            "Arabic-Indic input must normalize to ASCII ISO date",
            device.wait(Until.hasObject(By.textContains("1996-05-21")), SHORT_TIMEOUT_MS),
        )
    }

    private fun startApp() {
        val intent = requireNotNull(context.packageManager.getLaunchIntentForPackage(packageName)) {
            "No launcher activity for $packageName"
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(intent)
        check(
            device.wait(Until.hasObject(By.pkg(packageName).depth(0)), LONG_TIMEOUT_MS)
        ) { "$packageName did not become visible" }
    }

    private fun ensureSignedIn() {
        if (device.wait(Until.hasObject(By.res(ZidRunTestTags.TabRaces)), SHORT_TIMEOUT_MS)) return

        waitForTag(ZidRunTestTags.AuthEmail).text = TEST_EMAIL
        waitForTag(ZidRunTestTags.AuthPassword).text = TEST_PASSWORD
        device.pressBack() // close the IME so the CTA is visible on small phones
        waitForTag(ZidRunTestTags.AuthSignIn).click()

        waitForEither(ZidRunTestTags.TabRaces, ZidRunTestTags.OnboardingSkip)
        if (hasTag(ZidRunTestTags.OnboardingSkip)) {
            waitForTag(ZidRunTestTags.OnboardingSkip).click()
        }
        waitForTag(ZidRunTestTags.TabRaces, LOGIN_TIMEOUT_MS)
    }

    private fun scrollUntilVisible(scrollTag: String, targetTag: String): UiObject2 {
        repeat(MAX_SCROLLS) {
            findTag(targetTag)?.let { return it }
            waitForTag(scrollTag).scroll(Direction.DOWN, 0.8f)
            SystemClock.sleep(200)
        }
        return waitForTag(targetTag)
    }

    private fun waitForEither(first: String, second: String) {
        val deadline = SystemClock.elapsedRealtime() + LOGIN_TIMEOUT_MS
        while (SystemClock.elapsedRealtime() < deadline) {
            if (hasTag(first) || hasTag(second)) return
            SystemClock.sleep(200)
        }
        error("Timed out waiting for $first or $second")
    }

    private fun findTag(tag: String): UiObject2? = device.findObject(By.res(tag))

    private fun hasTag(tag: String): Boolean = device.hasObject(By.res(tag))

    private fun waitForTag(tag: String, timeoutMs: Long = LONG_TIMEOUT_MS): UiObject2 =
        requireNotNull(device.wait(Until.findObject(By.res(tag)), timeoutMs)) {
            "Timed out waiting for Compose test tag '$tag' in $packageName"
        }

    private companion object {
        const val TEST_EMAIL = "runner@example.com"
        const val TEST_PASSWORD = "racedz-demo-password"
        const val SHORT_TIMEOUT_MS = 5_000L
        const val LONG_TIMEOUT_MS = 20_000L
        const val LOGIN_TIMEOUT_MS = 30_000L
        const val MAX_SCROLLS = 10
    }
}
