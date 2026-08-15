/**
 * progress-pass7-chart-refine.js
 * Visual refinement for the Last 7 Days calorie chart.
 * Keeps Pass 7 calculations read-only while making the chart easier to scan.
 */

(function initProgressSevenDayChartRefine() {
  const TARGET_LOW_RATIO = 0.90;
  const TARGET_HIGH_RATIO = 1.05;

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function lastSevenKeys() {
    const keys = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      keys.push(localDateKey(date));
    }
    return keys;
  }

  function dateFromKey(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
  }

  function shortDay(key) {
    return dateFromKey(key).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function shortDate(key) {
    return dateFromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function entriesFor(key) {
    return appState.calories && Array.isArray(appState.calories[key])
      ? appState.calories[key]
      : [];
  }

  function totalFor(key) {
    if (window.ArcCalories && typeof window.ArcCalories.getDayTotal === 'function') {
      return window.ArcCalories.getDayTotal(key);
    }
    return entriesFor(key).reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
  }

  function recordFor(key) {
    const entries = entriesFor(key);
    return { key, total: totalFor(key), hasData: entries.length > 0 };
  }

  function statusFor(record, target) {
    if (!record.hasData) return 'no-data';
    const ratio = target > 0 ? record.total / target : 0;
    if (ratio < TARGET_LOW_RATIO) return 'under';
    if (ratio <= TARGET_HIGH_RATIO) return 'on';
    return 'over';
  }

  function statusLabel(status) {
    if (status === 'under') return 'Below';
    if (status === 'on') return 'On target';
    if (status === 'over') return 'Above';
    return 'No data';
  }

  function signedDelta(total, target) {
    const delta = total - target;
    if (delta === 0) return 'At target';
    return `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()} kcal`;
  }

  function renderRefinedSevenDayChart() {
    const chart = document.getElementById('progress7Chart');
    const meta = document.getElementById('progress7Meta');
    const targetKey = document.getElementById('progressTargetKey');
    if (!chart || !meta) return;

    const target = Number(appState.settings && appState.settings.calorieTarget) || 2200;
    const records = lastSevenKeys().map(recordFor);
    const logged = records.filter(record => record.hasData);

    if (targetKey) targetKey.textContent = `${target.toLocaleString()} kcal target`;

    if (!logged.length) {
      chart.innerHTML = '<div class="progress-empty-state">Log calories for a few days and your 7-day chart will appear here.</div>';
      meta.textContent = 'No calorie history in the last 7 days';
      return;
    }

    const average = Math.round(logged.reduce((sum, record) => sum + record.total, 0) / logged.length);
    const averageDelta = average - target;
    const averageText = Math.abs(averageDelta) < 10
      ? 'average is essentially on target'
      : `${Math.abs(averageDelta).toLocaleString()} kcal ${averageDelta > 0 ? 'above' : 'below'} target on average`;
    meta.textContent = `${logged.length} of 7 days logged · average ${average.toLocaleString()} kcal · ${averageText}`;

    const maxValue = Math.max(target * 1.24, ...logged.map(record => record.total), 1);
    const targetPct = Math.max(0, Math.min(100, (target / maxValue) * 100));

    chart.innerHTML = `
      <div class="progress-seven-legend" aria-label="Calorie status colors">
        <span class="under"><i></i>Below range</span>
        <span class="on"><i></i>On target</span>
        <span class="over"><i></i>Above range</span>
      </div>
      <div class="progress-seven-plot refined">
        <span class="progress-target-line refined" style="bottom:${targetPct.toFixed(2)}%" aria-hidden="true">
          <em>Target</em>
        </span>
        ${records.map(record => {
          const status = statusFor(record, target);
          const height = record.hasData ? Math.max(5, (record.total / maxValue) * 100) : 0;
          const value = record.hasData ? record.total.toLocaleString() : '—';
          const delta = record.hasData ? signedDelta(record.total, target) : 'No log';
          const label = statusLabel(status);
          return `
            <div class="progress-seven-day ${status}" title="${escapeHtml(shortDate(record.key))}: ${record.hasData ? `${escapeHtml(String(record.total))} kcal · ${escapeHtml(label)}` : 'No data'}">
              <div class="progress-seven-bar-zone refined">
                ${record.hasData ? `<span class="progress-seven-bar refined" style="height:${height.toFixed(2)}%"></span>` : ''}
              </div>
              <strong>${escapeHtml(shortDay(record.key))}</strong>
              <span class="progress-seven-value">${escapeHtml(value)}</span>
              <span class="progress-seven-delta">${escapeHtml(delta)}</span>
            </div>`;
        }).join('')}
      </div>`;
  }

  const baseRender = render;
  render = function renderWithSevenDayChartRefine() {
    baseRender();
    renderRefinedSevenDayChart();
  };

  window.ArcProgressSevenDayRefine = {
    render: renderRefinedSevenDayChart,
  };
})();
