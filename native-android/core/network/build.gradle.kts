import java.net.URI

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
            val debugApiBase = resolveDebugApiBase(project.findProperty("zidrun.debugApiBase") as String?)
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

/**
 * Validates and normalizes -Pzidrun.debugApiBase at CONFIGURATION time (review FDE-R02).
 *
 * The value is interpolated into a generated Kotlin string literal and handed to Retrofit, which
 * rejects a base URL without a trailing slash at app startup — so a typo used to surface as a crash
 * on the device or as unparseable generated source, long after the mistake. Failing here names the
 * property and the problem instead.
 */
fun resolveDebugApiBase(raw: String?): String {
    val value = raw?.trim().orEmpty()
    if (value.isEmpty()) return "http://10.0.2.2:3003/"

    // Anything that could break out of the generated "..." literal is refused outright rather than
    // escaped: there is no legitimate URL containing these.
    require(value.none { it == '"' || it == '\\' || it == '$' || it.isISOControl() }) {
        "zidrun.debugApiBase contains characters that cannot appear in a URL: $value"
    }

    val uri = try {
        URI(value)
    } catch (error: Exception) {
        throw IllegalArgumentException("zidrun.debugApiBase is not a valid URI: $value", error)
    }
    require(uri.isAbsolute && (uri.scheme == "http" || uri.scheme == "https")) {
        "zidrun.debugApiBase must be an absolute http(s) URL (e.g. http://192.168.1.10:3003/), got: $value"
    }
    require(!uri.host.isNullOrBlank()) { "zidrun.debugApiBase has no host: $value" }

    // Shapes java.net.URI accepts but Retrofit/OkHttp cannot use, or that should never be baked
    // into a build artifact (review F234-R08).
    require(uri.userInfo == null) {
        "zidrun.debugApiBase must not embed credentials — they would end up in the generated BuildConfig: $value"
    }
    require(uri.query == null && uri.fragment == null) {
        "zidrun.debugApiBase must be a bare base URL with no query or fragment: $value"
    }
    // URI.getPort() returns -1 when absent; anything else must be a usable TCP port. A value such
    // as http://host:99999/ parses here but fails inside OkHttp at runtime.
    require(uri.port == -1 || uri.port in 1..65535) {
        "zidrun.debugApiBase port must be between 1 and 65535: $value"
    }

    // Retrofit requires the trailing slash; adding it is unambiguous, so normalize rather than fail.
    return if (value.endsWith("/")) value else "$value/"
}
