package dz.racedz.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Reports whether the app can record a run (including with the screen off) and opens
// the app's settings so the user can grant location. Exposed to JS via
// src/lib/native/location-permission.ts.
//
// We intentionally do NOT use ACCESS_BACKGROUND_LOCATION ("Allow all the time") — the
// background-geolocation plugin records via a foreground service (persistent
// notification), which keeps GPS alive with the screen off using only "While using the
// app" location. So "screen-off ready" is simply "fine location granted".
@CapacitorPlugin(name = "BackgroundLocation")
public class BackgroundLocationPlugin extends Plugin {

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void check(PluginCall call) {
        boolean fine = granted(Manifest.permission.ACCESS_FINE_LOCATION);

        JSObject result = new JSObject();
        result.put("fine", fine);
        // No separate background grant anymore: the foreground service covers screen-off,
        // so recording is ready as soon as foreground location is granted.
        result.put("background", fine);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Exception ignored) {
            // best effort
        }
        call.resolve();
    }
}
