package dz.racedz.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BatteryOptimizationPlugin.class);
        registerPlugin(BackgroundLocationPlugin.class);
        registerPlugin(StepCounterPlugin.class);
        super.onCreate(savedInstanceState);
        // Recover gracefully (show a reload page) if the WebView renderer is killed,
        // instead of letting Android terminate the whole app.
        getBridge().getWebView().setWebViewClient(new RecoveryWebViewClient(getBridge()));
    }
}
