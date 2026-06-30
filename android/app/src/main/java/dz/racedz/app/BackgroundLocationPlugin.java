package dz.racedz.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Reports whether the app has the "Allow all the time" (background) location grant
// needed to keep recording a run while the screen is off, and opens the app's
// settings so the user can change it. Exposed to JS via src/lib/native/location-permission.ts.
@CapacitorPlugin(name = "BackgroundLocation")
public class BackgroundLocationPlugin extends Plugin {

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void check(PluginCall call) {
        boolean fine = granted(Manifest.permission.ACCESS_FINE_LOCATION);
        // Background location is a distinct grant on Android 10 (API 29)+. Below that,
        // foreground location is sufficient to keep recording in the background.
        boolean background = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            ? fine
            : granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION);

        JSObject result = new JSObject();
        result.put("fine", fine);
        result.put("background", background);
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
