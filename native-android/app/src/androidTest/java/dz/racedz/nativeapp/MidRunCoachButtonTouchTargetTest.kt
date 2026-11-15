package dz.racedz.nativeapp

import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.feature.runs.record.MidRunCoachButton
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Review P1: the mid-run "Ask the coach" pill measured ~36 dp tall. The node TalkBack and touch
 * use — the merged, clickable button — must be at least 48 dp, with a button role and one click.
 */
@RunWith(AndroidJUnit4::class)
class MidRunCoachButtonTouchTargetTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun coachButtonIsAtLeast48dpAndOneAccessibleButton() {
        var clicks = 0
        compose.setContent { MidRunCoachButton(onOpen = { clicks++ }) }
        val label = InstrumentationRegistry.getInstrumentation().targetContext.getString(R.string.runs_coach_ask)

        // useUnmergedTree = false: the merged node is what accessibility services see and focus.
        val button = compose.onNodeWithText(label)
        button
            .assertHeightIsAtLeast(48.dp)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick))
            .performClick()
        compose.runOnIdle { assertEquals(1, clicks) }
    }
}
