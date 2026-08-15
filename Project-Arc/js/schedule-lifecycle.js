/**
 * schedule-lifecycle.js
 * Keeps the editable schedule integrated with UI state that main.js owns.
 */

(function bridgeScheduleLifecycle() {
  /* ================================================================
     PASS 3 — CALORIE HISTORY + VIEW PREP
     Calorie entries are historical data. Never prune old date buckets on load
     or day rollover; Progress will consume the same preserved source later.
     ================================================================ */

  pruneOldCalorieLogs = function preserveCalorieHistory() {
    if (!appState.calories || typeof appState.calories !== 'object') {
      appState.calories = {};
    }
  };

  function calorieDayTotal(dateKey_) {
    return ((appState.calories && appState.calories[dateKey_]) || [])
      .reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
  }

  window.ArcCalories = {
    getDayTotal: calorieDayTotal,
    getHistory() {
      return Object.keys(appState.calories || {})
        .sort((a, b) => b.localeCompare(a))
        .map(dateKey_ => ({
          dateKey: dateKey_,
          total: calorieDayTotal(dateKey_),
          entries: (appState.calories[dateKey_] || []).map(entry => ({ ...entry })),
        }));
    },
    getRangeSummary(dateKeys) {
      const keys = Array.isArray(dateKeys) ? dateKeys : [];
      const total = keys.reduce((sum, key) => sum + calorieDayTotal(key), 0);
      return {
        total,
        days: keys.map(key => ({ dateKey: key, total: calorieDayTotal(key) })),
      };
    },
  };

  function prepareCaloriesPass3Dom() {
    const view = document.getElementById('view-calories');
    if (!view) return;

    const summaryCards = view.querySelectorAll('.cal-summary .cal-card');
    if (summaryCards[0]) summaryCards[0].classList.add('cal-card-today');
    if (summaryCards[1]) summaryCards[1].classList.add('cal-card-week');

    const customForm = document.getElementById('customAddForm');
    if (customForm) {
      // The stepper intentionally moves by 50 kcal, but typed values may be
      // any positive integer. main.js already validates label + kcal on submit,
      // so disable the browser's native step-mismatch popup for this form.
      customForm.noValidate = true;
    }

    const kcalInput = document.getElementById('customKcal');
    if (kcalInput) {
      kcalInput.min = '0';
      kcalInput.step = '50';
      kcalInput.inputMode = 'numeric';
      kcalInput.setAttribute('aria-label', 'Calories');
    }

    // Yesterday's data remains preserved in appState; only the redundant UI
    // block is removed. Historical views will return in the Progress phase.
    const recentDays = document.getElementById('recentDaysList');
    const yesterdayBlock = recentDays && recentDays.closest('.day-block');
    if (yesterdayBlock) yesterdayBlock.remove();

    const quickBlock = document.getElementById('quickAddRow')?.closest('.day-block');
    const customBlock = document.getElementById('customAddForm')?.closest('.day-block');
    if (quickBlock && customBlock && !view.querySelector('.cal-entry-grid')) {
      const entryGrid = document.createElement('div');
      entryGrid.className = 'cal-entry-grid';
      quickBlock.parentNode.insertBefore(entryGrid, quickBlock);
      entryGrid.append(quickBlock, customBlock);
    }

    const todayLogBlock = document.getElementById('todayLogList')?.closest('.day-block');
    if (todayLogBlock) todayLogBlock.classList.add('cal-today-log');
  }

  prepareCaloriesPass3Dom();

  // Preserve an intentionally empty schedule across reloads. The core schedule
  // loader seeds defaults only when the field is absent; an empty saved array
  // means the user deliberately deleted every event.
  const scheduleLoadState = loadState;
  loadState = function loadStateWithEmptyScheduleSupport() {
    const stored = Storage.get('appState');
    const preserveEmpty = !!(stored && Array.isArray(stored.timelineEvents) && stored.timelineEvents.length === 0);
    scheduleLoadState();
    if (preserveEmpty) {
      appState.timelineEvents = [];
      saveState();
    }
  };

  /* ================================================================
     TIMELINE EDIT MODE
     Keep the normal Timeline visually clean. Schedule-management controls are
     only exposed after the single master Edit button is pressed.
     ================================================================ */

  let scheduleEditMode = false;

  function applyScheduleEditMode(list) {
    if (!list) return;

    // Remove the small event-count / editable detail beside the heading.
    const meta = list.querySelector('.schedule-toolbar-meta');
    if (meta) meta.remove();

    const actions = list.querySelector('.schedule-toolbar-actions');
    if (!actions) return;

    let modeBtn = actions.querySelector('#scheduleModeBtn');
    if (!modeBtn) {
      modeBtn = document.createElement('button');
      modeBtn.type = 'button';
      modeBtn.id = 'scheduleModeBtn';
      actions.appendChild(modeBtn);
      modeBtn.addEventListener('click', () => {
        scheduleEditMode = !scheduleEditMode;
        applyScheduleEditMode(list);
      });
    }

    modeBtn.className = scheduleEditMode
      ? 'btn btn-primary btn-sm schedule-mode-toggle'
      : 'btn btn-ghost btn-sm schedule-mode-toggle';
    modeBtn.textContent = scheduleEditMode ? 'Done' : 'Edit';
    modeBtn.setAttribute('aria-pressed', scheduleEditMode ? 'true' : 'false');
    modeBtn.setAttribute('aria-label', scheduleEditMode ? 'Finish editing Daily Timeline' : 'Edit Daily Timeline');

    const addBtn = list.querySelector('#scheduleAddBtn');
    const resetBtn = list.querySelector('#scheduleResetBtn');
    if (addBtn) addBtn.hidden = !scheduleEditMode;
    if (resetBtn) resetBtn.hidden = !scheduleEditMode;

    list.querySelectorAll('.schedule-edit-btn').forEach(btn => {
      btn.hidden = !scheduleEditMode;
    });
  }

  const scheduleRenderTimeline = renderTimeline;
  renderTimeline = function renderTimelineWithMasterEditMode() {
    scheduleRenderTimeline();
    applyScheduleEditMode(document.getElementById('timelineList'));
  };

  /* ================================================================
     CONTEXTUAL DAILY BRIEF
     Five stable cards driven from live app data. This keeps the existing
     carousel layout/motion but makes the content useful across the whole app.
     ================================================================ */

  function scheduleEventsForBrief() {
    return (window.ArcSchedule && typeof window.ArcSchedule.getEvents === 'function')
      ? window.ArcSchedule.getEvents()
      : [];
  }

  function scheduleEventForBrief(id) {
    return scheduleEventsForBrief().find(ev => ev.id === id) || null;
  }

  function groceryProgressForWeek(weekIdx) {
    const ids = weekRecipeIds(weekIdx);
    let total = 0;
    let checked = 0;

    ids.forEach(id => {
      const recipe = getRecipe(id);
      if (!recipe) return;
      recipe.ingredients.forEach((_, i) => {
        total++;
        if (appState.grocery[`w${weekIdx}-${id}-${i}`]) checked++;
      });
    });

    return { total, checked, remaining: Math.max(0, total - checked) };
  }

  function nextPrayerForBrief() {
    if (!prayerTimesToday) return null;
    const now = nowMinutes();
    let next = null;

    PRAYER_NAMES.forEach(name => {
      const time = parsePrayerTimeToMin(prayerTimesToday[name]);
      if (!Number.isFinite(time) || time <= now) return;
      if (!next || time < next.time) next = { type: 'prayer', name, time };
    });

    return next;
  }

  function nextCheckpointForBrief() {
    const nextEvent = (window.ArcSchedule && typeof window.ArcSchedule.getNext === 'function')
      ? window.ArcSchedule.getNext()
      : null;
    const nextPrayer = nextPrayerForBrief();

    if (nextPrayer && (!nextEvent || nextPrayer.time < nextEvent.effectiveTime)) {
      return {
        type: 'prayer',
        title: `${nextPrayer.name} Salah`,
        time: nextPrayer.time,
        body: '',
      };
    }

    if (nextEvent) {
      return {
        type: 'event',
        title: nextEvent.title,
        time: nextEvent.effectiveTime,
        body: nextEvent.body || '',
      };
    }

    return null;
  }

  function timeUntilLabel(targetTime) {
    const diff = Math.max(0, Math.round(targetTime - nowMinutes()));
    if (diff < 1) return 'now';
    if (diff < 60) return `in ${diff} min`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  }

  function buildUpNextDetail() {
    const next = nextCheckpointForBrief();
    if (!next) return 'No more scheduled checkpoints today.';

    const body = next.body
      ? ` · ${escapeHtml(next.body.length > 95 ? next.body.slice(0, 92) + '…' : next.body)}`
      : '';
    return `<span class="brief-time-accent">${escapeHtml(minToLabel12(next.time))}</span> · ${escapeHtml(next.title)} · ${escapeHtml(timeUntilLabel(next.time))}${body}`;
  }

  function renderContextualBriefSource(el) {
    const plan = getTodayPlan();
    const lunchEvent = scheduleEventForBrief('lunch');
    const dinnerEvent = scheduleEventForBrief('dinner');
    const gymEvent = scheduleEventForBrief('gym');

    const lunchPrefix = lunchEvent ? `${minToLabel12(lunchEvent.effectiveTime)} · ` : '';
    const dinnerPrefix = dinnerEvent ? `${minToLabel12(dinnerEvent.effectiveTime)} · ` : '';
    const gymPrefix = gymEvent ? `${minToLabel12(gymEvent.effectiveTime)} · ` : '';

    let mealsText = 'No meal block scheduled today.';
    if (plan.meals) {
      const lunch = plan.meals.lunch;
      const dinner = plan.meals.dinner;
      mealsText = `Lunch ${escapeHtml(lunchPrefix)}${lunch ? escapeHtml(lunch.name) : '—'} · Dinner ${escapeHtml(dinnerPrefix)}${dinner ? escapeHtml(dinner.name) : '—'} <span class="text-accent">(${escapeHtml(String(plan.meals.total))} kcal)</span>`;
    }

    let workoutText = 'No workout set.';
    if (plan.workout && plan.workout.exercises && plan.workout.exercises.length) {
      const count = plan.workout.exercises.length;
      workoutText = `${escapeHtml(gymPrefix)}${escapeHtml(plan.workout.name)} — ${escapeHtml(plan.workout.sub)} · ${count} exercise${count === 1 ? '' : 's'}`;
    } else if (plan.workout) {
      workoutText = `${escapeHtml(gymPrefix)}${escapeHtml(plan.workout.name)} · rest / recovery`;
    }

    const target = appState.settings.calorieTarget;
    const logged = plan.calorieTotal;
    const remaining = target - logged;
    const calorieText = remaining >= 0
      ? `${escapeHtml(String(remaining))} kcal remaining · ${escapeHtml(String(logged))} / ${escapeHtml(String(target))} logged`
      : `${escapeHtml(String(Math.abs(remaining)))} kcal over target · ${escapeHtml(String(logged))} / ${escapeHtml(String(target))} logged`;

    const grocery = groceryProgressForWeek(appState.currentWeek);
    let groceryText = 'No grocery items for the current meal-plan week.';
    if (grocery.total > 0 && grocery.remaining > 0) {
      groceryText = `${grocery.remaining} item${grocery.remaining === 1 ? '' : 's'} left · ${grocery.checked} / ${grocery.total} checked`;
    } else if (grocery.total > 0) {
      groceryText = `All ${grocery.total} grocery items checked off.`;
    }

    el.innerHTML = `
      <div class="prep-item" data-brief-key="meals"><b>Meals</b>${mealsText}</div>
      <div class="prep-item" data-brief-key="workout"><b>Workout</b>${workoutText}</div>
      <div class="prep-item" data-brief-key="calories"><b>Calories Logged</b>${calorieText}</div>
      <div class="prep-item" data-brief-key="groceries"><b>Groceries</b>${escapeHtml(groceryText)}</div>
      <div class="prep-item" data-brief-key="up-next"><b>Up Next</b>${buildUpNextDetail()}</div>
    `;
  }

  renderTodaySummary = function renderTodaySummaryPreservingCarousel() {
    const el = document.getElementById('todaySummary');
    if (!el) return;

    const shell = el.querySelector('.daily-brief-shell');
    const stage = shell && shell.querySelector('.daily-brief-stage');
    if (!shell || !stage) {
      renderContextualBriefSource(el);
      return;
    }

    const previousItems = Array.from(stage.querySelectorAll('.daily-brief-item'));
    let activeIndex = previousItems.findIndex(item => item.getAttribute('aria-hidden') === 'false');
    if (activeIndex < 0) activeIndex = 0;

    // Produce fresh source items, then move them into the existing carousel
    // shell so its arrow listeners and smooth-motion structure remain alive.
    renderContextualBriefSource(el);
    const freshItems = Array.from(el.querySelectorAll(':scope > .prep-item'));
    stage.replaceChildren(...freshItems);

    const nextItems = Array.from(stage.querySelectorAll('.prep-item'));
    if (activeIndex >= nextItems.length) activeIndex = 0;
    nextItems.forEach((item, index) => {
      item.classList.add('daily-brief-item');
      item.hidden = index !== activeIndex;
      item.setAttribute('aria-hidden', index === activeIndex ? 'false' : 'true');
    });

    const dayStrong = shell.querySelector('.daily-brief-day strong');
    if (dayStrong) dayStrong.textContent = `Today / ${planDayName()}`;

    el.replaceChildren(shell);
  };

  function planDayName() {
    const plan = getTodayPlan();
    return plan.dayName;
  }

  function refreshUpNextBriefOnly() {
    const item = document.querySelector('#todaySummary [data-brief-key="up-next"]');
    if (!item) return;
    item.innerHTML = `<b>Up Next</b>${buildUpNextDetail()}`;
  }

  // The Timeline's NEXT calculation already runs once per second. Piggyback on
  // that cheap tick so the Up Next card stays accurate without full re-renders.
  const scheduleUpdateNextEventHighlight = updateNextEventHighlight;
  updateNextEventHighlight = function updateNextEventHighlightWithBrief() {
    scheduleUpdateNextEventHighlight();
    refreshUpNextBriefOnly();
  };
})();
