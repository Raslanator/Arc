/**
 * render.js
 * All render* functions. Each function reads from appState and writes
 * to the DOM. No function here mutates appState directly.
 *
 * render() is the single top-level entry point — call it after any
 * state mutation to keep the UI in sync.
 */

/* ==========================================================================
   TOP-LEVEL RENDER
   ========================================================================== */

function render() {
  refreshWeekPlan();
  applyHeaderSettings();
  renderGoalsForm();
  applyTheme();
  renderThemeToggle();

  renderArc();
  updateNowMarker();
  renderTimeline();
  renderTodaySummary();

  renderWeekSelect();
  renderWeekDetail();
  renderRecipes();

  renderGrocWeekSelect();
  renderGrocery();

  renderGymSelect();
  renderGymDetail();
  renderProtocols();

  renderQaSelectors();
  renderQuickAdd();
  renderCalSummary();
  renderTodayLog();
  renderRecentDays();
  renderChangeLog('calories', 'calChangeLog');
  renderChangeLog('plan',     'planChangeLog');

  renderTracker();
}

/* ==========================================================================
   HEADER
   ========================================================================== */

function applyHeaderSettings() {
  document.getElementById('headerTarget').textContent    = appState.settings.calorieTarget + ' kcal';
  document.getElementById('headerWakeSleep').textContent =
    `Wake ${minToLabel12(appState.settings.wakeMin)} \u00b7 Sleep ${minToLabel12(appState.settings.sleepMin)}`;
}

/* ==========================================================================
   THEME
   ========================================================================== */

function applyTheme() {
  document.documentElement.setAttribute('data-theme', appState.theme === 'dark' ? 'dark' : 'light');
}

function renderThemeToggle() {
  const theme = appState.theme === 'dark' ? 'dark' : 'light';
  document.querySelectorAll('#themeToggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

/* ==========================================================================
   TODAY — SUMMARY BANNER
   ========================================================================== */

function renderTodaySummary() {
  const el = document.getElementById('todaySummary');
  if (!el) return;
  const plan = getTodayPlan();

  if (!plan.hasPlan) {
    el.innerHTML = `<div class="prep-item"><b>Today \u2014 ${escapeHtml(plan.dayName)}</b>No plan set for today.</div>`;
    return;
  }

  let html = `<div class="prep-item"><b>Today \u2014 ${escapeHtml(plan.dayName)}</b>`;
  if (plan.meals) {
    const l = plan.meals.lunch, d = plan.meals.dinner;
    html += `Lunch: ${l ? escapeHtml(l.name) : '\u2014'} \u00b7 Dinner: ${d ? escapeHtml(d.name) : '\u2014'} <span class="text-accent">(${escapeHtml(String(plan.meals.total))} kcal)</span>`;
  } else {
    html += 'No meal block scheduled today';
  }
  html += '</div>';

  html += `<div class="prep-item"><b>Workout</b>`;
  html += (plan.workout && plan.workout.exercises && plan.workout.exercises.length)
    ? `${escapeHtml(plan.workout.name)} \u2014 ${escapeHtml(plan.workout.sub)}`
    : (plan.workout ? `${escapeHtml(plan.workout.name)} (rest / recovery)` : 'No workout set');
  html += '</div>';

  html += `<div class="prep-item"><b>Calories Logged</b>${escapeHtml(String(plan.calorieTotal))} / ${escapeHtml(String(appState.settings.calorieTarget))} kcal</div>`;
  el.innerHTML = html;
}

/* ==========================================================================
   TODAY — TIMELINE
   ========================================================================== */

function renderTimeline() {
  const list        = document.getElementById('timelineList');
  const todayStatus = appState.timelineStatus[todayKeyStr()] || {};
  const prayerDone  = (appState.prayerStatus && appState.prayerStatus[todayKeyStr()]) || {};

  // Merge timeline events and prayer times, sorted by time.
  const items = TIMELINE.map((ev, i) => ({
    type: 'event', idx: i, time: effectiveT(ev.t, appState.settings),
  }));
  if (prayerTimesToday) {
    PRAYER_NAMES.forEach(name => {
      items.push({ type: 'prayer', name, time: parsePrayerTimeToMin(prayerTimesToday[name]) });
    });
  }
  items.sort((a, b) => a.time - b.time);

  list.innerHTML = items.map(item => {
    if (item.type === 'event') {
      const ev     = TIMELINE[item.idx];
      const status = todayStatus[item.idx];
      // TIMELINE data is static/trusted — no escaping needed for ev.title/body/why.
      // status.time is a formatted time string produced by minToLabel12() — safe.
      return `
        <div class="tl-row ${status ? 'done' : ''}" data-type="event" data-idx="${item.idx}" id="tl-${item.idx}">
          <div class="tl-time">${minToLabel12(item.time)}</div>
          <div>
            <p class="tl-title">${ev.title}</p>
            <p class="tl-body">${ev.body}</p>
            ${ev.why ? `<p class="tl-why">${ev.why}</p>` : ''}
          </div>
          <button class="btn btn-sm ${status ? 'btn-done' : 'btn-ghost'} done-btn" data-idx="${item.idx}" title="Click to edit">
            ${status ? `&#10003; Done${status.mode === 'custom' ? ' \u00b7 ' + escapeHtml(status.time) : ''}` : 'Done'}
          </button>
        </div>`;
    } else {
      // PRAYER_NAMES is a static trusted constant — no escaping needed for item.name.
      const pStatus = getPrayerStatus(item.name, prayerDone);
      const isDone  = !!pStatus;
      return `
        <div class="tl-row prayer-tl-row ${isDone ? 'done' : ''}" data-type="prayer" data-name="${item.name}" id="tl-prayer-${item.name}">
          <div class="tl-time">${minToLabel12(item.time)}</div>
          <div>
            <p class="tl-title">${item.name} <span class="prayer-tag">Salah</span></p>
          </div>
          <button class="btn btn-sm ${isDone ? 'btn-done' : 'btn-ghost'} done-btn prayer-done-btn-tl" data-name="${item.name}" title="Click to edit">
            ${isDone ? `&#10003; Done${pStatus.mode === 'custom' ? ' \u00b7 ' + escapeHtml(pStatus.time) : ''}` : 'Done'}
          </button>
        </div>`;
    }
  }).join('');

  list.querySelectorAll('.done-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => openDoneModal(parseInt(btn.dataset.idx)));
  });
  list.querySelectorAll('.prayer-done-btn-tl').forEach(btn => {
    btn.addEventListener('click', () => openPrayerDoneModal(btn.dataset.name));
  });

  updateNextEventHighlight();
}

function markTimelineDone(idx, mode, time) {
  const key = todayKeyStr();
  if (!appState.timelineStatus[key]) appState.timelineStatus[key] = {};
  appState.timelineStatus[key][idx] = { done: true, mode, time: time || minToLabel12(nowMinutes()) };
  saveState();
  render();
}

function clearTimelineDone(idx) {
  const key = todayKeyStr();
  if (appState.timelineStatus[key]) delete appState.timelineStatus[key][idx];
  saveState();
  render();
}

function updateNextEventHighlight() {
  const t    = nowMinutes();
  const rows = Array.from(document.querySelectorAll('.tl-row'));
  const rowTimes = rows.map(row => {
    if (row.dataset.type === 'prayer') {
      return prayerTimesToday ? parsePrayerTimeToMin(prayerTimesToday[row.dataset.name]) : Infinity;
    }
    return effectiveT(TIMELINE[parseInt(row.dataset.idx)].t, appState.settings);
  });
  const nextIdx = rowTimes.findIndex(rt => rt > t);

  rows.forEach((row, i) => {
    const isNext   = (i === nextIdx);
    row.classList.toggle('next-event', isNext);
    const titleEl  = row.querySelector('.tl-title');
    if (row.dataset.type === 'prayer') {
      titleEl.innerHTML = isNext
        ? `${row.dataset.name} <span class="prayer-tag">Salah</span> <span class="next-badge">NEXT</span>`
        : `${row.dataset.name} <span class="prayer-tag">Salah</span>`;
    } else {
      const title = TIMELINE[parseInt(row.dataset.idx)].title;
      titleEl.innerHTML = isNext
        ? `${title} <span class="next-badge">NEXT</span>`
        : title;
    }
  });
}

/* ==========================================================================
   MEAL PLAN
   ========================================================================== */

function renderWeekSelect() {
  const el = document.getElementById('weekSelect');
  el.innerHTML = BASE_WEEKS.map((w, i) =>
    `<button data-w="${i}" class="${i === appState.currentWeek ? 'active' : ''}">Week ${i + 1}</button>`
  ).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    appState.currentWeek = parseInt(b.dataset.w);
    saveState(); render();
  }));
}

function renderWeekDetail() {
  const w = effectiveWeeks()[appState.currentWeek];

  // Batch cook list: unique recipes used this week.
  const usage = {};
  w.days.forEach((d, di) => {
    [['lunch', d.lunch], ['dinner', d.dinner]].forEach(([slot, id]) => {
      if (!usage[id]) usage[id] = { labels: [], dayIdx: di, slot };
      if (!usage[id].labels.includes(d.label)) usage[id].labels.push(d.label);
    });
  });

  const batchHtml = Object.keys(usage).map(id => {
    const r = getRecipe(id);
    if (!r) return '';
    const u = usage[id];
    return `<div class="batch-card">
      <div>
        <div class="bc-name">${escapeHtml(r.name)} <span class="badge kcal badge-inline">${escapeHtml(String(r.kcalNum))} kcal / ${escapeHtml(r.kcalUnit)}</span></div>
        <div class="bc-days">${u.labels.map(l => `<span>${escapeHtml(l)}</span>`).join('')}</div>
      </div>
      <button class="swap-btn" data-week="${appState.currentWeek}" data-day="${u.dayIdx}" data-slot="${u.slot}">Swap</button>
    </div>`;
  }).join('');

  document.getElementById('prepBanner').innerHTML =
    batchHtml || '<p class="meal-line">No meals set for this week yet.</p>';
  document.getElementById('prepBanner').querySelectorAll('.swap-btn').forEach(btn => {
    btn.addEventListener('click', () => openSwapPicker(parseInt(btn.dataset.week), parseInt(btn.dataset.day), btn.dataset.slot));
  });

  document.getElementById('dayBlocks').innerHTML = `
    <h2 class="view-title week-block-title">${escapeHtml(w.title)}</h2>
    ${w.days.map((d, di) => {
      const { lunch, dinner, total, snack } = dayTotals(d);
      return `
      <div class="day-block">
        <h4>${escapeHtml(d.label)}</h4>
        <div class="meal-row"><span><span class="meal-tag">Breakfast</span>Fixed 600-kcal base</span><span class="meal-kcal">600 kcal</span></div>
        <div class="meal-row">
          <span><span class="meal-tag">Lunch</span><span class="meal-name">${lunch ? escapeHtml(lunch.name) : '\u2014'}</span><span class="meal-kcal">${lunch ? escapeHtml(String(lunch.kcalNum)) : 0} kcal</span></span>
          <button class="swap-btn" data-week="${appState.currentWeek}" data-day="${di}" data-slot="lunch">Swap</button>
        </div>
        <div class="meal-row">
          <span><span class="meal-tag">Dinner</span><span class="meal-name">${dinner ? escapeHtml(dinner.name) : '\u2014'}</span><span class="meal-kcal">${dinner ? escapeHtml(String(dinner.kcalNum)) : 0} kcal</span></span>
          <button class="swap-btn" data-week="${appState.currentWeek}" data-day="${di}" data-slot="dinner">Swap</button>
        </div>
        <div class="total-line">
          <p class="meal-line meal-total-line">Day total: <b>${escapeHtml(String(total))} kcal</b></p>
          <span class="snack-target">Snack target: ~${escapeHtml(String(snack))} kcal</span>
        </div>
      </div>`;
    }).join('')}`;

  document.getElementById('dayBlocks').querySelectorAll('.swap-btn').forEach(btn => {
    btn.addEventListener('click', () => openSwapPicker(parseInt(btn.dataset.week), parseInt(btn.dataset.day), btn.dataset.slot));
  });
}

/* ==========================================================================
   RECIPES
   ========================================================================== */

function renderRecipes() {
  const filterEl = document.getElementById('recipeFilter');
  if (filterEl) {
    filterEl.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', (b.dataset.f === 'archived') === !!appState.recipeShowArchived);
    });
  }

  const showArchived = !!appState.recipeShowArchived;
  const list = showArchived ? allRecipes().filter(r => isArchived(r.id)) : activeRecipes();
  const grid = document.getElementById('recipeGrid');

  grid.innerHTML = list.map(r => `
    <div class="card card-relative" data-id="${escapeHtml(r.id)}">
      <div class="recipe-card-actions">
        <button class="recipe-card-edit edit-btn" data-id="${escapeHtml(r.id)}" title="Edit">${icon('edit')} Edit</button>
        <button class="recipe-card-edit archive-btn" data-id="${escapeHtml(r.id)}" title="${showArchived ? 'Unarchive' : 'Archive'}">${showArchived ? icon('unarchive') + ' Unarchive' : icon('trash') + ' Archive'}</button>
      </div>
      <h3 class="card-title-padded">${escapeHtml(r.name)}</h3>
      <div class="badges">
        <span class="badge kcal">${escapeHtml(String(r.kcalNum))} kcal / ${escapeHtml(r.kcalUnit)}</span>
        <span class="badge">${escapeHtml(r.time)}</span>
        <span class="badge cost">${escapeHtml(r.cost.split('(')[0].trim())}</span>
        ${r.isCustom   ? '<span class="badge custom">Custom</span>'   : ''}
        ${showArchived ? '<span class="badge custom">Archived</span>' : ''}
        ${sanitizeUrl(r.youtubeLink) ? `<span class="badge watch-btn" data-url="${escapeHtml(sanitizeUrl(r.youtubeLink))}">${icon('play')} Watch</span>` : ''}
      </div>
    </div>
  `).join('') || `<p class="meal-line">${showArchived ? 'No archived recipes.' : 'No recipes here \u2014 add one, or check Archived.'}</p>`;

  grid.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => openRecipe(getRecipe(c.dataset.id)));
  });
  grid.querySelectorAll('.watch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const safeUrl = sanitizeUrl(btn.dataset.url);
      if (safeUrl) window.open(safeUrl, '_blank', 'noopener noreferrer');
    });
  });
  grid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openRecipeForm(getRecipe(btn.dataset.id)); });
  });
  grid.querySelectorAll('.archive-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (showArchived) unarchiveRecipe(btn.dataset.id); else handleArchiveRecipe(btn.dataset.id);
    });
  });
}

/* ==========================================================================
   GROCERY
   ========================================================================== */

function renderGrocWeekSelect() {
  const el = document.getElementById('grocWeekSelect');
  el.innerHTML = BASE_WEEKS.map((w, i) =>
    `<button data-w="${i}" class="${i === appState.grocWeek ? 'active' : ''}">Week ${i + 1}</button>`
  ).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    appState.grocWeek = parseInt(b.dataset.w);
    saveState(); render();
  }));
}

function renderGrocery() {
  const ids  = weekRecipeIds(appState.grocWeek);
  const grid = document.getElementById('groceryGrid');
  let html = '', total = 0, doneCount = 0;

  if (ids.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <p class="empty-state__message">No meals set for this week &mdash; add some in the Meal Plan tab.</p>
      </div>`;
    document.getElementById('grocProgress').textContent = '0 / 0 checked';
    return;
  }

  ids.forEach(id => {
    const r = getRecipe(id);
    if (!r) return;
    html += `<div class="grocery-section-header">${escapeHtml(r.name)}</div>`;
    r.ingredients.forEach((item, i) => {
      const key     = `w${appState.grocWeek}-${id}-${i}`;
      const checked = !!appState.grocery[key];
      total++; if (checked) doneCount++;
      html += `<label class="grocery-item ${checked ? 'checked' : ''}" data-key="${key}">
        <input type="checkbox" ${checked ? 'checked' : ''}/>
        <span>${escapeHtml(item)}</span>
      </label>`;
    });
  });

  grid.innerHTML = html;
  grid.querySelectorAll('.grocery-item').forEach(el => {
    el.querySelector('input').addEventListener('change', e => {
      appState.grocery[el.dataset.key] = e.target.checked;
      saveState(); render();
    });
  });
  document.getElementById('grocProgress').textContent = `${doneCount} / ${total} checked`;
}

/* ==========================================================================
   GYM
   ========================================================================== */

function renderGymSelect() {
  const el   = document.getElementById('gymDaySelect');
  const days = effectiveGymDays();
  el.innerHTML = days.map((d, i) =>
    `<button data-i="${i}" class="${i === appState.gymDay ? 'active' : ''}"><b>${d.name}</b>${d.label}</button>`
  ).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    appState.gymDay = parseInt(b.dataset.i);
    saveState(); render();
  }));
}

function renderGymDetail() {
  const d      = effectiveGymDays()[appState.gymDay];
  const exHtml = d.exercises.length
    ? d.exercises.map(([name, sets]) =>
        `<div class="exercise-row"><span>${escapeHtml(name)}</span><span class="sets">${escapeHtml(sets)}</span></div>`
      ).join('')
    : '<p class="meal-line">No lifting today.</p>';

  document.getElementById('gymDayDetail').innerHTML = `
    <button class="btn btn-teal btn-sm btn-card-action" id="editGymDayBtn">Edit Day</button>
    <h4>${escapeHtml(d.label)} \u2014 ${escapeHtml(d.name)} <span class="text-muted-label">(${escapeHtml(d.sub)})</span></h4>
    ${exHtml}
    <p class="snack-target cardio-note">${escapeHtml(d.cardio)}</p>
  `;
  document.getElementById('editGymDayBtn').addEventListener('click', () => openGymEdit(appState.gymDay));
}

function renderProtocols() {
  document.getElementById('protocolGrid').innerHTML = PROTOCOLS.map(p => `
    <div class="protocol-card ${p.warn ? 'warning-card' : ''}">
      <h5>${p.title}</h5>
      <p>${p.body}</p>
    </div>
  `).join('');
}

/* ==========================================================================
   RECOVERY / CARDIO TRACKER
   ========================================================================== */

function renderTracker() {
  const wk   = getTrackerWeek();
  const days = effectiveGymDays();
  document.getElementById('trackerWeekLabel').textContent =
    `${fmtShort(currentTrackerWeekKey())} \u2013 ${fmtShort(getWeekDateKeys()[6])}`;

  const list = document.getElementById('cardioSwimList');
  list.innerHTML = days.map((d, i) => {
    const state = wk.days[i] || { cardio: false, swim: false };
    return `
      <div class="tracker-row">
        <div class="tr-day"><b>${escapeHtml(d.label)} \u2014 ${escapeHtml(d.name)}</b><span>${escapeHtml(d.cardio)}</span></div>
        <label class="tr-check"><input type="checkbox" data-day="${i}" data-kind="cardio" ${state.cardio ? 'checked' : ''}/> Cardio</label>
        <label class="tr-check"><input type="checkbox" data-day="${i}" data-kind="swim"  ${state.swim  ? 'checked' : ''}/> Swim</label>
      </div>`;
  }).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => {
      const w = getTrackerWeek();
      const dayIdx = box.dataset.day, kind = box.dataset.kind;
      if (!w.days[dayIdx]) w.days[dayIdx] = { cardio: false, swim: false };
      w.days[dayIdx][kind] = box.checked;
      saveState(); render();
    });
  });

  document.getElementById('saunaCount').textContent = wk.sauna;
  document.getElementById('steamCount').textContent = wk.steam;
}

/* ==========================================================================
   CALORIE CALCULATOR
   ========================================================================== */

function renderCalSummary() {
  const key          = todayKeyStr();
  const dailyTarget  = appState.settings.calorieTarget;
  const weeklyTarget = dailyTarget * 7;
  const todayEntries = appState.calories[key] || [];
  const todayConsumed = todayEntries.reduce((s, e) => s + e.kcal, 0);
  const todayLeft    = dailyTarget - todayConsumed;

  const weekKeys     = getWeekDateKeys();
  const weekConsumed = weekKeys.reduce((s, k) =>
    s + ((appState.calories[k] || []).reduce((ss, e) => ss + e.kcal, 0)), 0);
  const weekLeft = weeklyTarget - weekConsumed;

  document.getElementById('todayDateLabel').textContent  = fmtShort(key);
  document.getElementById('weekRangeLabel').textContent  = `${fmtShort(weekKeys[0])} \u2013 ${fmtShort(weekKeys[6])}`;
  document.getElementById('todayTarget').textContent     = dailyTarget;
  document.getElementById('weekTarget').textContent      = weeklyTarget;
  document.getElementById('todayConsumed').textContent   = todayConsumed;
  document.getElementById('weekConsumed').textContent    = weekConsumed;

  const todayFill = document.getElementById('todayFill');
  const weekFill  = document.getElementById('weekFill');
  todayFill.style.width = Math.min(100, (todayConsumed / dailyTarget)  * 100) + '%';
  weekFill.style.width  = Math.min(100, (weekConsumed  / weeklyTarget) * 100) + '%';
  todayFill.classList.toggle('over', todayConsumed > dailyTarget);
  weekFill.classList.toggle('over',  weekConsumed  > weeklyTarget);

  const todayLeftEl = document.getElementById('todayLeft');
  const weekLeftEl  = document.getElementById('weekLeft');
  todayLeftEl.textContent = todayLeft >= 0 ? `${todayLeft} left` : `${Math.abs(todayLeft)} over`;
  todayLeftEl.classList.toggle('over', todayLeft < 0);
  weekLeftEl.textContent  = weekLeft  >= 0 ? `${weekLeft} left`  : `${Math.abs(weekLeft)} over`;
  weekLeftEl.classList.toggle('over',  weekLeft  < 0);
}

function renderQaSelectors() {
  const wEl = document.getElementById('qaWeek');
  wEl.innerHTML = BASE_WEEKS.map((w, i) =>
    `<option value="${i}" ${i === appState.qaWeekIdx ? 'selected' : ''}>Week ${i + 1}</option>`
  ).join('');

  const dEl = document.getElementById('qaDay');
  dEl.innerHTML = effectiveWeeks()[appState.qaWeekIdx].days.map((d, i) =>
    `<option value="${i}" ${i === appState.qaDayIdx ? 'selected' : ''}>${d.label}</option>`
  ).join('');

  wEl.onchange = () => { appState.qaWeekIdx = parseInt(wEl.value); appState.qaDayIdx = 0; saveState(); render(); };
  dEl.onchange = () => { appState.qaDayIdx  = parseInt(dEl.value); saveState(); render(); };
}

function renderQuickAdd() {
  const day  = effectiveWeeks()[appState.qaWeekIdx].days[appState.qaDayIdx];
  const { lunch, dinner, snack } = dayTotals(day);
  const row  = document.getElementById('quickAddRow');
  const items = [
    { label: 'Breakfast',                          kcal: BREAKFAST_KCAL },
    { label: `Lunch: ${lunch  ? lunch.name  : '\u2014'}`, kcal: lunch  ? lunch.kcalNum  : 0 },
    { label: `Dinner: ${dinner ? dinner.name : '\u2014'}`, kcal: dinner ? dinner.kcalNum : 0 },
    { label: 'Snack target',                       kcal: snack },
  ];
  row.innerHTML = items.map((it, i) =>
    `<button type="button" class="qa-btn" data-i="${i}">${it.label}<span class="qkcal">+${it.kcal} kcal</span></button>`
  ).join('');
  row.querySelectorAll('.qa-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => addCalEntry(items[i].label, items[i].kcal));
  });
}

function renderTodayLog() {
  const key     = todayKeyStr();
  const entries = appState.calories[key] || [];
  const list    = document.getElementById('todayLogList');
  if (entries.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <p class="empty-state__message">Nothing logged yet today.</p>
      </div>`;
    return;
  }
  list.innerHTML = entries.map(e => `
    <div class="log-entry">
      <span class="le-label">${escapeHtml(e.label)}</span>
      <span class="le-right">
        <span class="le-kcal">${escapeHtml(String(e.kcal))} kcal</span>
        <button class="le-del" data-id="${escapeHtml(e.id)}" title="Remove">&times;</button>
      </span>
    </div>
  `).join('');
  list.querySelectorAll('.le-del').forEach(btn => {
    btn.addEventListener('click', () => removeCalEntry(key, btn.dataset.id));
  });
}

function renderRecentDays() {
  const list = document.getElementById('recentDaysList');
  if (!list) return;
  const yKey    = getRecentDateKeys(2)[1];
  const entries = appState.calories[yKey] || [];
  if (entries.length === 0) {
    list.innerHTML = '<p class="log-empty">Nothing logged yesterday.</p>';
    return;
  }
  const total  = entries.reduce((s, e) => s + e.kcal, 0);
  const target = appState.settings.calorieTarget;
  list.innerHTML = entries.map(e => `
    <div class="log-entry">
      <span class="le-label">${escapeHtml(e.label)}</span>
      <span class="le-right">
        <span class="le-kcal">${escapeHtml(String(e.kcal))} kcal</span>
        <button class="le-del" data-id="${escapeHtml(e.id)}" title="Remove">&times;</button>
      </span>
    </div>
  `).join('') + `
    <div class="log-entry log-total-row">
      <span class="le-label text-bold">Total</span>
      <span class="le-right"><span class="le-kcal${total > target ? ' cal-left over' : ''}">${escapeHtml(String(total))} / ${escapeHtml(String(target))} kcal</span></span>
    </div>`;
  list.querySelectorAll('.le-del').forEach(btn => {
    btn.addEventListener('click', () => removeCalEntry(yKey, btn.dataset.id));
  });
}

function renderChangeLog(section, containerId) {
  const el      = document.getElementById(containerId);
  if (!el) return;
  const entries = appState.changeLog[section] || [];
  if (entries.length === 0) {
    el.innerHTML = '<p class="log-empty">No changes yet.</p>';
    return;
  }
  el.innerHTML = entries.map(e => `
    <div class="log-entry">
      <span class="le-label">${escapeHtml(e.text)}</span>
      <span class="le-right">
        <button class="le-del" data-id="${escapeHtml(e.id)}" title="Remove">&times;</button>
      </span>
    </div>
  `).join('');
  el.querySelectorAll('.le-del').forEach(btn => {
    btn.addEventListener('click', () => removeChangeEntry(section, btn.dataset.id));
  });
}

/* ==========================================================================
   GOALS / SETTINGS
   ========================================================================== */

function renderGoalsForm() {
  document.getElementById('goalDailyTarget').value = appState.settings.calorieTarget;
  document.getElementById('goalWake').value        = minToHHMM(appState.settings.wakeMin);
  document.getElementById('goalSleep').value       = minToHHMM(appState.settings.sleepMin);
  mountTimePicker(document.getElementById('goalWake'));
  mountTimePicker(document.getElementById('goalSleep'));
}
