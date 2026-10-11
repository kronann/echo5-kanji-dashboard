# Kanji Dashboard

A kanji-learning dashboard that runs as a native Android app in two places:
as a kiosk on a LineageOS-flashed Amazon Echo Show 5 (2021), and as a phone
screen saver (Android's `DreamService`, "Écran de veille"). One kanji
flashcard advances on a configurable schedule, alongside Tokyo/Paris clocks
and Tokyo weather with a 12h forecast timeline. No backend — the dashboard
is a single HTML/CSS/JS page embedded directly in the APK.

## Features

- **Kanji of the day** — advances automatically, spread evenly across a
  configurable daily window (default: 10 kanji/day, 8h–18h local time),
  looping through 2398 kanji ordered by frequency. Shows the character,
  on/kun readings, meaning (FR), an example word, and a progress counter.
  Swipe left/right on the kanji card to skip forward/back manually.
- **"Already known" list** — tap ✓ to permanently exclude the kanji on
  screen from the rotation. Manage the list (and undo mistakes) from the
  ⚙ settings panel, which also has the kanji/day and active-window
  controls. Everything persists in `localStorage`.
- **Clocks** — Tokyo (primary) and Paris (secondary), both computed from
  explicit IANA time zones in JS, independent of whatever timezone the device
  itself is (mis)configured with.
- **Weather** — current conditions for Tokyo plus a 5-point timeline (now,
  +3h, +6h, +9h, +12h), from [Open-Meteo](https://open-meteo.com) (no API
  key required).
- **Responsive layout** — wide/landscape (Echo Show) and portrait (phone)
  both ship as one page; which one renders is a plain CSS orientation
  media query, no separate build.
- **Fully autonomous on the Echo Show** — set as the device's default
  launcher, draws over the lock screen, comes back up on its own after any
  reboot or power cycle.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js`, `kanji_data.js` | Dashboard source (plain web page) |
| `build.py` | Inlines CSS/JS into one `index_standalone.html` |
| `android-app/` | Native Android wrapper (three entry points sharing the same bundled page — see below) |

`index_standalone.html` and `android-app/app/src/main/assets/index.html` are
both generated, not committed (see `.gitignore`).

## Data source

`kanji_data.js` comes from the `elecrow` project's data pipeline
(`gen_kanji_data.py` / `gen_examples.py`), which parses KANJIDIC2 and JMdict
(EDRDG) to rank kanji by frequency and attach an example word to each one.

## Android entry points

| Class | Used on | What it is |
|---|---|---|
| `MainActivity` | Echo Show | Kiosk launcher (`HOME`/`LAUNCHER`), draws over the lock screen, forced landscape |
| `PreviewActivity` | Phone | Plain launcher icon ("Kanji Dashboard" in the app drawer) — opens the dashboard in a normal window, for testing/tweaking settings without waiting for the screen saver to kick in |
| `KanjiDreamService` | Phone | The actual screen saver (`DreamService`) — `setInteractive(true)` so swipes/taps reach the dashboard instead of dismissing it on first touch |

All three just load the same bundled page via `DashboardWebView`.

## Building and deploying

Requires a JDK, Gradle, and the Android SDK (`platform-tools`,
`platforms;android-35`, `build-tools;35.0.0` — set `sdk.dir` in
`android-app/local.properties`).

```sh
python3 build.py
cp index_standalone.html android-app/app/src/main/assets/index.html
cd android-app && gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**On the Echo Show**, set it as the default launcher:

```sh
adb shell cmd package set-home-activity com.echo5.kanjidash/.MainActivity
```

This doesn't always survive a reboot on its own — if the device shows a
"select home app" prompt after rebooting once, pick **Kanji Dashboard →
Always** there, which does persist.

**On a phone**, open **Settings → Display → Screen saver** (`adb shell am
start -a android.settings.DREAM_SETTINGS` jumps straight there), turn
**Use screen saver** on, pick **Kanji Dashboard**, and set **When to
start** to taste (defaults to while charging/docked). The **Preview**
button on that screen launches the real `DreamService` immediately, which
is the fastest way to iterate without waiting for the device to actually
go idle.

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
