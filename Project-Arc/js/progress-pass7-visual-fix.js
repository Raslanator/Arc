/**
 * progress-pass7-visual-fix.js
 * Pass 7 visual correction for value-accurate daily/weekly Progress graphics.
 *
 * Uses SVG geometry instead of inline CSS widths/heights so CSP cannot flatten
 * percentage meters or calorie columns.
 */

(function initProgressPass7VisualFix() {
  const TARGET_LOW_RATIO = 0.90;
  const TARGET_HIGH_RATIO = 1.05;

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
    if (status === 'under') return 'Below';
    if (status === 'on') return 'On target';
    if (status === 'over') return 'Above';
    return 'No data';
  }

  function stackRecovery() {
    const value = document.querySelector('#progressDailyGrid .progress-daily-metric.recovery .progress-daily-metric-value');
    if (!value) return;
    const text = value.textContent || '';
    const parts = text.split('·').map(part => part.trim()).filter(Boolean);
    if (parts.length !== 2) return;

    value.replaceChildren(
      document.createTextNode(parts[0]),
      document.createElement('br'),
      document.createTextNode(parts[1])
    );
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
    stackRecovery();
    renderSevenDaySvg();
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
