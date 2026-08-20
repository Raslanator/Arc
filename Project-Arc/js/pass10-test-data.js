/* ========================================================================== 
   PASS 10 — TEMPORARY VISUAL TEST DATA
   edit/ARC.04 only. Remove before Pass 10 is merged/frozen.

   The seed is intentionally conservative: it populates common read/write
   states so palette colors can be reviewed without changing app architecture.
   Fixed IDs make the seed idempotent across reloads.
   ========================================================================== */

(function seedPass10VisualTestData() {
  /* Trial 2 refinement: load the secondary ocean-blue emphasis layer after
     the main palette stylesheet so it can replace the legacy Salah purple and
     carry important-information accents consistently across every tab. */
  if (!document.querySelector('link[data-pass10-accent-emphasis]')) {
    const accentLink = document.createElement('link');
    accentLink.rel = 'stylesheet';
    accentLink.href = 'css/pass10-accent-emphasis.css';
    accentLink.dataset.pass10AccentEmphasis = 'true';
    document.head.appendChild(accentLink);
  }

  /* Color-only correction: preserve the original Arc dot design. This layer
     removes the unrequested ring/shadow while keeping the vibrant fills. */
  if (!document.querySelector('link[data-pass10-dot-style-correction]')) {
    const dotFixLink = document.createElement('link');
    dotFixLink.rel = 'stylesheet';
    dotFixLink.href = 'css/pass10-dot-style-correction.css';
    dotFixLink.dataset.pass10DotStyleCorrection = 'true';
    document.head.appendChild(dotFixLink);
  }

  const MAX_ATTEMPTS = 80;
  let attempts = 0;

  function ready() {
    return (
      typeof appState !== 'undefined' &&
      appState &&
      appState.settings &&
      typeof saveState === 'function' &&
      typeof render === 'function' &&
      typeof todayKeyStr === 'function' &&
      typeof getRecentDateKeys === 'function'
    );
  }

  function ensureCalorieEntry(dateKey, entry) {
    if (!appState.calories) appState.calories = {};
    if (!Array.isArray(appState.calories[dateKey])) appState.calories[dateKey] = [];
    if (!appState.calories[dateKey].some(item => item.id === entry.id)) {
      appState.calories[dateKey].push(entry);
    }
  }

  function ensureChange(section, entry) {
    if (!appState.changeLog) appState.changeLog = { plan: [], calories: [] };
    if (!Array.isArray(appState.changeLog[section])) appState.changeLog[section] = [];
    if (!appState.changeLog[section].some(item => item.id === entry.id)) {
      appState.changeLog[section].unshift(entry);
      appState.changeLog[section] = appState.changeLog[section].slice(0, 30);
    }
  }

  function seed() {
    if (!ready()) return false;

    const recent = getRecentDateKeys(2);
    const today = todayKeyStr();
    const yesterday = recent[1] || recent[0] || today;
    const now = new Date().toISOString();

    ensureCalorieEntry(today, {
      id: 'pass10-breakfast',
      label: 'Breakfast',
      kcal: 420,
    });
    ensureCalorieEntry(today, {
      id: 'pass10-lunch',
      label: 'Lunch',
      kcal: 650,
    });
    ensureCalorieEntry(today, {
      id: 'pass10-snack',
      label: 'Afternoon snack',
      kcal: 180,
    });

    ensureCalorieEntry(yesterday, {
      id: 'pass10-yesterday-breakfast',
      label: 'Breakfast',
      kcal: 390,
    });
    ensureCalorieEntry(yesterday, {
      id: 'pass10-yesterday-dinner',
      label: 'Dinner',
      kcal: 760,
    });

    appState.timelineStatus = appState.timelineStatus || {};
    appState.timelineStatus[today] = {
      ...(appState.timelineStatus[today] || {}),
      0: { done: true, mode: 'done' },
      1: { done: true, mode: 'done' },
      2: { done: false, mode: 'pending' },
      3: { done: false, mode: 'pending' },
    };

    appState.prayerStatus = appState.prayerStatus || {};
    appState.prayerStatus[today] = {
      ...(appState.prayerStatus[today] || {}),
      Fajr: true,
      Dhuhr: true,
      Asr: false,
      Maghrib: false,
      Isha: false,
    };

    appState.weekOverrides = appState.weekOverrides || {};
    appState.weekOverrides['w0-0-lunch'] = 'shawarma-bowl';

    if (typeof getTrackerWeek === 'function') {
      const tracker = getTrackerWeek();
      if (tracker && tracker.days) {
        tracker.days[0] = { ...(tracker.days[0] || {}), cardio: true, swim: true };
        tracker.days[1] = { ...(tracker.days[1] || {}), cardio: true, swim: false };
      }
      if (tracker) {
        tracker.sauna = Math.max(Number(tracker.sauna) || 0, 2);
        tracker.steam = Math.max(Number(tracker.steam) || 0, 1);
      }
    }

    ensureChange('calories', {
      id: 'pass10-change-calories',
      text: 'Logged “Lunch” — +650 kcal',
      ts: now,
      revert: null,
    });

    ensureChange('plan', {
      id: 'pass10-change-plan',
      text: 'Meal plan updated for visual testing',
      ts: now,
      revert: null,
    });

    appState.currentWeek = 0;
    appState.grocWeek = 0;
    appState.gymDay = 0;

    if (typeof refreshWeekPlan === 'function') refreshWeekPlan();
    saveState();
    render();

    document.documentElement.dataset.pass10TestData = 'active';
    return true;
  }

  const timer = window.setInterval(() => {
    attempts += 1;
    if (seed() || attempts >= MAX_ATTEMPTS) window.clearInterval(timer);
  }, 50);
})();
