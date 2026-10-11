// ---- Config ----
const SCHEDULE_TZ = 'Europe/Paris'; // display clocks only; scheduling uses device-local time
const TOKYO_LAT = 35.6895;
const TOKYO_LON = 139.6917;
const WEATHER_REFRESH_MS = 30 * 60 * 1000; // 30 min

const STORAGE_KEY = 'kanjiDashboardState';
const SETTINGS_KEY = 'kanjiDashboardSettings';
const KNOWN_KEY = 'kanjiDashboardKnown';

const DEFAULT_SETTINGS = { kanjiPerDay: 10, windowStart: 8, windowEnd: 18 };

const KANJI_BY_CHAR = new Map(KANJI_DATA.map((e) => [e.kanji, e]));

// ---- Persistence ----

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted or unavailable, fall through */ }
  return { index: 0, lastDay: null, advancesToday: 0 };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* storage unavailable, state just won't persist */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { /* corrupted or unavailable, fall through */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* storage unavailable */ }
}

function loadKnown() {
  try {
    const raw = localStorage.getItem(KNOWN_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (e) { /* corrupted or unavailable, fall through */ }
  return new Set();
}

function saveKnown(knownSet) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([...knownSet]));
  } catch (e) { /* storage unavailable */ }
}

let state = loadState();
let settings = loadSettings();
let known = loadKnown();

// ---- Kanji scheduling ----
// N kanji/day, spread evenly across a configurable local-time window.
// Progress within "today" is tracked as a count (advancesToday) compared
// against how far through the window we are, rather than ticking once an
// hour, so it generalizes to any kanjiPerDay/window combination.

function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function expectedAdvancesNow() {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = settings.windowStart * 60;
  const endMin = settings.windowEnd * 60;
  if (nowMin <= startMin) return 0;
  if (nowMin >= endMin) return settings.kanjiPerDay;
  const fraction = (nowMin - startMin) / (endMin - startMin);
  return Math.floor(fraction * settings.kanjiPerDay);
}

function nextValidIndex(fromIndex, direction) {
  let idx = fromIndex;
  for (let i = 0; i < KANJI_DATA.length; i++) {
    idx = (idx + direction + KANJI_DATA.length) % KANJI_DATA.length;
    if (!known.has(KANJI_DATA[idx].kanji)) return idx;
  }
  return fromIndex; // everything is blacklisted; nowhere to go
}

function renderKanji() {
  const entry = KANJI_DATA[state.index % KANJI_DATA.length];

  document.getElementById('kanjiChar').textContent = entry.kanji;
  document.getElementById('onYomi').textContent = entry.on_yomi.join('、') || '—';
  document.getElementById('kunYomi').textContent = entry.kun_yomi.join('、') || '—';

  const meanings = (entry.meaning_fr && entry.meaning_fr.length) ? entry.meaning_fr : entry.meaning_en;
  document.getElementById('meaning').textContent = meanings.join(', ');

  if (entry.example_word) {
    document.getElementById('exampleWord').textContent = entry.example_word;
    document.getElementById('exampleReading').textContent = entry.example_reading || '';
    document.getElementById('exampleMeaning').textContent = entry.example_meaning || '';
  } else {
    document.getElementById('exampleWord').textContent = '';
    document.getElementById('exampleReading').textContent = '';
    document.getElementById('exampleMeaning').textContent = '';
  }

  document.getElementById('progress').textContent =
    `${(state.index % KANJI_DATA.length) + 1} / ${KANJI_DATA.length}`;
}

const SWIPE_DEBOUNCE_MS = 400; // guards against duplicate touch events from flaky digitizer drivers
let lastSwipeAt = 0;

function manualAdvance(direction) {
  const now = Date.now();
  if (now - lastSwipeAt < SWIPE_DEBOUNCE_MS) return;
  lastSwipeAt = now;

  state.index = nextValidIndex(state.index, direction);
  saveState(state);
  renderKanji();
}

function markCurrentAsKnown() {
  const entry = KANJI_DATA[state.index % KANJI_DATA.length];
  known.add(entry.kanji);
  saveKnown(known);
  state.index = nextValidIndex(state.index, 1);
  saveState(state);
  renderKanji();
}

function setupSwipeGestures() {
  const panel = document.querySelector('.kanji-panel');
  const SWIPE_THRESHOLD = 50; // px
  let startX = null;

  panel.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  panel.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const deltaX = e.clientX - startX;
    startX = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    // swipe left (deltaX < 0) -> next kanji, swipe right -> previous kanji
    manualAdvance(deltaX < 0 ? 1 : -1);
  });
}

function tickSchedule() {
  const today = localDateString();
  const isFirstRun = state.lastDay === null;
  const isNewDay = state.lastDay !== today;

  if (isNewDay) {
    state.lastDay = today;
    state.advancesToday = 0;
  }

  const expected = expectedAdvancesNow();

  if (isFirstRun) {
    // don't replay the whole day's worth of advances on first ever launch;
    // just establish today's baseline and start accumulating from here
    state.advancesToday = expected;
    saveState(state);
    renderKanji();
    return;
  }

  let advanced = false;
  while (state.advancesToday < expected) {
    state.index = nextValidIndex(state.index, 1);
    state.advancesToday++;
    advanced = true;
  }

  if (advanced || isNewDay) {
    saveState(state);
    renderKanji();
  }
}

// ---- Clocks ----

function updateClocks() {
  const now = new Date();

  const parisTime = new Intl.DateTimeFormat('fr-FR', {
    timeZone: SCHEDULE_TZ, hour: '2-digit', minute: '2-digit',
  }).format(now);
  const tokyoTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit',
  }).format(now);
  const tokyoDate = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Asia/Tokyo', weekday: 'long', day: 'numeric', month: 'long',
  }).format(now);

  document.getElementById('parisTime').textContent = parisTime;
  document.getElementById('tokyoTime').textContent = tokyoTime;
  document.getElementById('tokyoDate').textContent = tokyoDate;
}

// ---- Weather (Open-Meteo, no API key) ----

const WEATHER_ICONS = {
  0: ['☀️', 'ciel dégagé'],
  1: ['🌤️', 'plutôt dégagé'],
  2: ['⛅', 'partiellement nuageux'],
  3: ['☁️', 'couvert'],
  45: ['🌫️', 'brouillard'],
  48: ['🌫️', 'brouillard givrant'],
  51: ['🌦️', 'bruine légère'],
  53: ['🌦️', 'bruine'],
  55: ['🌦️', 'bruine forte'],
  61: ['🌧️', 'pluie légère'],
  63: ['🌧️', 'pluie'],
  65: ['🌧️', 'pluie forte'],
  71: ['🌨️', 'neige légère'],
  73: ['🌨️', 'neige'],
  75: ['❄️', 'neige forte'],
  80: ['🌦️', 'averses légères'],
  81: ['🌧️', 'averses'],
  82: ['⛈️', 'averses violentes'],
  95: ['⛈️', 'orage'],
  96: ['⛈️', 'orage + grêle'],
  99: ['⛈️', 'orage violent'],
};

const TIMELINE_STEP_HOURS = 3;
const TIMELINE_POINTS = 5; // now, +3h, +6h, +9h, +12h

const WEATHER_RETRY_BASE_MS = 5 * 1000;
const WEATHER_RETRY_MAX_MS = 2 * 60 * 1000;
let weatherRetryDelayMs = WEATHER_RETRY_BASE_MS;
let weatherRetryTimer = null;

function renderWeatherTimeline(hourly, startIndex) {
  const container = document.getElementById('weatherTimeline');
  container.innerHTML = '';

  for (let i = 0; i < TIMELINE_POINTS; i++) {
    const idx = startIndex + i * TIMELINE_STEP_HOURS;
    if (idx >= hourly.time.length) break;

    const timeLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tokyo', hour: '2-digit', hourCycle: 'h23',
    }).format(new Date(hourly.time[idx] + ':00+09:00'));

    const code = hourly.weathercode[idx];
    const [icon] = WEATHER_ICONS[code] || ['❓'];
    const temp = Math.round(hourly.temperature_2m[idx]);

    const cell = document.createElement('div');
    cell.className = 'timeline-cell';
    cell.innerHTML = `
      <div class="timeline-hour">${i === 0 ? 'now' : timeLabel + 'h'}</div>
      <div class="timeline-icon">${icon}</div>
      <div class="timeline-temp">${temp}°</div>
    `;
    container.appendChild(cell);
  }
}

async function updateWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${TOKYO_LAT}&longitude=${TOKYO_LON}&current_weather=true&hourly=temperature_2m,weathercode&timezone=Asia%2FTokyo`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const cw = data.current_weather;
    const [icon, desc] = WEATHER_ICONS[cw.weathercode] || ['❓', 'inconnu'];

    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherTemp').textContent = `${Math.round(cw.temperature)}°C`;
    document.getElementById('weatherDesc').textContent = desc;

    const currentHourSlot = cw.time.replace(/:\d{2}$/, ':00');
    const startIndex = data.hourly.time.indexOf(currentHourSlot);
    if (startIndex !== -1) {
      renderWeatherTimeline(data.hourly, startIndex);
    }
    weatherRetryDelayMs = WEATHER_RETRY_BASE_MS; // reset backoff after a success
  } catch (e) {
    // keep last known values on screen; retry soon instead of waiting for
    // the next 30-min cycle (the first fetch at boot often loses this race
    // against WiFi reconnecting, so a single failure shouldn't mean a
    // 30-minute wait before trying again)
    console.warn('Weather fetch failed:', e);
    clearTimeout(weatherRetryTimer);
    weatherRetryTimer = setTimeout(updateWeather, weatherRetryDelayMs);
    weatherRetryDelayMs = Math.min(weatherRetryDelayMs * 2, WEATHER_RETRY_MAX_MS);
  }
}

// ---- Settings panel ----

function renderKnownList() {
  document.getElementById('knownCount').textContent = known.size;
  const container = document.getElementById('knownList');
  container.innerHTML = '';

  if (known.size === 0) {
    container.innerHTML = '<div class="known-list-empty">Aucun pour l\'instant</div>';
    return;
  }

  // most recently added first
  for (const kanji of [...known].reverse()) {
    const entry = KANJI_BY_CHAR.get(kanji);
    const meaning = entry
      ? ((entry.meaning_fr && entry.meaning_fr.length) ? entry.meaning_fr : entry.meaning_en).join(', ')
      : '';

    const item = document.createElement('div');
    item.className = 'known-item';
    item.innerHTML = `
      <span class="k">${kanji}</span>
      <span class="m">${meaning}</span>
      <button type="button" aria-label="Retirer">✕</button>
    `;
    item.querySelector('button').addEventListener('click', () => {
      known.delete(kanji);
      saveKnown(known);
      renderKnownList();
    });
    container.appendChild(item);
  }
}

function openSettings() {
  document.getElementById('kanjiPerDayInput').value = settings.kanjiPerDay;
  document.getElementById('windowStartInput').value = settings.windowStart;
  document.getElementById('windowEndInput').value = settings.windowEnd;
  renderKnownList();
  document.getElementById('settingsOverlay').hidden = false;
}

function closeSettings() {
  const perDay = parseInt(document.getElementById('kanjiPerDayInput').value, 10);
  const start = parseInt(document.getElementById('windowStartInput').value, 10);
  const end = parseInt(document.getElementById('windowEndInput').value, 10);

  if (Number.isFinite(perDay) && perDay >= 1 && perDay <= 50) settings.kanjiPerDay = perDay;
  if (Number.isFinite(start) && start >= 0 && start <= 23) settings.windowStart = start;
  if (Number.isFinite(end) && end >= 1 && end <= 24) settings.windowEnd = end;
  if (settings.windowEnd <= settings.windowStart) settings.windowEnd = settings.windowStart + 1;

  saveSettings(settings);
  document.getElementById('settingsOverlay').hidden = true;
}

function setupSettingsUI() {
  document.getElementById('gearBtn').addEventListener('click', openSettings);
  document.getElementById('settingsCloseBtn').addEventListener('click', closeSettings);
  document.getElementById('knownBtn').addEventListener('click', markCurrentAsKnown);
  document.getElementById('settingsOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'settingsOverlay') closeSettings();
  });
}

// ---- Boot ----

renderKanji();
tickSchedule();
updateClocks();
updateWeather();
setupSwipeGestures();
setupSettingsUI();

setInterval(updateClocks, 1000);
setInterval(tickSchedule, 15 * 1000);
setInterval(updateWeather, WEATHER_REFRESH_MS);
