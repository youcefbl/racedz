// Root build file. This is the isolated native Android evaluation project described in
// docs/NATIVE_ANDROID_OPTION_PLAN.md (NATIVE-002). It does not affect ../android (Capacitor)
// or the Next.js app.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.android.test) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
