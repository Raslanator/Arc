/**
 * progress-daily-test-seed.js
 * TEMPORARY TEST DATA — edit/ARC.02 only.
 *
 * Seeds one varied 30-day dataset after normal state loading so the Progress
 * daily-history navigator, charts, interpretations, Timeline, Salah, and
 * cardio/swim states can all be exercised. A localStorage marker prevents
 * reseeding on every refresh.
 */

(function initProgressDailyTestSeed() {
  const MARKER = 'arc-progress-daily-test-seed-v2';
  const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const CALORIE_RATIOS = [0.78, 0.91, 0.98, 1.02, 1.13, 0.86, 1.05, 0.94, 1.18, 0.82];
  const TIMELINE_RATIOS = [1, 0.9, 0.8, 0.7, 0.5, 0.3, 0, 0.85];
  const SALAH_COUNTS = [5, 4, 3, 5, 2, 1, 0, 4];

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function keyFor(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function recentDates() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dates = [];
    for (let offset = 29; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      dates.push(date);
    }
    return dates;
  }

  function mondayPosition(date) {
    const dayIndex = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayIndex);
    return { weekKey: keyFor(monday), dayIndex };
  }

  function splitCalories(total, dayIndex) {
    const shares = [0.28, 0.31, 0.29];
    const breakfast = Math.round(total * shares[0]);
    const lunch = Math.round(total * shares[1]);
    const dinner = Math.round(total * shares[2]);
    const snack = Math.max(0, total - breakfast - lunch - dinner);
    const base = `test-${dayIndex}`;
    return [
      { id: `${base}-breakfast`, label: 'Test Breakfast', kcal: breakfast },
      { id: `${base}-lunch`, label: 'Test Lunch', kcal: lunch },
      { id: `${base}-dinner`, label: 'Test Dinner', kcal: dinner },
      { id: `${base}-snack`, label: 'Test Snack', kcal: snack },
    ].filter(entry => entry.kcal > 0);
  }

  function ensureWeek(weekKey) {
    if (!appState.gymTracker[weekKey]) {
      const days = {};
      for (let i = 0; i < 7; i++) days[i] = { cardio: false, swim: false };
      appState.gymTracker[weekKey] = { days, sauna: 0, steam: 0 };
    }
    if (!appState.gymTracker[weekKey].days) appState.gymTracker[weekKey].days = {};
    return appState.gymTracker[weekKey];
  }

  function seedData() {
    const dates = recentDates();
    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;
    const events = window.ArcSchedule && typeof window.ArcSchedule.getEvents === 'function'
      ? window.ArcSchedule.getEvents()
      : (Array.isArray(appState.timelineEvents) ? appState.timelineEvents : []);
    const eventIds = events.map(event => event.id).filter(Boolean);

    appState.calories = appState.calories || {};
    appState.timelineStatus = appState.timelineStatus || {};
    appState.prayerStatus = appState.prayerStatus || {};
    appState.gymTracker = appState.gymTracker || {};

    // Replace only the retained 30-day Progress window with deterministic test data.
    dates.forEach((date, index) => {
      const key = keyFor(date);

      // Every 8th day deliberately has no calorie log so "No data" is testable.
      if (index % 8 === 0) {
        delete appState.calories[key];
      } else {
        const ratio = CALORIE_RATIOS[index % CALORIE_RATIOS.length];
        const total = Math.round(target * ratio);
        appState.calories[key] = splitCalories(total, index);
      }

      // Every 9th day is deliberately untracked; other days range 0–100%.
      if (index % 9 === 0 || !eventIds.length) {
        delete appState.timelineStatus[key];
      } else {
        const ratio = TIMELINE_RATIOS[index % TIMELINE_RATIOS.length];
        const doneCount = Math.round(eventIds.length * ratio);
        const bucket = {};
        eventIds.forEach((id, eventIndex) => {
          bucket[id] = {
            done: eventIndex < doneCount,
            mode: 'test',
            time: null,
          };
        });
        appState.timelineStatus[key] = bucket;
      }

      // Every 10th day is untracked; otherwise range from 0/5 to 5/5.
      if (index % 10 === 0) {
        delete appState.prayerStatus[key];
      } else {
        const count = SALAH_COUNTS[index % SALAH_COUNTS.length];
        const bucket = {};
        PRAYERS.forEach((name, prayerIndex) => {
          bucket[name] = prayerIndex < count;
        });
        appState.prayerStatus[key] = bucket;
      }

      const position = mondayPosition(date);
      const week = ensureWeek(position.weekKey);
      week.days[position.dayIndex] = {
        cardio: index % 3 !== 0,
        swim: index % 4 === 0 || index % 5 === 0,
      };
    });

    // Give every retained tracker week realistic weekly recovery totals too.
    Object.keys(appState.gymTracker).forEach((weekKey, index) => {
      const week = appState.gymTracker[weekKey];
      if (!week) return;
      week.sauna = 2 + (index % 3);
      week.steam = 1 + (index % 2);
    });

    appState.activeTab = 'progress';
    saveState();
  }

  const baseLoadState = loadState;
  loadState = function loadStateWithProgressDailyTestSeed() {
    baseLoadState();
    if (localStorage.getItem(MARKER) === '1') return;
    seedData();
    try { localStorage.setItem(MARKER, '1'); } catch (e) { /* non-fatal */ }
  };
})();
