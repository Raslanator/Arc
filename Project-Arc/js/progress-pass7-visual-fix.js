/**
 * progress-pass7-visual-fix.js
 * Pass 7 visual correction for value-accurate daily/weekly Progress graphics.
 *
 * Uses SVG geometry instead of inline CSS widths/heights so CSP cannot flatten
 * percentage meters or calorie columns. Also integrates the current 7-day
 * window into a read-only Weekly Consistency summary.
 */

(function initProgressPass7VisualFix() {
  const TARGET_LOW_RATIO = 0.90;
  const TARGET_HIGH_RATIO = 1.05;
  const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  function ensureStylesheet() {
    if (document.querySelector('link[data-progress-pass7-visual-fix]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/progress-pass7-visual-fix.css';
    link.dataset.progressPass7VisualFix = 'true';
    document.head.appendChild(link);
  }

  function dateFromKey(key) {
    const [year, month, day] = String(key || '').split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  }

  function dateKeyLocal(date) {
    const pad2 = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function shortDay(key) {
    return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function statusFor(record, target) {
    if (!record || !record.hasData) return 'no-data';
    const ratio = target > 0 ? record.total / target : 0;
    if (ratio < TARGET_LOW_RATIO) return 'under';
    if (ratio <= TARGET_HIGH_RATIO) return 'on';
    return 'over';
  }

  function statusLabel(status) {
    if (status === 'under') return 'Below target range';
    if (status === 'on') return 'On target';
    if (status === 'over') return 'Above target range';
    return 'No calorie data';
  }

  function renderSevenDaySvg() {
    const chart = document.getElementById('progress7Chart');
    if (!chart || !window.ArcProgress || typeof window.ArcProgress.getCalorieWindow !== 'function') return;

    const records = window.ArcProgress.getCalorieWindow(7);
    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;
    const logged = records.filter(record => record.hasData);
    if (!logged.length) return;

    const width = 700;
    const plotTop = 10;
    const plotBottom = 176;
    const plotHeight = plotBottom - plotTop;
    const barWidth = 70;
    const slotWidth = 100;
    const barOffset = 15;
    const maxValue = Math.max(target * 1.2, ...logged.map(record => record.total), 1);
    const targetY = plotBottom - (target / maxValue) * plotHeight;

    const bars = records.map((record, index) => {
      const x = barOffset + index * slotWidth;
      const status = statusFor(record, target);
      if (!record.hasData) {
        return `<rect class="progress-seven-svg-bar no-data" x="${x}" y="${plotTop}" width="${barWidth}" height="${plotHeight}" rx="11"/>`;
      }

      const rawHeight = (record.total / maxValue) * plotHeight;
      const barHeight = Math.max(5, rawHeight);
      const y = plotBottom - barHeight;
      return `<rect class="progress-seven-svg-bar ${status}" x="${x}" y="${y.toFixed(2)}" width="${barWidth}" height="${barHeight.toFixed(2)}" rx="11"><title>${escapeHtml(shortDay(record.key))}: ${escapeHtml(String(record.total))} kcal</title></rect>`;
    }).join('');

    const labels = records.map(record => {
      const status = statusFor(record, target);
      const value = record.hasData ? record.total.toLocaleString() : '—';
      return `
        <div class="progress-seven-label ${status}">
          <strong>${escapeHtml(shortDay(record.key))}</strong>
          <span>${escapeHtml(value)}</span>
          <small>${escapeHtml(statusLabel(status))}</small>
        </div>`;
    }).join('');

    chart.innerHTML = `
      <div class="progress-seven-svg-wrap">
        <svg class="progress-seven-svg" viewBox="0 0 ${width} 184" preserveAspectRatio="none" role="img" aria-label="Calories for the last seven days compared with the daily target">
          ${bars}
          <line class="progress-seven-svg-target" x1="0" y1="${targetY.toFixed(2)}" x2="${width}" y2="${targetY.toFixed(2)}"/>
        </svg>
        <div class="progress-seven-label-grid">${labels}</div>
      </div>`;
  }

  function scheduleDayScore(key) {
    const events = window.ArcSchedule && typeof window.ArcSchedule.getEvents === 'function'
      ? window.ArcSchedule.getEvents()
      : (Array.isArray(appState.timelineEvents) ? appState.timelineEvents : []);
    const eventIds = events.map(event => event.id).filter(Boolean);
    const bucket = appState.timelineStatus && appState.timelineStatus[key];
    if (!bucket || !Object.keys(bucket).length || !eventIds.length) return null;
    const done = eventIds.filter(id => bucket[id] && bucket[id].done !== false).length;
    return Math.round((done / eventIds.length) * 100);
  }

  function salahDayScore(key) {
    const bucket = appState.prayerStatus && appState.prayerStatus[key];
    if (!bucket || !Object.keys(bucket).length) return null;
    const done = PRAYERS.filter(name => !!bucket[name]).length;
    return { score: Math.round((done / PRAYERS.length) * 100), done };
  }

  function recoveryDayInfo(key) {
    const date = dateFromKey(key);
    const dayIndex = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayIndex);
    const week = appState.gymTracker && appState.gymTracker[dateKeyLocal(monday)];
    const day = week && week.days && week.days[dayIndex];
    const cardio = !!(day && day.cardio);
    const swim = !!(day && day.swim);
    if (!cardio && !swim) return null;
    return { cardio, swim, score: cardio && swim ? 100 : 75 };
  }

  function calorieConsistencyScore(record, target) {
    if (!record || !record.hasData || !target) return null;
    const deviation = Math.abs(record.total - target) / target;
    return Math.max(0, Math.round(100 - deviation * 200));
  }

  function consistencyStatus(score) {
    if (score === null) return 'no-data';
    if (score >= 80) return 'strong';
    if (score >= 55) return 'mixed';
    return 'low';
  }

  function dayConsistency(record, target) {
    const components = [];
    const calorieScore = calorieConsistencyScore(record, target);
    const timelineScore = scheduleDayScore(record.key);
    const salah = salahDayScore(record.key);
    const recovery = recoveryDayInfo(record.key);

    if (calorieScore !== null) components.push({ name: 'Calories', score: calorieScore });
    if (timelineScore !== null) components.push({ name: 'Timeline', score: timelineScore });
    if (salah) components.push({ name: 'Salah', score: salah.score });
    if (recovery) components.push({ name: 'Recovery', score: recovery.score });

    const score = components.length
      ? Math.round(components.reduce((sum, item) => sum + item.score, 0) / components.length)
      : null;

    return {
      key: record.key,
      day: shortDay(record.key),
      score,
      status: consistencyStatus(score),
      calorieStatus: statusFor(record, target),
      timelineScore,
      salah,
      recovery,
      componentCount: components.length,
    };
  }

  function dayReason(day) {
    const parts = [];
    if (day.calorieStatus !== 'no-data') {
      parts.push(day.calorieStatus === 'on' ? 'calories on target' : day.calorieStatus === 'under' ? 'calories below target' : 'calories above target');
    }
    if (day.timelineScore !== null) parts.push(`Timeline ${day.timelineScore}%`);
    if (day.salah) parts.push(`Salah ${day.salah.done}/5`);
    if (day.recovery) {
      if (day.recovery.cardio && day.recovery.swim) parts.push('cardio + swim recorded');
      else if (day.recovery.cardio) parts.push('cardio recorded');
      else if (day.recovery.swim) parts.push('swim recorded');
    }
    return parts.join(', ');
  }

  function renderWeeklyConsistency() {
    const el = document.getElementById('progressCalorieBreakdown');
    if (!el || !window.ArcProgress || typeof window.ArcProgress.getCalorieWindow !== 'function') return;

    const panel = el.closest('.progress-panel');
    if (panel) {
      const title = panel.querySelector('h4');
      const subtitle = panel.querySelector('.progress-panel-sub');
      if (title) title.textContent = 'Weekly Consistency';
      if (subtitle) subtitle.textContent = 'Last 7 days · available data only';
    }

    const records = window.ArcProgress.getCalorieWindow(7);
    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;
    const days = records.map(record => dayConsistency(record, target));
    const scored = days.filter(day => day.score !== null);

    const counts = {
      strong: days.filter(day => day.status === 'strong').length,
      mixed: days.filter(day => day.status === 'mixed').length,
      low: days.filter(day => day.status === 'low').length,
      noData: days.filter(day => day.status === 'no-data').length,
    };

    let interpretation = 'Not enough tracked information yet to interpret this week.';
    if (scored.length) {
      const ranked = [...scored].sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const weakest = ranked[ranked.length - 1];
      const overview = `${counts.strong} strong day${counts.strong === 1 ? '' : 's'} · ${counts.mixed} mixed · ${counts.low} need${counts.low === 1 ? 's' : ''} attention${counts.noData ? ` · ${counts.noData} unscored` : ''}.`;
      const bestText = dayReason(best);
      const weakText = dayReason(weakest);
      interpretation = `${overview} ${best.day} was strongest${bestText ? `: ${bestText}` : ''}.`;
      if (weakest.key !== best.key) interpretation += ` ${weakest.day} was weakest${weakText ? `: ${weakText}` : ''}.`;
    }

    el.innerHTML = `
      <div class="progress-consistency-week" role="list" aria-label="Weekly consistency across calories, Timeline, Salah, and recorded recovery">
        ${days.map(day => `
          <div class="progress-consistency-day ${day.status}" role="listitem" title="${escapeHtml(day.day)}: ${day.status === 'no-data' ? 'Not enough data' : day.status === 'strong' ? 'Strong day' : day.status === 'mixed' ? 'Mixed day' : 'Needs attention'}">
            <span>${escapeHtml(day.day)}</span>
          </div>`).join('')}
      </div>
      <div class="progress-consistency-legend" aria-hidden="true">
        <span class="strong"><i></i>Strong</span>
        <span class="mixed"><i></i>Mixed</span>
        <span class="low"><i></i>Needs attention</span>
        <span class="no-data"><i></i>Unscored</span>
      </div>
      <p class="progress-consistency-interpretation"><strong>Interpretation</strong>${escapeHtml(interpretation)}</p>`;
  }

  function renderCompletionMeters() {
    const blocks = Array.from(document.querySelectorAll('#progressCompletion .progress-completion-block'));
    blocks.forEach((block, index) => {
      const valueText = block.querySelector('.progress-completion-head strong')?.textContent || '';
      const parsed = parseInt(valueText, 10);
      const value = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
      const track = block.querySelector('.progress-completion-track');
      if (!track) return;

      track.classList.add('svg-meter');
      const fillClass = index === 1 ? 'salah' : 'timeline';
      track.innerHTML = `
        <svg class="progress-completion-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
          <rect class="progress-completion-svg-track" x="0.5" y="0.5" width="99" height="7" rx="4"/>
          <rect class="progress-completion-svg-fill ${fillClass}" x="0" y="0" width="${value}" height="8" rx="4"/>
        </svg>`;
    });
  }

  function applyVisualFixes() {
    renderSevenDaySvg();
    renderWeeklyConsistency();
    renderCompletionMeters();
  }

  ensureStylesheet();

  const baseRender = render;
  render = function renderWithProgressPass7VisualFix() {
    baseRender();
    applyVisualFixes();
  };

  requestAnimationFrame(applyVisualFixes);

  window.ArcProgressVisualFix = {
    render: applyVisualFixes,
  };
})();
