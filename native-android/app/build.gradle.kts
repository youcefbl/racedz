plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
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
        versionCode = 6
        versionName = "0.6.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            // Keeps the evaluation build installable next to a release build, and makes it obvious
            // on the launcher which one is which.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
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
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
