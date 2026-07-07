package dz.racedz.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BatteryOptimizationPlugin.class);
        registerPlugin(BackgroundLocationPlugin.class);
        registerPlugin(StepCounterPlugin.class);
        super.onCreate(savedInstanceState);
        // Recover gracefully (silently reload) if the WebView renderer is killed,
        // instead of letting Android terminate the whole app.
        getBridge().getWebView().setWebViewClient(new RecoveryWebViewClient(getBridge()));
    }

    // Free the WebView's in-memory cache when Android signals memory pressure or when the
    // app is backgrounded. This lowers our footprint so the renderer is less likely to be
    // OOM-killed (which is what triggers the "app needs to reload" recovery).
    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= TRIM_MEMORY_UI_HIDDEN) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.clearCache(false); // drop the RAM cache, keep the disk cache
            }
        }
    }
}
