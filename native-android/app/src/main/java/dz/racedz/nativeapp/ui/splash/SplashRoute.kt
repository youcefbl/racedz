package dz.racedz.nativeapp.ui.splash

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dz.racedz.nativeapp.R
import dz.racedz.nativeapp.core.design.ZidRunDarkColors
import dz.racedz.nativeapp.core.design.ZidRunDimens
import kotlinx.coroutines.delay
import dz.racedz.nativeapp.core.design.R as DesignR

/**
 * The in-app splash content, shown right after the system SplashScreen (Theme.ZidRunNative.Splash)
 * hands off. Always renders on the dark palette regardless of the user's chosen theme — matching
 * 01-splash-screen.png and the existing Capacitor splash — because the theme preference itself is
 * part of what session restoration resolves. No owner/environment/framework/API detail is shown
 * here (native-design/NATIVE_APP_DESIGN_FLOW.md).
 */
@Composable
fun SplashRoute(onFinished: () -> Unit) {
    val reducedMotion = rememberReducedMotionEnabled()

    LaunchedEffect(Unit) {
        // Placeholder for session/config restoration until phase 2 adds real auth state.
        delay(if (reducedMotion) 400L else 900L)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ZidRunDarkColors.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Image(
                painter = painterResource(DesignR.drawable.ic_zidrun_mark),
                contentDescription = null,
                modifier = Modifier.size(96.dp),
            )
            Spacer(modifier = Modifier.height(ZidRunDimens.spaceMd))
            Image(
                painter = painterResource(DesignR.drawable.ic_zidrun_wordmark_dark),
                contentDescription = stringResource(R.string.cd_zidrun_logo),
                modifier = Modifier.height(48.dp),
            )
            Spacer(modifier = Modifier.height(ZidRunDimens.spaceXxl))
            Text(
                text = stringResource(R.string.splash_tagline),
                color = ZidRunDarkColors.text,
                style = androidx.compose.material3.MaterialTheme.typography.bodyLarge,
            )
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = ZidRunDimens.spaceXxl * 2),
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            SplashDot(color = ZidRunDarkColors.primary, animate = !reducedMotion, delayMillis = 0)
            SplashDot(color = ZidRunDarkColors.accent, animate = !reducedMotion, delayMillis = 150)
            SplashDot(color = ZidRunDarkColors.textMuted, animate = !reducedMotion, delayMillis = 300)
        }
    }
}

@Composable
private fun SplashDot(color: Color, animate: Boolean, delayMillis: Int) {
    val alphaValue = if (animate) {
        val transition = rememberInfiniteTransition(label = "splash-dot")
        val value by transition.animateFloat(
            initialValue = 0.3f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 700, delayMillis = delayMillis, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse,
            ),
            label = "splash-dot-alpha",
        )
        value
    } else {
        1f
    }
    Box(
        modifier = Modifier
            .size(10.dp)
            .clip(CircleShape)
            .alpha(alphaValue)
            .background(color),
    )
}

/**
 * Android has no direct `prefers-reduced-motion` API; ANIMATOR_DURATION_SCALE == 0 (set via
 * Developer options / some OEM "remove animations" accessibility toggles) is the closest system
 * signal and is what most apps use as the proxy.
 */
@Composable
private fun rememberReducedMotionEnabled(): Boolean {
    val context = LocalContext.current
    return remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
