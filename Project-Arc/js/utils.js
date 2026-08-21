/**
 * utils.js
 * Shared utility functions: IDs, time formatting, date helpers, and escaping.
 * No DOM access. No appState dependency.
 */

/* ==========================================================================
   STRING / ID HELPERS
   ========================================================================== */

/** Zero-pad a number to 2 digits. */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Generate a URL-safe slug from a string. */
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Collision-resistant IDs for newly created persistent entities.
 * Existing stored IDs are never passed through this helper or rewritten.
 */
const ArcIds = (() => {
  let fallbackCounter = 0;

  function normalizedPrefix(value) {
    const normalized = String(value || 'id')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return normalized.slice(0, 16).replace(/-+$/g, '') || 'id';
  }

  function uuidFromRandomValues(cryptoApi) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  function fallbackToken() {
    fallbackCounter = (fallbackCounter + 1) % 1679616; // 36^4
    const time = Date.now().toString(36).slice(-9);
    const counter = fallbackCounter.toString(36).padStart(4, '0');
    let random = '';
    for (let i = 0; i < 4; i++) {
      random += Math.floor(Math.random() * 0x100000000)
        .toString(16)
        .padStart(8, '0');
    }
    return `${time}-${counter}-${random}`;
  }

  function createToken() {
    let cryptoApi = null;
    try {
      cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    } catch (error) {
      // Access to crypto can itself be restricted in embedded browsers.
    }
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      try {
        const uuid = cryptoApi.randomUUID();
        if (typeof uuid === 'string' && uuid) return uuid.toLowerCase();
      } catch (error) {
        // Continue to the next available entropy source.
      }
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      try {
        return uuidFromRandomValues(cryptoApi);
      } catch (error) {
        // Very old/restricted environments still receive the fallback below.
      }
    }
    return fallbackToken();
  }

  function create(prefix) {
    return `${normalizedPrefix(prefix)}-${createToken()}`;
  }

  function createUnique(prefix, existingIds) {
    let occupied;
    try {
      occupied = new Set(existingIds || []);
    } catch (error) {
      occupied = new Set();
    }

    for (let attempt = 0; attempt < 32; attempt++) {
      const candidate = create(prefix);
      if (!occupied.has(candidate)) return candidate;
    }

    // A broken UUID implementation may return one constant value. Keep the
    // result unique without allowing an unbounded retry loop.
    const root = create(prefix);
    let suffix = 1;
    while (true) {
      const suffixText = `-${suffix++}`;
      const candidate = root.slice(0, 64 - suffixText.length) + suffixText;
      if (!occupied.has(candidate)) return candidate;
    }
  }

  return Object.freeze({ create, createUnique });
})();

/* ==========================================================================
   TIME HELPERS
   All times are represented internally as minutes-since-midnight (0–1439).
   ========================================================================== */

/**
 * Convert minutes-since-midnight to a zero-padded "HH:MM" string.
 * Wraps correctly across midnight.
 */
function minToHHMM(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60);
}

/** Parse an "HH:MM" string to minutes-since-midnight. */
function hhmmToMin(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes-since-midnight to a 12-hour label like "6:45 AM".
 * Wraps correctly across midnight.
 */
function minToLabel12(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(m)} ${ap}`;
}

/**
 * Convert a 12-hour label like "6:45 AM" to a zero-padded "HH:MM" string
 * suitable for pre-filling <input type="time">.
 */
function to24h(label12) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((label12 || '').trim());
  if (!m) return '';
  let h = parseInt(m[1], 10) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return pad2(h) + ':' + m[2];
}

/** Return the current time as minutes-since-midnight (with seconds precision). */
function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/* ==========================================================================
   DATE KEY HELPERS
   Date keys are "YYYY-MM-DD" strings used as localStorage / appState keys.
   ========================================================================== */

/** Format a Date object as a "YYYY-MM-DD" key string. */
function dateKey(d) {
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** Return today's date key. */
function todayKeyStr() {
  return dateKey(new Date());
}

/**
 * Return an array of 7 date keys for the current Mon–Sun week,
 * starting on Monday.
 */
function getWeekDateKeys() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * Return the last `n` date keys, most recent first (index 0 = today).
 */
function getRecentDateKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * Format a "YYYY-MM-DD" key as a short human-readable date like "Jun 3".
 */
function fmtShort(dstr) {
  const d = new Date(dstr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ==========================================================================
   SETTINGS HELPERS
   ========================================================================== */

/**
 * Scale a base timeline event time (relative to the default 5:00 AM / 10:00 PM
 * window) to the user's actual wake/sleep settings.
 *
 * @param {number} origT  - Original time in minutes (from TIMELINE data)
 * @param {object} settings - { wakeMin, sleepMin } from appState.settings
 */
function effectiveT(origT, settings) {
  const span0 = BASE_SLEEP - BASE_WAKE;
  const span1 = settings.sleepMin - settings.wakeMin;
  const frac  = (origT - BASE_WAKE) / span0;
  return settings.wakeMin + frac * span1;
}

/* ==========================================================================
   SECURITY HELPERS
   ========================================================================== */

/**
 * Escape a string for safe insertion into HTML context.
 * Use this whenever user-supplied or user-editable data is placed into innerHTML.
 *
 * @param {string} str
 * @returns {string} HTML-escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate that a URL is safe to open in a new tab.
 * Only allows http: and https: schemes. Returns null for anything else
 * (javascript:, data:, blob:, etc.).
 *
 * @param {string} url
 * @returns {string|null} The original URL if safe, otherwise null.
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
    return null;
  } catch (e) {
    return null;
  }
}
