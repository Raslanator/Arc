/**
 * prayer.js
 * Prayer times: fetching, caching, rendering, and status tracking.
 * Uses the Aladhan API (method 5 = Egyptian General Authority of Survey).
 */

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Runtime state — populated after a successful fetch or cache hit. */
let prayerTimesToday    = null;  // { Fajr, Dhuhr, Asr, Maghrib, Isha } in "HH:MM" strings
let prayerFetchFailed   = false;
let prayerFetchInFlight = false;

/* ==========================================================================
   CACHE
   Prayer times are cached in localStorage keyed by date so the API is
   only called once per day.
   ========================================================================== */

function prayerCacheKey(d) {
  return ARC_STORAGE_KEYS.legacyPrayerCachePrefix + dateKey(d);
}

/** Remove cached prayer times for any day other than today. */
function cleanOldPrayerCache(d) {
  const todayK = prayerCacheKey(d);
  Storage.keys().forEach(k => {
    if (isLegacyArcPrayerCacheKey(k) && k !== todayK) Storage.remove(k);
  });
}

function loadCachedPrayerTimes(d) {
  return Storage.get(prayerCacheKey(d));
}

function saveCachedPrayerTimes(d, timings) {
  Storage.set(prayerCacheKey(d), timings);
}

/* ==========================================================================
   FETCH
   ========================================================================== */

async function fetchPrayerTimes(d) {
  const dateStr = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  const url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=Cairo&country=Egypt&method=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Prayer API request failed');
  const json = await res.json();
  const t = json && json.data && json.data.timings;
  if (!t) throw new Error('Malformed prayer API response');
  const timings = {};
  PRAYER_NAMES.forEach(name => { timings[name] = t[name]; });
  return timings;
}

/**
 * Ensure today's prayer times are available.
 * Serves from cache instantly when possible; falls back to a network fetch.
 * Triggers re-renders of the prayer card, timeline, and arc on completion.
 */
function ensurePrayerTimes() {
  const today = new Date();
  cleanOldPrayerCache(today);

  const cached = loadCachedPrayerTimes(today);
  if (cached) {
    prayerTimesToday  = cached;
    prayerFetchFailed = false;
    renderPrayerCard();
    renderTimeline();
    renderArc();
    return;
  }

  if (prayerFetchInFlight) return;
  prayerFetchInFlight = true;
  renderPrayerCard(); // show loading state without blocking UI

  fetchPrayerTimes(today)
    .then(timings => {
      saveCachedPrayerTimes(today, timings);
      prayerTimesToday  = timings;
      prayerFetchFailed = false;
    })
    .catch(() => {
      prayerFetchFailed = !prayerTimesToday;
    })
    .finally(() => {
      prayerFetchInFlight = false;
      renderPrayerCard();
      renderTimeline();
      renderArc();
    });
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

/** Parse a prayer time string ("HH:MM" or "HH:MM (timezone)") to minutes. */
function parsePrayerTimeToMin(str) {
  const clean = String(str).split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Normalise a stored prayer status entry.
 * Legacy saves were a plain boolean; newer saves are { done, mode, time }.
 * Returns null when not done, or { mode, time } when done.
 */
function getPrayerStatus(name, doneMap) {
  const map = doneMap !== undefined
    ? doneMap
    : ((appState.prayerStatus && appState.prayerStatus[todayKeyStr()]) || {});
  const raw = map[name];
  if (!raw) return null;
  if (raw === true) return { mode: 'on-time', time: '' };
  return raw;
}

/* ==========================================================================
   STATUS MUTATIONS
   ========================================================================== */

function markPrayerDone(name, mode, time) {
  const key = todayKeyStr();
  if (!appState.prayerStatus[key]) appState.prayerStatus[key] = {};
  appState.prayerStatus[key][name] = {
    done: true, mode, time: time || minToLabel12(nowMinutes()),
  };
  saveState();
  renderPrayerCard();
  renderTimeline();
}

function clearPrayerDone(name) {
  const key = todayKeyStr();
  if (appState.prayerStatus[key]) delete appState.prayerStatus[key][name];
  saveState();
  renderPrayerCard();
  renderTimeline();
}

/* ==========================================================================
   RENDER
   ========================================================================== */

function renderPrayerCard() {
  const el = document.getElementById('prayerTimesCard');
  if (!el) return;

  if (!prayerTimesToday) {
    el.innerHTML = prayerFetchFailed
      ? '<div class="prayer-loading">Prayer times unavailable</div>'
      : '<div class="prayer-loading">Loading prayer times&hellip;</div>';
    return;
  }

  const nowMin  = nowMinutes();
  const entries = PRAYER_NAMES.map(name => ({
    name, min: parsePrayerTimeToMin(prayerTimesToday[name]),
  }));

  let nextIdx = entries.findIndex(e => e.min > nowMin);
  if (nextIdx === -1) nextIdx = 0; // after Isha — next is tomorrow's Fajr

  let html = '<div class="prayer-grid">';
  entries.forEach((e, i) => {
    html += `<div class="prayer-item${i === nextIdx ? ' next' : ''}">
      <span class="prayer-name">${e.name}</span>
      <span class="prayer-time">${minToLabel12(e.min)}</span>
    </div>`;
  });
  html += '</div>';

  const next = entries[nextIdx];
  let diff = next.min - nowMin;
  if (diff <= 0) diff += 1440;
  const hh = Math.floor(diff / 60);
  const mm = Math.floor(diff % 60);
  html += `<div class="prayer-countdown">Next up: <b>${next.name}</b> in ${hh}h ${pad2(mm)}m</div>`;

  el.innerHTML = html;
}
