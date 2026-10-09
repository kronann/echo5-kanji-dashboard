// ---- Config ----
const SCHEDULE_TZ = 'Europe/Paris';
const SCHEDULE_START_HOUR = 8;   // inclusive
const SCHEDULE_END_HOUR = 18;    // exclusive
const TOKYO_LAT = 35.6895;
const TOKYO_LON = 139.6917;
const WEATHER_REFRESH_MS = 30 * 60 * 1000; // 30 min

const STORAGE_KEY = 'kanjiDashboardState';

// ---- Kanji scheduling (mirrors elecrow firmware logic) ----

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted or unavailable, fall through */ }
  return { index: 0, lastUnitKey: null };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* storage unavailable, state just won't persist */ }
}

let state = loadState();

function parisHourNow() {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: SCHEDULE_TZ,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date());
  return parseInt(hourStr, 10);
}

function currentUnitKey() {
  return Math.floor(Date.now() / 1000 / 3600);
}

function isWithinScheduleWindow() {
  const h = parisHourNow();
  return h >= SCHEDULE_START_HOUR && h < SCHEDULE_END_HOUR;
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

  state.index = (state.index + direction + KANJI_DATA.length) % KANJI_DATA.length;
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
  const unitKey = currentUnitKey();
  if (state.lastUnitKey === unitKey) return; // same hour, nothing to do

  const isFirstRun = state.lastUnitKey === null;
  state.lastUnitKey = unitKey;

  if (!isFirstRun && isWithinScheduleWindow()) {
    state.index = (state.index + 1) % KANJI_DATA.length;
  }

  saveState(state);
  renderKanji();
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

// ---- Boot ----

renderKanji();
tickSchedule();
updateClocks();
updateWeather();
setupSwipeGestures();

setInterval(updateClocks, 1000);
setInterval(tickSchedule, 15 * 1000);
setInterval(updateWeather, WEATHER_REFRESH_MS);
