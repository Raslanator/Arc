/**
 * main.js
 * Application entry point: initialisation, event listener wiring,
 * and the 1-second tick loop.
 *
 * Depends on: all other js/ modules being loaded first.
 */

(function init() {

  /* ================================================================
     PASS 2 — INTERACTION IMPROVEMENTS KEPT AFTER LAYOUT ROLLBACK
     No DOM reordering: Today keeps its original single-column structure and
     Prayer Times remains in its original position/card.
     ================================================================ */

  // Keep the arc's path visually present while zooming/panning. The original
  // clamp still handles hard SVG bounds; this tighter vertical band prevents
  // zooming around a pointer from pushing the flattened arc out of view.
  const baseClampArcPan = clampArcPan;
  clampArcPan = function pass2ClampArcPan() {
    baseClampArcPan();
    if (arcZoom <= 1.001) return;

    const viewH = ARC_H / arcZoom;
    const curveFactor = computeCurveFactor(arcZoom);
    const arcTop = ARC_BOTTOM - (ARC_BOTTOM - ARC_TOP) * curveFactor;
    const arcCenter = (arcTop + ARC_BOTTOM) / 2;

    const minPanY = Math.max(0, arcCenter - viewH * 0.72);
    const maxPanY = Math.min(ARC_H - viewH, arcCenter - viewH * 0.28);
    arcPanY = Math.max(minPanY, Math.min(maxPanY, arcPanY));
  };

  // Add invisible 32px SVG hit targets. Visible markers keep their old size.
  const baseUpdateArcShape = updateArcShape;
  updateArcShape = function pass2UpdateArcShape(scale) {
    baseUpdateArcShape(scale);

    const svg = document.getElementById('arcSvg');
    if (!svg) return;

    svg.querySelectorAll('.arc-scale-dot').forEach(group => {
      let hit = group.querySelector('.arc-hit-target');
      if (!hit) {
        hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hit.setAttribute('class', 'arc-hit-target');
        hit.setAttribute('r', '16');
        hit.setAttribute('aria-hidden', 'true');
        group.appendChild(hit);
      }
      hit.setAttribute('cx', group.dataset.cx || '0');
      hit.setAttribute('cy', group.dataset.cy || '0');
    });
  };

  // Extend the existing light-follow language to the top clock/header panel.
  const topHeader = document.querySelector('header.top');
  if (topHeader) {
    let headerSpotlightRAF = null;
    let headerPointerEvent = null;

    topHeader.addEventListener('pointermove', e => {
      headerPointerEvent = e;
      if (headerSpotlightRAF !== null) return;
      headerSpotlightRAF = requestAnimationFrame(() => {
        headerSpotlightRAF = null;
        if (!headerPointerEvent) return;
        const rect = topHeader.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = ((headerPointerEvent.clientX - rect.left) / rect.width * 100).toFixed(2);
        const y = ((headerPointerEvent.clientY - rect.top) / rect.height * 100).toFixed(2);
        topHeader.style.setProperty('--mx', x + '%');
        topHeader.style.setProperty('--my', y + '%');
      });
    }, { passive: true });
  }

  /* ---- Bootstrap ---- */
  loadState();
  render();
  activateTab(appState.activeTab || 'today');
  ensurePrayerTimes();
  initArcZoomHandlers();
  initNav();

  /* ================================================================
     GOALS FORM
     ================================================================ */

  document.getElementById('goalsForm').addEventListener('submit', e => {
    e.preventDefault();
    const dailyTarget = parseInt(document.getElementById('goalDailyTarget').value);
    const wakeMin     = hhmmToMin(document.getElementById('goalWake').value);
    let   sleepMin    = hhmmToMin(document.getElementById('goalSleep').value);
    // Handle overnight bedtime (e.g. 00:30 is after a 22:00 wake)
    if (sleepMin <= wakeMin) sleepMin += 1440;
    if (!dailyTarget || dailyTarget < 1000) return;
    appState.settings = { calorieTarget: dailyTarget, wakeMin, sleepMin };
    saveState();
    render();
    const banner = document.getElementById('goalsSavedBanner');
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 3200);
  });

  document.getElementById('goalsResetBtn').addEventListener('click', () => {
    appState.settings = { ...DEFAULT_SETTINGS };
    saveState();
    render();
  });

  /* ================================================================
     THEME TOGGLE
     ================================================================ */

  document.getElementById('themeToggle').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.theme = btn.dataset.theme;
      applyTheme();
      saveState();
      renderThemeToggle();
    });
  });

  /* ================================================================
     RESET APP
     ================================================================ */

  document.getElementById('resetAppBtn').addEventListener('click', () => {
    const ok = confirm(
      'Reset the entire app to its original, first-load state? ' +
      'This clears all meal swaps, gym edits, calorie logs, grocery checks, ' +
      'and settings \u2014 and cannot be undone.'
    );
    if (!ok) return;
    Storage.clearAll();
  });

  /* ================================================================
     CALORIE FORM
     ================================================================ */

  document.getElementById('customAddForm').addEventListener('submit', e => {
    e.preventDefault();
    const labelEl = document.getElementById('customLabel');
    const kcalEl  = document.getElementById('customKcal');
    const label   = labelEl.value.trim();
    const kcal    = parseInt(kcalEl.value);
    if (!label || !kcal || kcal <= 0) return;
    addCalEntry(label, kcal);
    labelEl.value = ''; kcalEl.value = '';
    labelEl.focus();
  });

  document.getElementById('clearTodayBtn').addEventListener('click', () => {
    appState.calories[todayKeyStr()] = [];
    saveState();
    render();
  });

  /* ================================================================
     GROCERY RESET
     ================================================================ */

  document.getElementById('grocReset').addEventListener('click', () => {
    const ids = weekRecipeIds(appState.grocWeek);
    ids.forEach(id => {
      const r = getRecipe(id);
      if (!r) return;
      r.ingredients.forEach((_, i) => {
        delete appState.grocery[`w${appState.grocWeek}-${id}-${i}`];
      });
    });
    saveState();
    render();
  });

  /* ================================================================
     RECIPE FILTER & ADD BUTTON
     ================================================================ */

  document.getElementById('recipeFilter').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.recipeShowArchived = (btn.dataset.f === 'archived');
      saveState();
      renderRecipes();
    });
  });

  document.getElementById('addRecipeBtn').addEventListener('click', () => openRecipeForm(null));

  /* ================================================================
     TRACKER RESET & COUNTER BUTTONS
     ================================================================ */

  document.getElementById('trackerResetBtn').addEventListener('click', () => {
    appState.gymTracker[currentTrackerWeekKey()] = blankTrackerWeek();
    saveState();
    render();
  });

  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wk  = getTrackerWeek();
      const key = btn.dataset.key;
      const dir = parseInt(btn.dataset.dir);
      wk[key] = Math.max(0, (wk[key] || 0) + dir);
      saveState();
      render();
    });
  });

  /* ================================================================
     1-SECOND TICK LOOP
     Updates the live clock, now-marker, next-event highlight,
     and prayer countdown. Triggers a full re-render on day rollover.
     ================================================================ */

  let lastDateKey = todayKeyStr();

  function tick() {
    // Update live clock in the header
    document.getElementById('headerClock').textContent = minToLabel12(nowMinutes());

    updateNowMarker();
    updateNextEventHighlight();
    renderPrayerCard(); // cheap re-render for the countdown, no network call

    // Day rollover: prune old logs and fetch fresh prayer times
    const currentDateKey = todayKeyStr();
    if (currentDateKey !== lastDateKey) {
      lastDateKey = currentDateKey;
      pruneOldCalorieLogs();
      saveState();
      render();
      ensurePrayerTimes();
    }
  }

  tick(); // run once immediately so clock/now-marker are correct on first paint
  setInterval(tick, 1000);

})();
