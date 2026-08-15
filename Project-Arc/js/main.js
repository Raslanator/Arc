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

  /* ----------------------------------------------------------------
     ARC VERTICAL CENTERING
     Vertical panning is intentionally disabled. At every zoom level the
     viewport is centered around the complete visible Arc content band:
     curve + event markers + scaled time labels + current-time marker.
     Horizontal panning remains fully available.
     ---------------------------------------------------------------- */

  function arcYAtZoom(t, zoom) {
    const frac = Math.max(0, Math.min(1, (t - ARC_MINT) / (ARC_MAXT - ARC_MINT)));
    const curveFactor = computeCurveFactor(zoom);
    return ARC_BOTTOM - Math.sin(frac * Math.PI) * (ARC_BOTTOM - ARC_TOP) * curveFactor;
  }

  function centeredArcPanY(zoom) {
    const viewH = ARC_H / zoom;
    if (zoom <= 1.001) return 0;

    const dotScale = dotScaleFor(zoom);
    const arcTop = ARC_BOTTOM - (ARC_BOTTOM - ARC_TOP) * computeCurveFactor(zoom);
    let minY = arcTop;
    let maxY = ARC_BOTTOM;

    const svg = document.getElementById('arcSvg');
    if (svg) {
      svg.querySelectorAll('.arc-scale-dot').forEach(group => {
        const t = parseFloat(group.dataset.t);
        if (!Number.isFinite(t)) return;

        const cy = arcYAtZoom(t, zoom);
        const rung = parseFloat(group.dataset.rung || '0');
        const above = group.dataset.above === '1';

        // Always include the visible marker itself.
        const markerRadius = group.classList.contains('arc-prayer-dot') ? 5 : 6;
        minY = Math.min(minY, cy - markerRadius * dotScale);
        maxY = Math.max(maxY, cy + markerRadius * dotScale);

        // Event time labels are transformed around their dot together with the
        // marker group, so their vertical offset shrinks with dotScaleFor().
        if (group.classList.contains('arc-dot')) {
          const labelDist = (above ? -16 : 24) + (above ? -rung * 13 : rung * 13);
          const labelBaseline = cy + labelDist * dotScale;
          const labelTop = labelBaseline - 9 * dotScale;
          const labelBottom = labelBaseline + 4 * dotScale;
          minY = Math.min(minY, labelTop);
          maxY = Math.max(maxY, labelBottom);
        }
      });
    }

    // Include the live NOW marker/chip when it is inside today's Arc range.
    const nowT = nowMinutes();
    if (nowT >= ARC_MINT && nowT <= ARC_MAXT) {
      const cy = arcYAtZoom(nowT, zoom);
      const markerScale = nowMarkerScaleFor(zoom);
      minY = Math.min(minY, cy - 35 * markerScale);
      maxY = Math.max(maxY, cy + 13 * markerScale);
    }

    // A small safety margin prevents glyphs from touching the clipped edge.
    const margin = 5;
    minY -= margin;
    maxY += margin;

    const contentCenter = (minY + maxY) / 2;
    const maxPanY = Math.max(0, ARC_H - viewH);
    return Math.max(0, Math.min(maxPanY, contentCenter - viewH / 2));
  }

  // Clamp X normally, but make Y a derived center value. This means vertical
  // mouse/touch movement can never decentralize the Arc.
  clampArcPan = function pass2ClampArcPan() {
    const vw = ARC_W / arcZoom;
    arcPanX = Math.max(0, Math.min(ARC_W - vw, arcPanX));
    arcPanY = centeredArcPanY(arcZoom);
  };

  // Recenter the displayed viewport on every animation frame too, so the Arc
  // remains centered throughout a smooth zoom rather than only at its endpoint.
  const baseRenderArcViewBox = renderArcViewBox;
  renderArcViewBox = function pass2RenderArcViewBox() {
    arcPanYDisp = centeredArcPanY(arcZoomDisp);
    baseRenderArcViewBox();
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
     TODAY — ROTATING DAILY BRIEF
     Keep the original brief container and position. renderTodaySummary()
     continues to build its contextual meal/workout/calorie items; this layer
     simply presents one item at a time instead of three static rows.
     ================================================================ */

  let todayBriefIndex = 0;

  function showTodayBriefItem(advance) {
    const brief = document.getElementById('todaySummary');
    if (!brief) return;

    const items = Array.from(brief.querySelectorAll('.prep-item'));
    if (!items.length) return;

    if (advance && items.length > 1) {
      todayBriefIndex = (todayBriefIndex + 1) % items.length;
    } else if (todayBriefIndex >= items.length) {
      todayBriefIndex = 0;
    }

    brief.setAttribute('aria-live', 'polite');
    items.forEach((item, i) => {
      item.hidden = i !== todayBriefIndex;
      item.setAttribute('aria-hidden', i === todayBriefIndex ? 'false' : 'true');
    });
  }

  showTodayBriefItem(false);
  setInterval(() => showTodayBriefItem(true), 6500);

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
    showTodayBriefItem(false);
    const banner = document.getElementById('goalsSavedBanner');
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 3200);
  });

  document.getElementById('goalsResetBtn').addEventListener('click', () => {
    appState.settings = { ...DEFAULT_SETTINGS };
    saveState();
    render();
    showTodayBriefItem(false);
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
    showTodayBriefItem(false);
  });

  document.getElementById('clearTodayBtn').addEventListener('click', () => {
    appState.calories[todayKeyStr()] = [];
    saveState();
    render();
    showTodayBriefItem(false);
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
    showTodayBriefItem(false);
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
    showTodayBriefItem(false);
  });

  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wk  = getTrackerWeek();
      const key = btn.dataset.key;
      const dir = parseInt(btn.dataset.dir);
      wk[key] = Math.max(0, (wk[key] || 0) + dir);
      saveState();
      render();
      showTodayBriefItem(false);
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
      showTodayBriefItem(false);
      ensurePrayerTimes();
    }
  }

  tick(); // run once immediately so clock/now-marker are correct on first paint
  setInterval(tick, 1000);

})();