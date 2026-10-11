package com.echo5.kanjidash;

import android.content.Context;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Builds the WebView that every entry point (kiosk Activity, preview Activity,
 *  screensaver) loads the same bundled dashboard page into. */
final class DashboardWebView {

    private DashboardWebView() {}

    static WebView create(Context context) {
        WebView webView = new WebView(context);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("file:///android_asset/index.html");
        return webView;
    }
}
