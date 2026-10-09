# Echo Show 5 Kanji Dashboard

A kiosk dashboard for a LineageOS-flashed Amazon Echo Show 5 (2021): one kanji
flashcard per hour, Tokyo/Paris clocks, and Tokyo weather with a 12h forecast
timeline. Runs as a single static web page, no backend of its own.

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
- **Progress and kanji position persist** across page reloads via
  `localStorage`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | Layout and styling |
| `app.js` | Scheduling, clocks, weather fetch, swipe handling |
| `kanji_data.js` | The 2398-kanji dataset as a JS variable (`KANJI_DATA`) |
| `build.py` | Inlines the three files above into `index_standalone.html` |

`index_standalone.html` is generated, not committed (see `.gitignore`).

## Data source

`kanji_data.js` comes from the `elecrow` project's data pipeline
(`gen_kanji_data.py` / `gen_examples.py`), which parses KANJIDIC2 and JMdict
(EDRDG) to rank kanji by frequency and attach an example word to each one.

## Deploying to the device

The Echo Show 5 has no browser and no Play Services. The setup used here:

1. **[kiFOSSk](https://f-droid.org/packages/com.shinydiscoballsdev.kifossk)**
   — a FOSS kiosk browser, set as the Android launcher, pointed at a URL.
2. **[lWS](https://f-droid.org/packages/net.basov.lws.fdroid)** — a tiny
   local HTTP server, serving the dashboard from the device's own storage.

A local HTTP server is required instead of a plain `file://` URL: kiFOSSk's
reachability check doesn't handle `file://`, and `index_standalone.html`
exists so the whole dashboard ships as one file for a single `adb push`.

```sh
python3 build.py
adb push index_standalone.html \
  /storage/emulated/0/Android/data/net.basov.lws.fdroid/files/html/index.html
```

Then in lWS, tap **Start** (document root already points at that folder by
default). Note the address it prints — **lWS binds to the WiFi interface
IP, not `127.0.0.1`**, so use that address (e.g. `192.168.x.x:8080`), not
localhost.

In kiFOSSk, set **Dashboard URL** to `http://<that-ip>:8080/index.html`,
enable **Launcher** (boots on startup) and **Auto-Refresh** (15 min, the
app's max interval — kanji advancement itself doesn't depend on this, it's
just a safety-net reload).

## Known limitations

- lWS does not auto-start on boot; after a device reboot it must be
  reopened and started manually before kiFOSSk will show anything.
- The device's WiFi IP can change if the DHCP lease changes, which would
  break the URL configured in kiFOSSk. A static IP/DHCP reservation on the
  router avoids this.

## Customizing

Weather location, kanji schedule window, and refresh intervals are all
constants at the top of `app.js`.
