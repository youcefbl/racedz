package dz.racedz.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Lets the run recorder exempt ZidRun from Doze/battery optimization so the GPS
// foreground service keeps recording while the screen is off. Registered in
// MainActivity; exposed to JS via src/lib/native/battery.ts.
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    private boolean isIgnoring() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        Context context = getContext();
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm == null) {
            return true;
        }
        return pm.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ignoring", isIgnoring());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (isIgnoring()) {
            JSObject ret = new JSObject();
            ret.put("ignoring", true);
            call.resolve(ret);
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
        } catch (Exception e) {
            // Some OEMs gate this dialog; fall back to the battery settings screen.
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception ignored) {
                // nothing else to try
            }
        }

        // The dialog is async; report the current (pre-dialog) state. The JS side
        // re-checks once the app resumes.
        JSObject ret = new JSObject();
        ret.put("ignoring", isIgnoring());
        call.resolve(ret);
    }
}
