package dz.racedz.app;

import android.annotation.TargetApi;
import android.os.Build;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

// Keeps the app alive when the WebView renderer is killed (usually out of memory).
// Without this, Android terminates the whole app process. Extends Capacitor's
// BridgeWebViewClient so all normal navigation/scheme handling is preserved.
//
// BETA: shows a friendly recovery page with a Reload button. To make recovery
// silent later, replace the loadDataWithBaseURL(...) call with view.reload().
public class RecoveryWebViewClient extends BridgeWebViewClient {

    public RecoveryWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    @TargetApi(Build.VERSION_CODES.O)
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        try {
            view.loadDataWithBaseURL("https://zidrun.com", RECOVERY_HTML, "text/html", "utf-8", null);
        } catch (Exception ignored) {
            // If we somehow can't reload, returning true still prevents the crash.
        }
        return true; // handled — do NOT let Android kill the app process
    }

    private static final String RECOVERY_HTML =
        "<!doctype html><html><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<style>html,body{height:100%;margin:0}"
            + "body{display:flex;align-items:center;justify-content:center;background:#0c1116;color:#f2ddff;"
            + "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}"
            + ".card{max-width:32ch}h1{font-size:20px;margin:0 0 14px}p{opacity:.85;line-height:1.5;margin:6px 0}"
            + "a{display:inline-block;margin-top:22px;padding:13px 24px;border-radius:12px;background:#15803D;"
            + "color:#fff;text-decoration:none;font-weight:700}.sm{font-size:12px;opacity:.6;margin-top:18px}</style>"
            + "</head><body><div class=\"card\">"
            + "<h1>ZidRun</h1>"
            + "<p>The app needs to reload.</p>"
            + "<p dir=\"rtl\">يحتاج التطبيق إلى إعادة التحميل.</p>"
            + "<p>L'application doit se recharger.</p>"
            + "<a href=\"https://zidrun.com\">Reload &middot; إعادة &middot; Recharger</a>"
            + "<p class=\"sm\">If this keeps happening, close and reopen the app.</p>"
            + "</div></body></html>";
}
