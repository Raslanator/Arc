/**
 * progress-pass7-daily.js
 * Pass 7 refinement — per-day Progress history and 30-day retention.
 *
 * Adds a date-addressable daily history card above the existing Progress
 * analytics. Daily history is limited to today + the previous 29 calendar days.
 */

(function initProgressDailyHistory() {
  const HISTORY_DAYS = 30;
  const TARGET_LOW_RATIO = 0.90;
  const TARGET_HIGH_RATIO = 1.05;
  const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let selectedDateKey = null;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function dateKeyLocal(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function dateFromKey(key) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function historyKeys() {
    const keys = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = HISTORY_DAYS - 1; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      keys.push(dateKeyLocal(date));
    }
    return keys;
  }

  function oldestKey() {
    return historyKeys()[0];
  }

  function newestKey() {
    const keys = historyKeys();
    return keys[keys.length - 1];
  }

  function clampSelectedDate() {
    const keys = historyKeys();
    if (!selectedDateKey || !keys.includes(selectedDateKey)) {
      selectedDateKey = keys[keys.length - 1];
    }
    return selectedDateKey;
  }

  function pruneDateBuckets(bucket) {
    if (!bucket || typeof bucket !== 'object') return;
    const allowed = new Set(historyKeys());
    Object.keys(bucket).forEach(key => {
      if (!allowed.has(key)) delete bucket[key];
    });
  }

  function pruneGymTracker() {
    if (!appState.gymTracker || typeof appState.gymTracker !== 'object') return;

    const allowed = new Set(historyKeys());
    const oldest = dateFromKey(oldestKey());
    const newest = dateFromKey(newestKey());

    Object.keys(appState.gymTracker).forEach(weekKey => {
      const monday = dateFromKey(weekKey);
      if (!monday) {
        delete appState.gymTracker[weekKey];
        return;
      }

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      if (sunday < oldest || monday > newest) {
        delete appState.gymTracker[weekKey];
        return;
      }

      const week = appState.gymTracker[weekKey];
      if (!week || !week.days) return;

      Object.keys(week.days).forEach(rawIndex => {
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0 || index > 6) return;
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + index);
        if (!allowed.has(dateKeyLocal(dayDate))) {
          week.days[rawIndex] = { cardio: false, swim: false };
        }
      });
    });
  }

  function pruneProgressHistory() {
    if (!appState || typeof appState !== 'object') return;
    if (!appState.calories || typeof appState.calories !== 'object') appState.calories = {};
    if (!appState.timelineStatus || typeof appState.timelineStatus !== 'object') appState.timelineStatus = {};
    if (!appState.prayerStatus || typeof appState.prayerStatus !== 'object') appState.prayerStatus = {};
    if (!appState.gymTracker || typeof appState.gymTracker !== 'object') appState.gymTracker = {};

    pruneDateBuckets(appState.calories);
    pruneDateBuckets(appState.timelineStatus);
    pruneDateBuckets(appState.prayerStatus);
    pruneGymTracker();
  }

  // Enforce the 30-day retention window after state load and before every save.
  const baseLoadState = loadState;
  loadState = function loadStateWithThirtyDayProgressHistory() {
    baseLoadState();
    pruneProgressHistory();
  };

  const baseSaveState = saveState;
  saveState = function saveStateWithThirtyDayProgressHistory() {
    pruneProgressHistory();
    baseSaveState();
  };

  function ensureDailyPanel() {
    const view = document.getElementById('view-progress');
    const summary = document.getElementById('progressSummaryGrid');
    if (!view || !summary || document.getElementById('progressDailyPanel')) return;

    const panel = document.createElement('div');
    panel.className = 'progress-daily-panel';
    panel.id = 'progressDailyPanel';
    panel.innerHTML = `
      <div class="progress-daily-head">
        <div class="progress-daily-date-block">
          <span class="progress-daily-kicker">Daily history · 30 days</span>
          <h3 class="progress-daily-date-line" id="progressDailyDateLabel">
            <span class="progress-daily-day-name">Saturday</span>
            <span class="progress-daily-date-text">August 15 2026</span>
          </h3>
          <p class="progress-daily-today-marker" id="progressDailyDateMeta">Today</p>
        </div>
        <div class="progress-daily-controls" aria-label="Daily history navigation">
          <button type="button" class="progress-day-nav" id="progressDayOlder" aria-label="Previous day" title="Previous day">&#8592;</button>
          <label class="progress-date-picker-wrap">
            <span>Date</span>
            <input type="date" id="progressDatePicker" aria-label="Select progress date"/>
          </label>
          <button type="button" class="progress-day-nav" id="progressDayNewer" aria-label="Next day" title="Next day">&#8594;</button>
          <button type="button" class="progress-day-today" id="progressDayToday">Today</button>
        </div>
      </div>
      <div class="progress-daily-grid" id="progressDailyGrid"></div>
    `;

    summary.parentNode.insertBefore(panel, summary);

    document.getElementById('progressDayOlder').addEventListener('click', () => shiftSelectedDay(-1));
    document.getElementById('progressDayNewer').addEventListener('click', () => shiftSelectedDay(1));
    document.getElementById('progressDayToday').addEventListener('click', () => {
      const current = clampSelectedDate();
      const next = newestKey();
      if (current === next) return;
      selectedDateKey = next;
      renderDailyHistory(1);
    });
    document.getElementById('progressDatePicker').addEventListener('change', event => {
      const keys = historyKeys();
      if (!keys.includes(event.target.value)) {
        renderDailyHistory();
        return;
      }
      const currentIndex = keys.indexOf(clampSelectedDate());
      const nextIndex = keys.indexOf(event.target.value);
      selectedDateKey = event.target.value;
      renderDailyHistory(nextIndex === currentIndex ? 0 : (nextIndex > currentIndex ? 1 : -1));
    });
  }

  function shiftSelectedDay(direction) {
    const keys = historyKeys();
    const current = clampSelectedDate();
    const index = keys.indexOf(current);
    const nextIndex = Math.max(0, Math.min(keys.length - 1, index + direction));
    if (nextIndex === index) return;
    selectedDateKey = keys[nextIndex];
    renderDailyHistory(direction);
  }

  function formatDateParts(key) {
    const date = dateFromKey(key);
    if (!date) return { dayName: key, dateText: '' };
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      dateText: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).replace(',', ''),
    };
  }

  function calorieInfo(key) {
    const entries = appState.calories && Array.isArray(appState.calories[key])
      ? appState.calories[key]
      : [];
    const total = entries.reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;

    if (!entries.length) {
      return {
        value: '—',
        detail: 'No calorie entries',
        status: 'no-data',
        total,
        target,
        entries,
      };
    }

    const ratio = target > 0 ? total / target : 0;
    let status = 'on';
    if (ratio < TARGET_LOW_RATIO) status = 'under';
    else if (ratio > TARGET_HIGH_RATIO) status = 'over';

    return {
      value: `${total.toLocaleString()} kcal`,
      detail: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · target ${target.toLocaleString()}`,
      status,
      total,
      target,
      entries,
    };
  }

  function scheduleInfo(key) {
    const events = window.ArcSchedule && typeof window.ArcSchedule.getEvents === 'function'
      ? window.ArcSchedule.getEvents()
      : (Array.isArray(appState.timelineEvents) ? appState.timelineEvents : []);
    const eventIds = events.map(event => event.id).filter(Boolean);
    const bucket = appState.timelineStatus && appState.timelineStatus[key];

    if (!bucket || !Object.keys(bucket).length || !eventIds.length) {
      return {
        value: '—',
        detail: 'No Timeline tracking',
        percent: null,
        done: 0,
        total: eventIds.length,
      };
    }

    const done = eventIds.filter(id => bucket[id] && bucket[id].done !== false).length;
    const pct = Math.round((done / eventIds.length) * 100);
    return {
      value: `${pct}%`,
      detail: `${done} / ${eventIds.length} events`,
      percent: pct,
      done,
      total: eventIds.length,
    };
  }

  function salahInfo(key) {
    const bucket = appState.prayerStatus && appState.prayerStatus[key];
    if (!bucket || !Object.keys(bucket).length) {
      return {
        value: '—',
        detail: 'No Salah tracking',
        percent: null,
        done: 0,
      };
    }

    const done = PRAYERS.filter(name => !!bucket[name]).length;
    const pct = Math.round((done / PRAYERS.length) * 100);
    return {
      value: `${done} / 5`,
      detail: `${pct}% completion`,
      percent: pct,
      done,
    };
  }

  function mondayAndDayIndex(key) {
    const date = dateFromKey(key);
    if (!date) return null;
    const index = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - index);
    return { mondayKey: dateKeyLocal(monday), dayIndex: index };
  }

  function recoveryInfo(key) {
    const position = mondayAndDayIndex(key);
    if (!position) {
      return { value: '—', detail: 'No recovery data', cardio: false, swim: false };
    }

    const week = appState.gymTracker && appState.gymTracker[position.mondayKey];
    const day = week && week.days && week.days[position.dayIndex];
    const gymDays = typeof effectiveGymDays === 'function' ? effectiveGymDays() : [];
    const plan = gymDays[position.dayIndex] || null;
    const cardio = !!(day && day.cardio);
    const swim = !!(day && day.swim);

    if (!week || (!cardio && !swim)) {
      return {
        value: '—',
        detail: plan ? `${plan.label} · ${plan.name}` : 'No recovery checks',
        cardio,
        swim,
        week,
      };
    }

    return {
      value: `${cardio ? 'Cardio ✓' : 'Cardio —'} · ${swim ? 'Swim ✓' : 'Swim —'}`,
      detail: plan ? `${plan.label} · ${plan.name}` : 'Recovery tracker',
      cardio,
      swim,
      week,
    };
  }

  function dailyMetricCard(label, value, detail, className) {
    return `
      <div class="progress-daily-metric ${className || ''}">
        <span class="progress-daily-metric-label">${escapeHtml(label)}</span>
        <strong class="progress-daily-metric-value">${escapeHtml(value)}</strong>
        <span class="progress-daily-metric-detail">${escapeHtml(detail)}</span>
      </div>`;
  }

  function animateDailyChange(direction) {
    if (!direction) return;
    const panel = document.getElementById('progressDailyPanel');
    if (!panel) return;
    panel.dataset.motion = direction < 0 ? 'older' : 'newer';
    panel.classList.remove('is-changing');
    void panel.offsetWidth;
    panel.classList.add('is-changing');
  }

  function renderDailyHistory(motionDirection) {
    ensureDailyPanel();
    const grid = document.getElementById('progressDailyGrid');
    const picker = document.getElementById('progressDatePicker');
    const older = document.getElementById('progressDayOlder');
    const newer = document.getElementById('progressDayNewer');
    const todayBtn = document.getElementById('progressDayToday');
    const label = document.getElementById('progressDailyDateLabel');
    const meta = document.getElementById('progressDailyDateMeta');
    if (!grid || !picker || !older || !newer || !todayBtn || !label || !meta) return;

    const keys = historyKeys();
    const key = clampSelectedDate();
    const index = keys.indexOf(key);
    const isToday = key === keys[keys.length - 1];
    const dateParts = formatDateParts(key);

    picker.min = keys[0];
    picker.max = keys[keys.length - 1];
    picker.value = key;
    older.disabled = index <= 0;
    newer.disabled = index >= keys.length - 1;
    todayBtn.disabled = isToday;

    label.innerHTML = `
      <span class="progress-daily-day-name">${escapeHtml(dateParts.dayName)}</span>
      <span class="progress-daily-date-text">${escapeHtml(dateParts.dateText)}</span>
    `;
    meta.textContent = 'Today';
    meta.hidden = !isToday;

    const calories = calorieInfo(key);
    const schedule = scheduleInfo(key);
    const salah = salahInfo(key);
    const recovery = recoveryInfo(key);

    grid.innerHTML = [
      dailyMetricCard('Calories', calories.value, calories.detail, `cal-${calories.status}`),
      dailyMetricCard('Daily Timeline', schedule.value, schedule.detail, 'timeline'),
      dailyMetricCard('Salah', salah.value, salah.detail, 'salah'),
      dailyMetricCard('Recovery', recovery.value, recovery.detail, 'recovery'),
    ].join('');

    animateDailyChange(motionDirection);
  }

  ensureDailyPanel();

  const baseRender = render;
  render = function renderWithDailyProgressHistory() {
    baseRender();
    renderDailyHistory();
  };

  window.ArcProgressDaily = {
    render: renderDailyHistory,
    getSelectedDate: () => clampSelectedDate(),
    getHistoryKeys: () => [...historyKeys()],
    prune: pruneProgressHistory,
  };
})();
