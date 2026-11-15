package dz.racedz.nativeapp.observability

import android.Manifest
import android.app.ActivityManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import androidx.core.content.ContextCompat
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

/**
 * Device facts and state that explain why recording or the app misbehaved: which phone, which OS,
 * and what the OS was doing to us (battery saver, thermal throttling, background restriction,
 * standby bucket, permissions, network). Flat scalar values only, matching the server's schema.
 *
 * Deliberately absent: location, account identity, anything about the runner. Every read is
 * guarded — a fact that throws on some OEM build is simply missing, never a crash in the reporter.
 */
object DeviceFacts {

    data class Identity(
        val manufacturer: String,
        val model: String,
        val osVersion: String,
        val sdkInt: Int,
    )

    fun identity(): Identity = Identity(
        manufacturer = Build.MANUFACTURER.orEmpty().take(80),
        model = Build.MODEL.orEmpty().take(120),
        osVersion = Build.VERSION.RELEASE.orEmpty().take(40),
        sdkInt = Build.VERSION.SDK_INT,
    )

    fun collect(context: Context, appVersion: String, versionCode: Int, buildType: String): JSONObject {
        val app = context.applicationContext
        val facts = JSONObject()
        fun put(key: String, value: () -> Any?) {
            runCatching { value() }.getOrNull()?.let { facts.put(key, it) }
        }

        put("manufacturer") { Build.MANUFACTURER }
        put("brand") { Build.BRAND }
        put("model") { Build.MODEL }
        put("device") { Build.DEVICE }
        put("sdkInt") { Build.VERSION.SDK_INT }
        put("osVersion") { Build.VERSION.RELEASE }
        put("securityPatch") { Build.VERSION.SECURITY_PATCH }
        put("appVersion") { appVersion }
        put("versionCode") { versionCode }
        put("buildType") { buildType }
        put("locale") { Locale.getDefault().toLanguageTag() }
        put("timezone") { TimeZone.getDefault().id }

        // Battery and power: the usual suspects when a phone kills a recording.
        val battery = runCatching { app.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) }.getOrNull()
        put("batteryPct") {
            val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level >= 0 && scale > 0) Math.round(level * 100f / scale) else null
        }
        put("charging") {
            val status = battery?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        }
        put("batteryTempC") { battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)?.takeIf { it != Int.MIN_VALUE }?.let { it / 10.0 } }
        val power = app.getSystemService(Context.POWER_SERVICE) as? PowerManager
        put("powerSave") { power?.isPowerSaveMode }
        put("deviceIdle") { power?.isDeviceIdleMode }
        put("interactive") { power?.isInteractive }
        put("ignoringBatteryOptimizations") { power?.isIgnoringBatteryOptimizations(app.packageName) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) put("thermalStatus") { power?.currentThermalStatus }

        val activity = app.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            put("backgroundRestricted") { activity?.isBackgroundRestricted }
            put("standbyBucket") { (app.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager)?.appStandbyBucket }
        }
        val memory = ActivityManager.MemoryInfo()
        runCatching { activity?.getMemoryInfo(memory) }
        put("memAvailMb") { memory.availMem / (1024 * 1024) }
        put("memTotalMb") { memory.totalMem / (1024 * 1024) }
        put("lowMemory") { memory.lowMemory }
        put("heapMaxMb") { Runtime.getRuntime().maxMemory() / (1024 * 1024) }
        put("freeDiskMb") { StatFs(Environment.getDataDirectory().path).availableBytes / (1024 * 1024) }

        // Location stack state (never a position).
        val location = app.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) put("locationEnabled") { location?.isLocationEnabled }
        put("gpsProviderEnabled") { location?.isProviderEnabled(LocationManager.GPS_PROVIDER) }
        fun granted(permission: String) = ContextCompat.checkSelfPermission(app, permission) == PackageManager.PERMISSION_GRANTED
        put("permFineLocation") { granted(Manifest.permission.ACCESS_FINE_LOCATION) }
        put("permCoarseLocation") { granted(Manifest.permission.ACCESS_COARSE_LOCATION) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) put("permActivityRecognition") { granted(Manifest.permission.ACTIVITY_RECOGNITION) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) put("permNotifications") { granted(Manifest.permission.POST_NOTIFICATIONS) }

        val connectivity = app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        put("network") {
            val caps = connectivity?.getNetworkCapabilities(connectivity.activeNetwork)
            when {
                caps == null -> "none"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
                else -> "other"
            }
        }
        put("networkValidated") {
            connectivity?.getNetworkCapabilities(connectivity.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }
        put("networkMetered") { connectivity?.isActiveNetworkMetered }
        return facts
    }
}
