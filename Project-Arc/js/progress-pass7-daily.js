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
        <div>
          <span class="progress-daily-kicker">Daily history · 30 days</span>
          <h3 id="progressDailyDateLabel">Today</h3>
          <p id="progressDailyDateMeta">Select any date in the retained history window.</p>
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
      <div class="progress-daily-integration" id="progressDailyIntegration"></div>
    `;

    summary.parentNode.insertBefore(panel, summary);

    document.getElementById('progressDayOlder').addEventListener('click', () => shiftSelectedDay(-1));
    document.getElementById('progressDayNewer').addEventListener('click', () => shiftSelectedDay(1));
    document.getElementById('progressDayToday').addEventListener('click', () => {
      selectedDateKey = newestKey();
      renderDailyHistory();
    });
    document.getElementById('progressDatePicker').addEventListener('change', event => {
      const keys = historyKeys();
      if (keys.includes(event.target.value)) selectedDateKey = event.target.value;
      renderDailyHistory();
    });
  }

  function shiftSelectedDay(direction) {
    const keys = historyKeys();
    const current = clampSelectedDate();
    const index = keys.indexOf(current);
    const nextIndex = Math.max(0, Math.min(keys.length - 1, index + direction));
    selectedDateKey = keys[nextIndex];
    renderDailyHistory();
  }

  function formatFullDate(key) {
    const date = dateFromKey(key);
    if (!date) return key;
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
        meaning: 'No calorie data was logged for this day.',
        status: 'no-data',
        total,
        target,
        entries,
      };
    }

    const ratio = target > 0 ? total / target : 0;
    let status = 'on';
    let meaning = `Within the 90–105% target range (${target.toLocaleString()} kcal).`;
    if (ratio < TARGET_LOW_RATIO) {
      status = 'under';
      meaning = `${(target - total).toLocaleString()} kcal below the daily target.`;
    } else if (ratio > TARGET_HIGH_RATIO) {
      status = 'over';
      meaning = `${(total - target).toLocaleString()} kcal above the daily target.`;
    }

    return {
      value: `${total.toLocaleString()} kcal`,
      detail: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · target ${target.toLocaleString()}`,
      meaning,
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
        meaning: 'No Daily Timeline completion was recorded for this date.',
        percent: null,
        done: 0,
        total: eventIds.length,
      };
    }

    const done = eventIds.filter(id => bucket[id] && bucket[id].done !== false).length;
    const pct = Math.round((done / eventIds.length) * 100);
    let meaning = `${done} of ${eventIds.length} current Timeline events were marked done.`;
    if (pct >= 90) meaning = `High Timeline consistency: ${done} of ${eventIds.length} events completed.`;
    else if (pct >= 70) meaning = `Most Timeline events were completed: ${done} of ${eventIds.length}.`;
    else if (pct > 0) meaning = `Partial Timeline completion: ${done} of ${eventIds.length} events.`;
    else meaning = `Tracking exists, but none of the current Timeline events were marked done.`;

    return {
      value: `${pct}%`,
      detail: `${done} / ${eventIds.length} events`,
      meaning,
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
        meaning: 'No Salah completion was recorded for this date.',
        percent: null,
        done: 0,
      };
    }

    const done = PRAYERS.filter(name => !!bucket[name]).length;
    const pct = Math.round((done / PRAYERS.length) * 100);
    const missing = PRAYERS.filter(name => !bucket[name]);
    const meaning = done === PRAYERS.length
      ? 'All five daily prayers were marked complete.'
      : done === 0
        ? 'Tracking exists, but no prayers were marked complete.'
        : `${done} of 5 prayers marked complete${missing.length ? ` · not marked: ${missing.join(', ')}` : ''}.`;

    return {
      value: `${done} / 5`,
      detail: `${pct}% completion`,
      meaning,
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
      return {
        value: '—',
        detail: 'No recovery data',
        meaning: 'No recovery tracker data is available for this date.',
      };
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
        meaning: week
          ? 'No cardio or swim completion was marked for this date.'
          : 'No recovery tracker data was recorded for this week.',
        cardio,
        swim,
        week,
      };
    }

    const completed = [cardio ? 'Cardio' : null, swim ? 'Swim' : null].filter(Boolean);
    const pending = [!cardio ? 'cardio' : null, !swim ? 'swim' : null].filter(Boolean);
    let meaning = `${completed.join(' and ')} recorded for this date.`;
    if (pending.length) meaning += ` ${pending.join(' and ')} not marked.`;

    return {
      value: `${cardio ? 'Cardio ✓' : 'Cardio —'} · ${swim ? 'Swim ✓' : 'Swim —'}`,
      detail: plan ? `${plan.label} · ${plan.name}` : 'Recovery tracker',
      meaning,
      cardio,
      swim,
      week,
    };
  }

  function dailyMetricCard(label, value, detail, meaning, className) {
    return `
      <div class="progress-daily-metric ${className || ''}">
        <span class="progress-daily-metric-label">${escapeHtml(label)}</span>
        <strong class="progress-daily-metric-value">${escapeHtml(value)}</strong>
        <span class="progress-daily-metric-detail">${escapeHtml(detail)}</span>
        <p class="progress-daily-meaning">${escapeHtml(meaning)}</p>
      </div>`;
  }

  function combinedInterpretation(calories, schedule, salah, recovery) {
    const parts = [];

    if (calories.status === 'on') parts.push('Calories were within the target range.');
    else if (calories.status === 'under') parts.push('Calories were below the target range.');
    else if (calories.status === 'over') parts.push('Calories were above the target range.');
    else parts.push('Calories were not logged.');

    if (schedule.percent !== null) parts.push(`Timeline completion was ${schedule.percent}%.`);
    else parts.push('Timeline completion was not tracked.');

    if (salah.percent !== null) parts.push(`Salah completion was ${salah.done}/5.`);
    else parts.push('Salah completion was not tracked.');

    if (recovery.cardio || recovery.swim) {
      const completed = [recovery.cardio ? 'cardio' : null, recovery.swim ? 'swim' : null].filter(Boolean);
      parts.push(`${completed.join(' and ')} recorded.`);
    } else {
      parts.push('No cardio or swim completion was recorded.');
    }

    return parts.join(' ');
  }

  function renderDailyHistory() {
    ensureDailyPanel();
    const grid = document.getElementById('progressDailyGrid');
    const integration = document.getElementById('progressDailyIntegration');
    const picker = document.getElementById('progressDatePicker');
    const older = document.getElementById('progressDayOlder');
    const newer = document.getElementById('progressDayNewer');
    const todayBtn = document.getElementById('progressDayToday');
    const label = document.getElementById('progressDailyDateLabel');
    const meta = document.getElementById('progressDailyDateMeta');
    if (!grid || !integration || !picker || !older || !newer || !todayBtn || !label || !meta) return;

    const keys = historyKeys();
    const key = clampSelectedDate();
    const index = keys.indexOf(key);
    const isToday = key === keys[keys.length - 1];

    picker.min = keys[0];
    picker.max = keys[keys.length - 1];
    picker.value = key;
    older.disabled = index <= 0;
    newer.disabled = index >= keys.length - 1;
    todayBtn.disabled = isToday;

    label.textContent = isToday ? `Today · ${formatFullDate(key)}` : formatFullDate(key);
    meta.textContent = `${index + 1} of ${keys.length} retained days · oldest available ${formatFullDate(keys[0])}`;

    const calories = calorieInfo(key);
    const schedule = scheduleInfo(key);
    const salah = salahInfo(key);
    const recovery = recoveryInfo(key);

    grid.innerHTML = [
      dailyMetricCard('Calories', calories.value, calories.detail, calories.meaning, `cal-${calories.status}`),
      dailyMetricCard('Daily Timeline', schedule.value, schedule.detail, schedule.meaning, 'timeline'),
      dailyMetricCard('Salah', salah.value, salah.detail, salah.meaning, 'salah'),
      dailyMetricCard('Recovery', recovery.value, recovery.detail, recovery.meaning, 'recovery'),
    ].join('');

    integration.innerHTML = `
      <span>Daily interpretation</span>
      <p>${escapeHtml(combinedInterpretation(calories, schedule, salah, recovery))}</p>
    `;
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
