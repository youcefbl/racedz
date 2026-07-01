package dz.racedz.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Counts steps during a run using the hardware TYPE_STEP_COUNTER sensor so the app can
// report average cadence (steps/min). The sensor reports cumulative steps since boot;
// we capture a baseline on start() and return the delta. Best-effort: if the device has
// no step sensor or the user denies ACTIVITY_RECOGNITION, start() resolves available:false
// and the run is simply saved without cadence. Exposed to JS via src/lib/native/step-counter.ts.
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activityRecognition", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private boolean listening = false;
    private float baseline = -1f;
    private float latest = -1f;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    // ACTIVITY_RECOGNITION is a runtime permission on Android 10 (API 29)+.
    private boolean needsPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION)
            != PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (stepSensor == null) {
            resolveAvailable(call, false);
            return;
        }
        if (needsPermission()) {
            requestPermissionForAlias("activityRecognition", call, "permCallback");
            return;
        }
        startListening(call);
    }

    @PermissionCallback
    private void permCallback(PluginCall call) {
        if (needsPermission()) {
            resolveAvailable(call, false);
        } else {
            startListening(call);
        }
    }

    private void startListening(PluginCall call) {
        baseline = -1f;
        latest = -1f;
        if (!listening) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
            listening = true;
        }
        resolveAvailable(call, true);
    }

    @PluginMethod
    public void getSteps(PluginCall call) {
        JSObject result = new JSObject();
        result.put("steps", currentSteps());
        result.put("available", stepSensor != null);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        int steps = currentSteps();
        if (listening && sensorManager != null) {
            sensorManager.unregisterListener(this);
            listening = false;
        }
        JSObject result = new JSObject();
        result.put("steps", steps);
        call.resolve(result);
    }

    private int currentSteps() {
        return (baseline >= 0 && latest >= baseline) ? Math.round(latest - baseline) : 0;
    }

    private void resolveAvailable(PluginCall call, boolean available) {
        JSObject result = new JSObject();
        result.put("available", available);
        call.resolve(result);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            latest = event.values[0];
            if (baseline < 0) baseline = latest;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // no-op
    }
}
