package com.echo5.kanjidash;

import android.os.Build;
import android.service.dreams.DreamService;
import android.view.View;

/** Android screensaver ("Écran de veille") entry point: shown while idle,
 *  typically charging/docked. Interactive so swipes and taps reach the
 *  dashboard instead of dismissing the dream on first touch. */
public class KanjiDreamService extends DreamService {

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();

        setInteractive(true);
        setFullscreen(true);
        setScreenBright(true);

        setContentView(DashboardWebView.create(this));
        applyImmersiveMode();
    }

    private void applyImmersiveMode() {
        View decorView = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            decorView.getWindowInsetsController().hide(
                    android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
            decorView.getWindowInsetsController().setSystemBarsBehavior(
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }
}
