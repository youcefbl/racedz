import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.play.publisher)
}

// Play publishing is intentionally configured for the Internal testing track only. The service
// account credentials are read from ANDROID_PUBLISHER_CREDENTIALS by Gradle Play Publisher in CI;
// no key file belongs in this repository. Production promotion remains a deliberate Play Console
// action until the release gates and tester/device acceptance are complete.
play {
    defaultToAppBundles.set(true)
    track.set("internal")
}

/*
 * Push is wired only when this machine actually has a Firebase config.
 *
 * `google-services.json` is git-ignored (it is a per-project credential), so a fresh clone, CI, and
 * anyone building without Firebase access do not have one — and the Google Services plugin fails
 * the build outright when the file is missing, rather than degrading. Applying it conditionally
 * keeps the project buildable everywhere; ZidRunMessaging checks the same condition at runtime and
 * simply does not register a token when Firebase is absent.
 *
 * Note the plugin matches the VARIANT's full application id, so every id in use — including the
 * `.debug` suffix — must be registered in the Firebase project or its build fails.
 */
val googleServicesConfig = file("google-services.json")
if (googleServicesConfig.exists()) {
    apply(plugin = libs.plugins.google.services.get().pluginId)
    // Crashlytics is a Firebase product and its plugin needs google-services applied first, so it
    // is gated on the same file. Uploading mapping files is a release-build concern; the debug
    // variant reports unobfuscated and needs no upload.
    apply(plugin = libs.plugins.crashlytics.get().pluginId)
}

// Release signing stays OUT of the repository (docs/NATIVE_ANDROID_OPTION_PLAN.md): the upload
// keystore lives in ~/zidrun-release/ and is referenced through a properties file passed as
// -Pzidrun.signing=/path/to/upload-signing.properties (storeFile/storePassword/keyAlias/
// keyPassword). Without the property the release build type stays unsigned, exactly as before,
// so CI and contributors are unaffected.
val signingProps: Properties? = (findProperty("zidrun.signing") as String?)?.let { path ->
    val props = Properties()
    FileInputStream(path).use { stream -> props.load(stream) }
    props
}

android {
    namespace = "dz.racedz.nativeapp"
    compileSdk = 36

    defaultConfig {
        // Separate application ID from the Capacitor release (dz.racedz.app) per
        // docs/NATIVE_ANDROID_OPTION_PLAN.md — this is an isolated internal evaluation build.
        applicationId = "dz.racedz.nativeapp"
        minSdk = 26
        targetSdk = 36
        // Bumped for EVERY APK handed to a tester — see "APK versioning" in
        // docs/NATIVE_ANDROID_OPTION_PLAN.md. versionCode must increase or Android refuses the
        // install as a downgrade; versionName is what the filename is derived from, so the two can
        // never disagree. Do not reuse a number that has already left this machine.
        versionCode = 10
        versionName = "0.8.2"
        // Shown on the About screen. A deliberate constant rather than a build timestamp: a value
        // that changed on every compile would churn the build inputs and would tell a runner when
        // the APK was compiled, not when the release was made. Bump it with versionName.
        buildConfigField("String", "RELEASE_DATE", "\"2026-09-04\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    if (signingProps != null) {
        signingConfigs.create("upload") {
            storeFile = file(signingProps.getProperty("storeFile"))
            storePassword = signingProps.getProperty("storePassword")
            keyAlias = signingProps.getProperty("keyAlias")
            keyPassword = signingProps.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (signingProps != null) signingConfig = signingConfigs.getByName("upload")
        }
        debug {
            // Keeps the evaluation build installable next to a release build, and makes it obvious
            // on the launcher which one is which.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }

        // Local-only performance target. It uses release-like, non-debuggable app code while its
        // library fallbacks stay on the debug/local API configuration, so benchmarks never read or
        // mutate production. The separate id preserves the normal debug app and its test session.
        create("benchmark") {
            initWith(getByName("release"))
            applicationIdSuffix = ".benchmark"
            versionNameSuffix = "-benchmark"
            signingConfig = signingConfigs.getByName("debug")
            isDebuggable = false
            isMinifyEnabled = false
            matchingFallbacks += listOf("debug")
        }

        // Physical-device test build wired to production (https://zidrun.com), for internal
        // evaluation only.
        //
        // Signed with the DEBUG keystore on purpose: docs/NATIVE_ANDROID_OPTION_PLAN.md forbids
        // copying the production keystore into this project, and this artifact must never be
        // mistakable for something publishable. It is therefore not upgradeable to a real release
        // and cannot be uploaded to Play.
        //
        // `isDebuggable = false` matters: this build talks to real user data, and a debuggable
        // process can be attached to over adb and have its memory and its EncryptedSharedPreferences
        // read. Its own application ID keeps it from colliding with the production Capacitor app
        // (dz.racedz.app) or the emulator debug build.
        create("internal") {
            initWith(getByName("release"))
            applicationIdSuffix = ".internal"
            versionNameSuffix = "-internal"
            signingConfig = signingConfigs.getByName("debug")
            isDebuggable = false
            isMinifyEnabled = false
            // The library modules do not declare this build type; fall back to their release
            // variant, which is what carries the production API_BASE_URL.
            matchingFallbacks += "release"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        // ZidRunApplication reads BuildConfig.VERSION_NAME to report the app version on sign-in.
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    // Push (NATGAP-03). Present in the compile classpath even without google-services.json — the
    // library is inert until Firebase is initialised, which needs that file.
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.crashlytics)

    implementation(project(":core:design"))
    implementation(project(":core:network"))
    implementation(project(":core:auth"))
    implementation(project(":feature:auth"))
    implementation(project(":feature:races"))
    implementation(project(":feature:account"))
    implementation(project(":feature:registration"))
    implementation(project(":feature:runs"))
    implementation(project(":feature:coach"))
    // Coil is configured app-wide (User-Agent for OSM tiles), so the app module needs it directly.
    implementation(libs.coil.compose)
    implementation(libs.okhttp)

    val composeBom = platform(libs.compose.bom)
    implementation(composeBom)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.appcompat)
    // Only for the Theme.Material3.DayNight.NoActionBar XML parent (system splash / pre-Compose
    // window background); Compose screens use core:design's ZidRunTheme, not Material Components views.
    implementation("com.google.android.material:material:1.12.0")
    implementation(libs.androidx.activity.compose)
    // Custom Tabs: the system-browser sign-in must not run in a WebView.
    implementation(libs.androidx.browser)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    // ProcessLifecycleOwner: a single whole-app foreground/background signal, independent of
    // which Activity is on screen. Used to evict stale network connections proactively on
    // resume — see ZidRunApplication.
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.compose.ui.tooling.preview)

    debugImplementation(libs.compose.ui.tooling)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.uiautomator)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
