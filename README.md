# Echo Show 5 Kanji Dashboard

A kiosk dashboard for a LineageOS-flashed Amazon Echo Show 5 (2021): one kanji
flashcard per hour, Tokyo/Paris clocks, and Tokyo weather with a 12h forecast
timeline. Ships as a tiny native Android app with no backend — the dashboard
is a single HTML/CSS/JS page embedded directly in the APK.

## Features

- **Kanji of the hour** — advances automatically once per hour, 8h–18h Paris
  time only, looping through 2398 kanji ordered by frequency. Shows the
  character, on/kun readings, meaning (FR), an example word, and a progress
  counter. Swipe left/right on the kanji card to skip forward/back manually
  (e.g. if you already know the one shown).
- **Clocks** — Tokyo (primary) and Paris (secondary), both computed from
  explicit IANA time zones in JS, independent of whatever timezone the device
  itself is (mis)configured with.
- **Weather** — current conditions for Tokyo plus a 5-point timeline (now,
  +3h, +6h, +9h, +12h), from [Open-Meteo](https://open-meteo.com) (no API
  key required).
- **Progress and kanji position persist** across app restarts via
  `localStorage`.
- **Fully autonomous** — set as the device's default launcher, draws over
  the lock screen, and comes back up on its own after any reboot or power
  cycle. No companion app, no local server, nothing to restart by hand.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js`, `kanji_data.js` | Dashboard source (plain web page) |
| `build.py` | Inlines CSS/JS into one `index_standalone.html` |
| `android-app/` | Native Android wrapper — a single `WebView` Activity that loads the standalone page from its own assets |

`index_standalone.html` and `android-app/app/src/main/assets/index.html` are
both generated, not committed (see `.gitignore`).

## Data source

`kanji_data.js` comes from the `elecrow` project's data pipeline
(`gen_kanji_data.py` / `gen_examples.py`), which parses KANJIDIC2 and JMdict
(EDRDG) to rank kanji by frequency and attach an example word to each one.

## Building and deploying

Requires a JDK, Gradle, and the Android SDK (`platform-tools`,
`platforms;android-35`, `build-tools;35.0.0` — set `sdk.dir` in
`android-app/local.properties`).

```sh
python3 build.py
cp index_standalone.html android-app/app/src/main/assets/index.html
cd android-app && gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell cmd package set-home-activity com.echo5.kanjidash/.MainActivity
```

`set-home-activity` doesn't always survive a reboot on its own — if the
device shows a "select home app" prompt after rebooting once, pick **Kanji
Dashboard → Always** there, which does persist.

## Why a native app instead of a browser

The first version of this ran in a kiosk browser
([kiFOSSk](https://f-droid.org/packages/com.shinydiscoballsdev.kifossk))
pointed at a page served by a tiny local HTTP server
([lWS](https://f-droid.org/packages/net.basov.lws.fdroid)). That worked, but
neither app can restart itself after a reboot without root (which this
device doesn't have), so the dashboard needed a manual relaunch of the
server every time the device lost power. A plain `file://` URL doesn't work
around this either — kiFOSSk's reachability check doesn't handle it.

The native app sidesteps all of it: the page is bundled as an Android asset
(no server needed), and being the default launcher is enough for Android to
start it automatically on every boot — the same mechanism that made kiFOSSk
itself launch reliably, just without the separate server app that couldn't.

## Customizing

Weather location, kanji schedule window, and refresh intervals are all
constants at the top of `app.js`.
