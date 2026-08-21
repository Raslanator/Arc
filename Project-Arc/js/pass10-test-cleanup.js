/**
 * pass10-test-cleanup.js
 * One-time cleanup for deterministic visual-review data previously injected by
 * pass10-test-data.js. The cleanup runs only when a known Pass 10 seed marker
 * is detected, removes exact seeded artifacts, and leaves divergent user data
 * untouched wherever it can be distinguished safely.
 */

(function initPass10TestCleanup() {
  const CLEANUP_KEY = 'arc-pass10-test-cleanup-v1';
  const SEEDED_CALORIE_IDS = new Set([
    'pass10-breakfast',
    'pass10-lunch',
    'pass10-snack',
    'pass10-yesterday-breakfast',
    'pass10-yesterday-dinner',
  ]);
  const SEEDED_CHANGE_IDS = new Set([
    'pass10-change-calories',
    'pass10-change-plan',
  ]);

  function alreadyCleaned() {
    return !!(typeof Storage !== 'undefined' && Storage.get(CLEANUP_KEY));
  }

  function markCleaned() {
    if (typeof Storage !== 'undefined') Storage.set(CLEANUP_KEY, true);
  }

  function hasSeedSignature() {
    const calorieSeed = Object.values(appState.calories || {}).some(entries =>
      Array.isArray(entries) && entries.some(entry => SEEDED_CALORIE_IDS.has(entry && entry.id))
    );
    const changeSeed = ['plan', 'calories'].some(section =>
      Array.isArray(appState.changeLog && appState.changeLog[section])
      && appState.changeLog[section].some(entry => SEEDED_CHANGE_IDS.has(entry && entry.id))
    );
    return calorieSeed || changeSeed;
  }

  function exactTimelineSeed(bucket) {
    if (!bucket || typeof bucket !== 'object') return false;
    const expected = {
      wake: { done: true, mode: 'done' },
      'pre-workout-fuel': { done: true, mode: 'done' },
      gym: { done: false, mode: 'pending' },
      'breakfast-recovery': { done: false, mode: 'pending' },
    };
    return Object.entries(expected).every(([key, value]) => {
      const actual = bucket[key];
      return actual
        && actual.done === value.done
        && actual.mode === value.mode
        && !Object.prototype.hasOwnProperty.call(actual, 'time');
    });
  }

  function exactPrayerSeed(bucket) {
    if (!bucket || typeof bucket !== 'object') return false;
    return bucket.Fajr === true
      && bucket.Dhuhr === true
      && bucket.Asr === false
      && bucket.Maghrib === false
      && bucket.Isha === false;
  }

  function exactTrackerSeed(tracker) {
    if (!tracker || !tracker.days) return false;
    const day0 = tracker.days[0] || tracker.days['0'];
    const day1 = tracker.days[1] || tracker.days['1'];
    if (!day0 || !day1) return false;
    if (day0.cardio !== true || day0.swim !== true) return false;
    if (day1.cardio !== true || day1.swim !== false) return false;
    if (Number(tracker.sauna) !== 2 || Number(tracker.steam) !== 1) return false;

    return Object.keys(tracker.days).every(key => {
      if (String(key) === '0' || String(key) === '1') return true;
      const day = tracker.days[key] || {};
      return !day.cardio && !day.swim;
    });
  }

  function cleanupSeededState() {
    let changed = false;

    Object.keys(appState.calories || {}).forEach(dateKey => {
      const entries = Array.isArray(appState.calories[dateKey]) ? appState.calories[dateKey] : [];
      const next = entries.filter(entry => !SEEDED_CALORIE_IDS.has(entry && entry.id));
      if (next.length !== entries.length) {
        changed = true;
        if (next.length) appState.calories[dateKey] = next;
        else delete appState.calories[dateKey];
      }
    });

    ['plan', 'calories'].forEach(section => {
      const entries = Array.isArray(appState.changeLog && appState.changeLog[section])
        ? appState.changeLog[section]
        : [];
      const next = entries.filter(entry => !SEEDED_CHANGE_IDS.has(entry && entry.id));
      if (next.length !== entries.length) {
        appState.changeLog[section] = next;
        changed = true;
      }
    });

    if (appState.weekOverrides && appState.weekOverrides['w0-0-lunch'] === 'shawarma-bowl') {
      delete appState.weekOverrides['w0-0-lunch'];
      changed = true;
    }

    Object.keys(appState.timelineStatus || {}).forEach(dateKey => {
      const bucket = appState.timelineStatus[dateKey];
      if (!exactTimelineSeed(bucket)) return;
      ['wake', 'pre-workout-fuel', 'gym', 'breakfast-recovery'].forEach(key => delete bucket[key]);
      ['0', '1', '2', '3'].forEach(key => delete bucket[key]);
      if (!Object.keys(bucket).length) delete appState.timelineStatus[dateKey];
      changed = true;
    });

    Object.keys(appState.prayerStatus || {}).forEach(dateKey => {
      const bucket = appState.prayerStatus[dateKey];
      if (!exactPrayerSeed(bucket)) return;
      delete appState.prayerStatus[dateKey];
      changed = true;
    });

    Object.keys(appState.gymTracker || {}).forEach(weekKey => {
      if (!exactTrackerSeed(appState.gymTracker[weekKey])) return;
      delete appState.gymTracker[weekKey];
      changed = true;
    });

    if (changed) {
      if (typeof refreshWeekPlan === 'function') refreshWeekPlan();
      saveState();
    }
  }

  const baseLoadState = loadState;
  loadState = function loadStateWithPass10TestCleanup() {
    baseLoadState();
    if (alreadyCleaned()) return;
    if (hasSeedSignature()) cleanupSeededState();
    markCleaned();
  };
})();
