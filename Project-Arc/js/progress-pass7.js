/**
 * progress-pass7.js
 * Pass 7 — read-only Progress analytics.
 *
 * Reads preserved calorie history, date-keyed Timeline/Salah completion, and
 * weekly recovery tracking. It never writes to appState or persistent storage.
 */

(function initProgressPass7() {
  const TARGET_LOW_RATIO = 0.90;
  const TARGET_HIGH_RATIO = 1.05;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function dateKeysEndingToday(count) {
    const keys = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = count - 1; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      keys.push(localDateKey(d));
    }
    return keys;
  }

  function dateFromKey(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  }

  function shortDay(key) {
    return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function shortDate(key) {
    return dateFromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function calorieEntries(key) {
    return (appState.calories && Array.isArray(appState.calories[key]))
      ? appState.calories[key]
      : [];
  }

  function calorieTotal(key) {
    if (window.ArcCalories && typeof window.ArcCalories.getDayTotal === 'function') {
      return window.ArcCalories.getDayTotal(key);
    }
    return calorieEntries(key).reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
  }

  function calorieRecord(key) {
    const entries = calorieEntries(key);
    return {
      key,
      total: calorieTotal(key),
      hasData: entries.length > 0,
    };
  }

  function calorieStatus(record, target) {
    if (!record.hasData) return 'no-data';
    const ratio = target > 0 ? record.total / target : 0;
    if (ratio < TARGET_LOW_RATIO) return 'under';
    if (ratio <= TARGET_HIGH_RATIO) return 'on';
    return 'over';
  }

  function averageLogged(records) {
    const logged = records.filter(record => record.hasData);
    if (!logged.length) return null;
    return Math.round(logged.reduce((sum, record) => sum + record.total, 0) / logged.length);
  }

  function calorieBreakdown(records, target) {
    const result = { under: 0, on: 0, over: 0, noData: 0, logged: 0 };
    records.forEach(record => {
      const status = calorieStatus(record, target);
      if (status === 'no-data') {
        result.noData++;
        return;
      }
      result.logged++;
      result[status]++;
    });
    return result;
  }

  function percent(done, total) {
    if (!total) return null;
    return Math.round((done / total) * 100);
  }

  function timelineHistoryForDate(key) {
    if (window.ArcTimelineHistory && typeof window.ArcTimelineHistory.getDay === 'function') {
      return window.ArcTimelineHistory.getDay(key);
    }
    const events = window.ArcSchedule && typeof window.ArcSchedule.getEvents === 'function'
      ? window.ArcSchedule.getEvents()
      : (Array.isArray(appState.timelineEvents) ? appState.timelineEvents : []);
    const bucket = appState.timelineStatus && appState.timelineStatus[key];
    const eventIds = events.map(event => event.id).filter(Boolean);
    return { tracked: !!(bucket && Object.keys(bucket).length), eventIds };
  }

  function scheduleCompletion(keys) {
    let trackedDays = 0;
    let done = 0;
    let possible = 0;
    keys.forEach(key => {
      const history = timelineHistoryForDate(key);
      if (!history.tracked) return;
      const bucket = appState.timelineStatus && appState.timelineStatus[key];
      trackedDays++;
      possible += history.eventIds.length;
      history.eventIds.forEach(id => {
        const status = bucket && bucket[id];
        if (status && status.done !== false) done++;
      });
    });

    return { percent: percent(done, possible), done, possible, trackedDays };
  }

  function salahCompletion(keys) {
    const prayerNames = Array.isArray(window.PRAYER_NAMES)
      ? window.PRAYER_NAMES
      : (typeof PRAYER_NAMES !== 'undefined' ? PRAYER_NAMES : ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);

    let trackedDays = 0;
    let done = 0;
    keys.forEach(key => {
      const bucket = appState.prayerStatus && appState.prayerStatus[key];
      if (!bucket || !Object.keys(bucket).length) return;
      trackedDays++;
      prayerNames.forEach(name => {
        if (bucket[name]) done++;
      });
    });

    const possible = trackedDays * prayerNames.length;
    return { percent: percent(done, possible), done, possible, trackedDays };
  }

  function recoverySummary() {
    const weekKey = currentTrackerWeekKey();
    const week = appState.gymTracker && appState.gymTracker[weekKey];
    if (!week) {
      return { weekKey, hasData: false, cardio: 0, swim: 0, sauna: 0, steam: 0 };
    }

    const days = week.days || {};
    const values = Object.values(days);
    return {
      weekKey,
      hasData: values.some(day => day && (day.cardio || day.swim)) || Number(week.sauna) > 0 || Number(week.steam) > 0,
      cardio: values.filter(day => day && day.cardio).length,
      swim: values.filter(day => day && day.swim).length,
      sauna: Number(week.sauna) || 0,
      steam: Number(week.steam) || 0,
    };
  }

  function metricCard(label, value, detail, className) {
    return `
      <div class="progress-metric-card ${className || ''}">
        <span class="progress-metric-label">${escapeHtml(label)}</span>
        <strong class="progress-metric-value">${escapeHtml(value)}</strong>
        <span class="progress-metric-detail">${escapeHtml(detail)}</span>
      </div>`;
  }

  function renderSummaryCards(records7, target, schedule, salah) {
    const grid = document.getElementById('progressSummaryGrid');
    if (!grid) return;

    const avg = averageLogged(records7);
    const breakdown = calorieBreakdown(records7, target);
    const adherence = breakdown.logged ? Math.round((breakdown.on / breakdown.logged) * 100) : null;

    grid.innerHTML = [
      metricCard(
        '7-Day Average',
        avg === null ? '—' : `${avg.toLocaleString()} kcal`,
        breakdown.logged ? `${breakdown.logged} logged day${breakdown.logged === 1 ? '' : 's'}` : 'No calorie history yet'
      ),
      metricCard(
        'Target Days',
        adherence === null ? '—' : `${adherence}%`,
        breakdown.logged ? `${breakdown.on} of ${breakdown.logged} logged days` : '90–105% of daily target'
      ),
      metricCard(
        'Schedule Completion',
        schedule.percent === null ? '—' : `${schedule.percent}%`,
        schedule.trackedDays ? `${schedule.done} / ${schedule.possible} · ${schedule.trackedDays} tracked day${schedule.trackedDays === 1 ? '' : 's'}` : 'No tracked days yet'
      ),
      metricCard(
        'Salah Completion',
        salah.percent === null ? '—' : `${salah.percent}%`,
        salah.trackedDays ? `${salah.done} / ${salah.possible} · ${salah.trackedDays} tracked day${salah.trackedDays === 1 ? '' : 's'}` : 'No tracked days yet'
      ),
    ].join('');
  }

  function renderSevenDayChart(records, target) {
    const chart = document.getElementById('progress7Chart');
    const meta = document.getElementById('progress7Meta');
    if (!chart || !meta) return;

    const logged = records.filter(record => record.hasData);
    if (!logged.length) {
      chart.innerHTML = '<div class="progress-empty-state">Log calories for a few days and your 7-day chart will appear here.</div>';
      meta.textContent = 'No calorie history in the last 7 days';
      return;
    }

    const maxValue = Math.max(target * 1.2, ...logged.map(record => record.total), 1);
    const targetPct = Math.max(0, Math.min(100, (target / maxValue) * 100));
    const avg = averageLogged(records);
    meta.textContent = `${logged.length} logged day${logged.length === 1 ? '' : 's'} · average ${avg.toLocaleString()} kcal`;

    chart.innerHTML = `
      <div class="progress-seven-plot">
        <span class="progress-target-line" style="bottom:${targetPct.toFixed(2)}%" aria-hidden="true"></span>
        ${records.map(record => {
          const status = calorieStatus(record, target);
          const height = record.hasData ? Math.max(3, (record.total / maxValue) * 100) : 0;
          const value = record.hasData ? record.total.toLocaleString() : '—';
          return `
            <div class="progress-seven-day ${status}" title="${escapeHtml(shortDate(record.key))}: ${record.hasData ? escapeHtml(String(record.total)) + ' kcal' : 'No data'}">
              <div class="progress-seven-bar-zone">
                <span class="progress-seven-bar" style="height:${height.toFixed(2)}%"></span>
              </div>
              <strong>${escapeHtml(shortDay(record.key))}</strong>
              <span>${escapeHtml(value)}</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  function svgSegments(records, maxValue, width, height, padX, padY) {
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const points = records.map((record, index) => {
      if (!record.hasData) return null;
      const x = padX + (records.length === 1 ? usableW / 2 : (index / (records.length - 1)) * usableW);
      const y = padY + usableH - (record.total / maxValue) * usableH;
      return { x, y, record };
    });

    const segments = [];
    let current = [];
    points.forEach(point => {
      if (!point) {
        if (current.length) segments.push(current);
        current = [];
      } else {
        current.push(point);
      }
    });
    if (current.length) segments.push(current);
    return { points, segments };
  }

  function renderThirtyDayChart(records, target) {
    const chart = document.getElementById('progress30Chart');
    const meta = document.getElementById('progress30Meta');
    const trend = document.getElementById('progress30Trend');
    if (!chart || !meta || !trend) return;

    const logged = records.filter(record => record.hasData);
    if (!logged.length) {
      chart.innerHTML = '<div class="progress-empty-state">Your 30-day trend will build automatically as calorie history accumulates.</div>';
      meta.textContent = 'No calorie history yet';
      trend.textContent = 'No trend available yet.';
      return;
    }

    const width = 720;
    const height = 220;
    const padX = 24;
    const padY = 22;
    const maxValue = Math.max(target * 1.2, ...logged.map(record => record.total), 1);
    const { points, segments } = svgSegments(records, maxValue, width, height, padX, padY);
    const usableH = height - padY * 2;
    const targetY = padY + usableH - (target / maxValue) * usableH;

    const paths = segments.map(segment =>
      `<polyline class="progress-line-path" points="${segment.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}"/>`
    ).join('');
    const dots = points.filter(Boolean).map(point =>
      `<circle class="progress-line-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5"><title>${escapeHtml(shortDate(point.record.key))}: ${escapeHtml(String(point.record.total))} kcal</title></circle>`
    ).join('');

    chart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="30-day calorie trend">
        <line class="progress-line-target" x1="${padX}" y1="${targetY.toFixed(1)}" x2="${width - padX}" y2="${targetY.toFixed(1)}"/>
        ${paths}
        ${dots}
      </svg>
      <div class="progress-line-axis"><span>${escapeHtml(shortDate(records[0].key))}</span><span>${escapeHtml(shortDate(records[records.length - 1].key))}</span></div>`;

    const avg = averageLogged(records);
    meta.textContent = `${logged.length} logged day${logged.length === 1 ? '' : 's'} · average ${avg.toLocaleString()} kcal`;

    const latest7 = averageLogged(records.slice(-7));
    const prior7 = averageLogged(records.slice(-14, -7));
    if (latest7 === null || prior7 === null) {
      trend.textContent = 'Trend comparison starts once both recent 7-day windows contain logged data.';
    } else {
      const delta = latest7 - prior7;
      if (Math.abs(delta) < 10) {
        trend.textContent = 'Recent 7-day average is essentially unchanged from the prior 7 days.';
      } else {
        trend.textContent = `Recent 7-day average is ${Math.abs(delta).toLocaleString()} kcal ${delta > 0 ? 'higher' : 'lower'} than the prior 7 days.`;
      }
    }
  }

  function breakdownRow(label, count, total, className) {
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="progress-breakdown-row ${className}">
        <span class="progress-breakdown-label"><i></i>${escapeHtml(label)}</span>
        <span class="progress-breakdown-track"><b style="width:${pct}%"></b></span>
        <strong>${count}</strong>
      </div>`;
  }

  function renderCalorieBreakdown(records, target) {
    const el = document.getElementById('progressCalorieBreakdown');
    if (!el) return;
    const breakdown = calorieBreakdown(records, target);

    if (!breakdown.logged) {
      el.innerHTML = '<div class="progress-empty-state compact">No logged calorie days in this 7-day window.</div>';
      return;
    }

    el.innerHTML = `
      ${breakdownRow('Under 90%', breakdown.under, breakdown.logged, 'under')}
      ${breakdownRow('On target 90–105%', breakdown.on, breakdown.logged, 'on')}
      ${breakdownRow('Over 105%', breakdown.over, breakdown.logged, 'over')}
      <p class="progress-detail-note">${breakdown.noData ? `${breakdown.noData} day${breakdown.noData === 1 ? '' : 's'} had no calorie entries and ${breakdown.noData === 1 ? 'was' : 'were'} excluded.` : 'All 7 days contain calorie entries.'}</p>`;
  }

  function completionBlock(label, data) {
    const value = data.percent === null ? 0 : data.percent;
    const detail = data.trackedDays
      ? `${data.done} of ${data.possible} across ${data.trackedDays} tracked day${data.trackedDays === 1 ? '' : 's'}`
      : 'No tracked days yet';
    return `
      <div class="progress-completion-block">
        <div class="progress-completion-head"><span>${escapeHtml(label)}</span><strong>${data.percent === null ? '—' : `${data.percent}%`}</strong></div>
        <div class="progress-completion-track"><span style="width:${value}%"></span></div>
        <p>${escapeHtml(detail)}</p>
      </div>`;
  }

  function renderCompletion(schedule, salah) {
    const el = document.getElementById('progressCompletion');
    if (!el) return;
    el.innerHTML = `
      ${completionBlock('Daily Timeline', schedule)}
      ${completionBlock('Salah', salah)}
      <p class="progress-detail-note">Completion percentages use tracked days only. Untracked days are not counted as failures.</p>`;
  }

  function recoveryItem(label, value, targetText, maxForBar) {
    const pct = maxForBar ? Math.min(100, (value / maxForBar) * 100) : 0;
    return `
      <div class="progress-recovery-item">
        <div class="progress-recovery-copy"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(targetText)}</small></div>
        <div class="progress-recovery-track"><span style="width:${pct}%"></span></div>
      </div>`;
  }

  function renderRecovery(recovery) {
    const el = document.getElementById('progressRecovery');
    const meta = document.getElementById('progressRecoveryMeta');
    if (!el || !meta) return;

    meta.textContent = recovery.hasData
      ? `Week of ${shortDate(recovery.weekKey)}`
      : `Week of ${shortDate(recovery.weekKey)} · no activity recorded yet`;

    el.innerHTML = `
      ${recoveryItem('Cardio', recovery.cardio, 'sessions this week', 5)}
      ${recoveryItem('Swim', recovery.swim, 'sessions this week', 5)}
      ${recoveryItem('Sauna', recovery.sauna, 'target 2–4', 4)}
      ${recoveryItem('Steam', recovery.steam, 'target 1–2', 2)}
    `;
  }

  function renderProgress() {
    const view = document.getElementById('view-progress');
    if (!view) return;

    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;
    const keys7 = dateKeysEndingToday(7);
    const keys30 = dateKeysEndingToday(30);
    const records7 = keys7.map(calorieRecord);
    const records30 = keys30.map(calorieRecord);
    const schedule = scheduleCompletion(keys7);
    const salah = salahCompletion(keys7);
    const recovery = recoverySummary();

    const targetKey = document.getElementById('progressTargetKey');
    if (targetKey) targetKey.textContent = `${target.toLocaleString()} kcal target`;

    renderSummaryCards(records7, target, schedule, salah);
    renderSevenDayChart(records7, target);
    renderThirtyDayChart(records30, target);
    renderCalorieBreakdown(records7, target);
    renderCompletion(schedule, salah);
    renderRecovery(recovery);
  }

  const baseRender = render;
  render = function renderWithProgressPass7() {
    baseRender();
    renderProgress();
  };

  window.ArcProgress = {
    render: renderProgress,
    getCalorieWindow(count) {
      return dateKeysEndingToday(count).map(calorieRecord).map(record => ({ ...record }));
    },
  };
})();
