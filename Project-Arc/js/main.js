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
     Vertical panning is disabled. Instead of centering the full arch shape,
     center the actual curve point at the horizontal middle of the current
     viewport. This keeps the local Arc line itself centered while zooming or
     panning left/right, including at the high middle of the arch.
     ---------------------------------------------------------------- */

  function arcYAtZoom(t, zoom) {
    const frac = Math.max(0, Math.min(1, (t - ARC_MINT) / (ARC_MAXT - ARC_MINT)));
    const curveFactor = computeCurveFactor(zoom);
    return ARC_BOTTOM - Math.sin(frac * Math.PI) * (ARC_BOTTOM - ARC_TOP) * curveFactor;
  }

  function centeredArcPanY(zoom, panX) {
    const viewH = ARC_H / zoom;
    if (zoom <= 1.001) return 0;

    const viewW = ARC_W / zoom;
    const viewportCenterX = panX + viewW / 2;

    // The Arc itself runs from ARC_PADX to ARC_W - ARC_PADX. Clamp the
    // reference X to that range so extreme horizontal pans use the nearest
    // real point on the curve rather than empty SVG space.
    const curveX = Math.max(ARC_PADX, Math.min(ARC_W - ARC_PADX, viewportCenterX));
    const frac = (curveX - ARC_PADX) / (ARC_W - 2 * ARC_PADX);
    const t = ARC_MINT + frac * (ARC_MAXT - ARC_MINT);
    const lineY = arcYAtZoom(t, zoom);

    const maxPanY = Math.max(0, ARC_H - viewH);
    return Math.max(0, Math.min(maxPanY, lineY - viewH / 2));
  }

  // Clamp X normally. Y is always derived from the Arc line at the horizontal
  // viewport center, so vertical pointer movement can never decentralize it.
  clampArcPan = function pass2ClampArcPan() {
    const vw = ARC_W / arcZoom;
    arcPanX = Math.max(0, Math.min(ARC_W - vw, arcPanX));
    arcPanY = centeredArcPanY(arcZoom, arcPanX);
  };

  // Recalculate against the displayed X position on every animation frame so
  // the line stays centered continuously throughout smooth zooms and pans.
  const baseRenderArcViewBox = renderArcViewBox;
  renderArcViewBox = function pass2RenderArcViewBox() {
    arcPanYDisp = centeredArcPanY(arcZoomDisp, arcPanXDisp);
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
     TODAY — DAILY BRIEF CAROUSEL
     The source render still provides the contextual meal/workout/calorie
     items. The day label stays in a separate left box, while the information
     box rotates automatically and can be navigated from translucent edge
     controls. Active content uses the largest font that fits the stage.
     ================================================================ */

  let todayBriefIndex = 0;
  let todayBriefTimer = null;
  let todayBriefTransitionToken = 0;

  function prepareTodayBriefPanel(brief) {
    let stage = brief.querySelector('.daily-brief-stage');
    if (stage) return stage;

    const items = Array.from(brief.children).filter(el => el.classList.contains('prep-item'));
    if (!items.length) return null;

    const plan = getTodayPlan();
    const firstLabel = items[0].querySelector('b');
    if (firstLabel) firstLabel.textContent = plan.hasPlan ? 'Meals' : 'Today';

    const shell = document.createElement('div');
    shell.className = 'daily-brief-shell';

    const dayLabel = document.createElement('div');
    dayLabel.className = 'daily-brief-day';
    const dayStrong = document.createElement('strong');
    dayStrong.textContent = `Today / ${plan.dayName}`;
    dayLabel.appendChild(dayStrong);

    const content = document.createElement('div');
    content.className = 'daily-brief-content';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'daily-brief-arrow daily-brief-prev';
    prevBtn.setAttribute('aria-label', 'Previous daily brief');
    prevBtn.textContent = '<';

    stage = document.createElement('div');
    stage.className = 'daily-brief-stage';
    stage.setAttribute('aria-live', 'polite');

    items.forEach(item => {
      item.classList.add('daily-brief-item');
      stage.appendChild(item);
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'daily-brief-arrow daily-brief-next';
    nextBtn.setAttribute('aria-label', 'Next daily brief');
    nextBtn.textContent = '>';

    content.append(stage, prevBtn, nextBtn);
    shell.append(dayLabel, content);
    brief.replaceChildren(shell);

    const hasMultiple = items.length > 1;
    prevBtn.hidden = !hasMultiple;
    nextBtn.hidden = !hasMultiple;

    prevBtn.addEventListener('click', () => {
      showTodayBriefItem(true, -1);
      restartTodayBriefRotation();
    });
    nextBtn.addEventListener('click', () => {
      showTodayBriefItem(true, 1);
      restartTodayBriefRotation();
    });

    return stage;
  }

  function fitTodayBriefText(brief, targetItem) {
    const stage = brief.querySelector('.daily-brief-stage');
    const item = targetItem || (stage && stage.querySelector('.daily-brief-item:not([hidden])'));
    if (!stage || !item || !stage.clientWidth || !stage.clientHeight) return;

    const style = getComputedStyle(stage);
    const availableHeight = stage.clientHeight
      - parseFloat(style.paddingTop || 0)
      - parseFloat(style.paddingBottom || 0);
    const availableWidth = stage.clientWidth
      - parseFloat(style.paddingLeft || 0)
      - parseFloat(style.paddingRight || 0);

    const minSize = 14;
    const maxSize = 30;
    let low = minSize;
    let high = maxSize;
    let best = minSize;

    item.style.fontSize = minSize + 'px';

    for (let i = 0; i < 7; i++) {
      const mid = (low + high) / 2;
      item.style.fontSize = mid + 'px';
      const fits =
        item.scrollWidth <= availableWidth + 1 &&
        item.scrollHeight <= availableHeight + 1;

      if (fits) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    item.style.fontSize = best.toFixed(1) + 'px';
  }

  function settleTodayBriefItems(items, activeIndex) {
    items.forEach((item, i) => {
      item.getAnimations().forEach(animation => animation.cancel());
      item.hidden = i !== activeIndex;
      item.setAttribute('aria-hidden', i === activeIndex ? 'false' : 'true');
    });
  }

  function showTodayBriefItem(advance, direction = 1) {
    const brief = document.getElementById('todaySummary');
    if (!brief) return;

    const stage = prepareTodayBriefPanel(brief);
    if (!stage) return;

    const items = Array.from(stage.querySelectorAll('.daily-brief-item'));
    if (!items.length) return;

    if (todayBriefIndex >= items.length) todayBriefIndex = 0;

    if (!advance || items.length === 1) {
      settleTodayBriefItems(items, todayBriefIndex);
      requestAnimationFrame(() => fitTodayBriefText(brief, items[todayBriefIndex]));
      return;
    }

    // Snap any interrupted transition to the currently selected item before
    // starting a new one, keeping rapid manual clicks predictable.
    settleTodayBriefItems(items, todayBriefIndex);

    const currentIndex = todayBriefIndex;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    const current = items[currentIndex];
    const next = items[nextIndex];

    next.hidden = false;
    next.setAttribute('aria-hidden', 'false');
    current.setAttribute('aria-hidden', 'true');
    fitTodayBriefText(brief, next);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    todayBriefIndex = nextIndex;

    if (reduceMotion || typeof next.animate !== 'function') {
      settleTodayBriefItems(items, todayBriefIndex);
      return;
    }

    const travel = direction > 0 ? 28 : -28;
    const timing = {
      duration: 360,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    };
    const token = ++todayBriefTransitionToken;

    const outgoing = current.animate([
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: `translateX(${-travel}px)` },
    ], timing);

    const incoming = next.animate([
      { opacity: 0, transform: `translateX(${travel}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ], timing);

    Promise.allSettled([outgoing.finished, incoming.finished]).then(() => {
      if (token !== todayBriefTransitionToken) return;
      settleTodayBriefItems(items, todayBriefIndex);
      requestAnimationFrame(() => fitTodayBriefText(brief, items[todayBriefIndex]));
    });
  }

  function restartTodayBriefRotation() {
    if (todayBriefTimer !== null) clearInterval(todayBriefTimer);
    todayBriefTimer = setInterval(() => showTodayBriefItem(true, 1), 6500);
  }

  showTodayBriefItem(false);
  restartTodayBriefRotation();

  window.addEventListener('resize', () => {
    const brief = document.getElementById('todaySummary');
    if (brief) requestAnimationFrame(() => fitTodayBriefText(brief));
  }, { passive: true });

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
      'and settings — and cannot be undone.'
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
