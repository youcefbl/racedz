package dz.racedz.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// App-owned Android TTS boundary. The community plugin creates its engine once
// when the WebView starts; if Android's speech service is still booting and that
// initialization fails, the plugin remains unavailable until the whole app is
// restarted. This adapter initializes on the first actual cue and deliberately
// creates a fresh engine after a failed attempt, so Test voice can recover.
@CapacitorPlugin(name = "ZidRunSpeech")
public class ZidRunSpeechPlugin extends Plugin {

    private static final long INIT_TIMEOUT_MS = 4000L;

    private final Object lock = new Object();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final List<PluginCall> waiting = new ArrayList<>();
    private final Map<String, PluginCall> active = new HashMap<>();

    private TextToSpeech engine;
    private boolean initialized = false;
    private boolean initializing = false;
    private int initGeneration = 0;

    @PluginMethod
    public void speak(PluginCall call) {
        boolean startInitialization = false;
        synchronized (lock) {
            if (initialized && engine != null) {
                speakNow(call);
                return;
            }
            waiting.add(call);
            if (!initializing) {
                initializing = true;
                startInitialization = true;
            }
        }
        if (startInitialization) {
            mainHandler.post(this::initializeEngine);
        }
    }

    private void initializeEngine() {
        final int generation;
        synchronized (lock) {
            generation = ++initGeneration;
        }

        try {
            TextToSpeech previous;
            synchronized (lock) {
                previous = engine;
                engine = null;
                initialized = false;
            }
            if (previous != null) previous.shutdown();

            TextToSpeech next = new TextToSpeech(getContext().getApplicationContext(), status -> {
                mainHandler.post(() -> finishInitialization(generation, status));
            });
            synchronized (lock) {
                engine = next;
            }
            mainHandler.postDelayed(() -> timeOutInitialization(generation), INIT_TIMEOUT_MS);
        } catch (Exception error) {
            failInitialization(generation, message(error));
        }
    }

    private void finishInitialization(int generation, int status) {
        synchronized (lock) {
            if (!initializing || generation != initGeneration) return;
        }
        if (status != TextToSpeech.SUCCESS) {
            failInitialization(generation, "Android text-to-speech is not available.");
            return;
        }

        TextToSpeech ready;
        List<PluginCall> queued;
        synchronized (lock) {
            ready = engine;
            if (ready == null) {
                failInitialization(generation, "Android text-to-speech did not initialize.");
                return;
            }
            ready.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {}

                @Override
                public void onDone(String utteranceId) {
                    finishUtterance(utteranceId, null);
                }

                @Override
                public void onError(String utteranceId) {
                    finishUtterance(utteranceId, "Android could not play this voice cue.");
                }
            });
            initialized = true;
            initializing = false;
            queued = new ArrayList<>(waiting);
            waiting.clear();
        }
        for (PluginCall call : queued) speakNow(call);
    }

    private void timeOutInitialization(int generation) {
        synchronized (lock) {
            if (!initializing || generation != initGeneration) return;
        }
        failInitialization(generation, "Android text-to-speech initialization timed out.");
    }

    private void failInitialization(int generation, String reason) {
        List<PluginCall> queued;
        TextToSpeech failed;
        synchronized (lock) {
            if (generation != initGeneration) return;
            failed = engine;
            engine = null;
            initialized = false;
            initializing = false;
            queued = new ArrayList<>(waiting);
            waiting.clear();
        }
        if (failed != null) failed.shutdown();
        for (PluginCall call : queued) call.unavailable(reason);
    }

    private void speakNow(PluginCall call) {
        mainHandler.post(() -> {
            TextToSpeech current;
            synchronized (lock) {
                current = engine;
            }
            if (current == null || !initialized) {
                call.unavailable("Android text-to-speech is not initialized.");
                return;
            }

            String text = call.getString("text", "");
            String language = call.getString("lang", "en-US");
            float rate = call.getFloat("rate", 1.0f);
            float pitch = call.getFloat("pitch", 1.0f);
            float volume = call.getFloat("volume", 1.0f);
            if (text == null || text.trim().isEmpty()) {
                call.reject("Voice cue text is empty.");
                return;
            }

            Locale locale = Locale.forLanguageTag(language == null ? "en-US" : language);
            int languageResult = current.setLanguage(locale);
            if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                call.unavailable("This language is not supported by the installed device voice.");
                return;
            }

            current.setSpeechRate(rate);
            current.setPitch(pitch);
            String utteranceId = call.getCallbackId();
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            List<PluginCall> interrupted;
            synchronized (lock) {
                // QUEUE_FLUSH is intentional (the newest coaching cue wins), but
                // Android does not reliably invoke onError for the utterance it
                // interrupts. Settle those promises ourselves so JS callers and
                // the native call map cannot leak across a long interval session.
                interrupted = new ArrayList<>(active.values());
                active.clear();
                active.put(utteranceId, call);
            }
            for (PluginCall previous : interrupted) {
                previous.reject("Voice cue was replaced by a newer cue.");
            }
            int result = current.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
            if (result == TextToSpeech.ERROR) {
                synchronized (lock) {
                    active.remove(utteranceId);
                }
                call.reject("Android could not start this voice cue.");
            }
        });
    }

    private void finishUtterance(String utteranceId, String error) {
        PluginCall call;
        synchronized (lock) {
            call = active.remove(utteranceId);
        }
        if (call == null) return;
        if (error == null) call.resolve();
        else call.reject(error);
    }

    private static String message(Exception error) {
        String value = error.getLocalizedMessage();
        return value == null || value.isEmpty() ? "Android text-to-speech failed to initialize." : value;
    }

    @Override
    protected void handleOnDestroy() {
        TextToSpeech current;
        List<PluginCall> unresolved = new ArrayList<>();
        synchronized (lock) {
            current = engine;
            engine = null;
            initialized = false;
            initializing = false;
            unresolved.addAll(waiting);
            unresolved.addAll(active.values());
            waiting.clear();
            active.clear();
        }
        if (current != null) {
            current.stop();
            current.shutdown();
        }
        for (PluginCall call : unresolved) call.reject("Text-to-speech stopped because the app closed.");
    }
}
