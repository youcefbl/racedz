plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "dz.racedz.nativeapp.core.network"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        // The API base URL is a build-config value, not a runtime setting: a debug build talks to
        // the developer's machine (10.0.2.2 is the emulator's alias for the host loopback), and a
        // release build is pinned to HTTPS production. There is deliberately no in-app "server URL"
        // field — that would be a way to point a real user's session at an attacker's host.
        buildConfigField("String", "API_BASE_URL", "\"https://zidrun.com/\"")
        buildConfigField("boolean", "ALLOW_CLEARTEXT", "false")
    }

    buildTypes {
        debug {
            // Overridable for DEBUG only (-Pzidrun.debugApiBase=http://<host-ip>:3003/): the
            // emulator reaches the dev machine at 10.0.2.2, but a physical device on USB
            // tethering/Wi-Fi needs the host's LAN address. Release stays pinned to production —
            // the no-runtime-server-field rule above is untouched.
            val debugApiBase = (project.findProperty("zidrun.debugApiBase") as String?) ?: "http://10.0.2.2:3003/"
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBase\"")
            buildConfigField("boolean", "ALLOW_CLEARTEXT", "true")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }

    buildFeatures { buildConfig = true }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    api(libs.kotlinx.serialization.json)
    api(libs.retrofit)
    api(libs.okhttp)
    implementation(libs.retrofit.serialization)
    debugImplementation(libs.okhttp.logging)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}
