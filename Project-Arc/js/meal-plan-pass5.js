/**
 * meal-plan-pass5.js
 * Pass 5 — Meal Plan + Grocery integrity and interaction polish.
 *
 * A removed meal is represented by a reserved override value so the existing
 * weekOverrides + change-log architecture remains the single persistence path.
 * effectiveWeeks() converts that reserved value back to null for consumers.
 */

(function initMealPlanPass5() {
  const REMOVED_MEAL_ID = '__arc_removed_meal__';

  function mealOverrideKey(weekIdx, dayIdx, slot) {
    return `w${weekIdx}-${dayIdx}-${slot}`;
  }

  function previousOverrideValue(key) {
    return Object.prototype.hasOwnProperty.call(appState.weekOverrides, key)
      ? appState.weekOverrides[key]
      : null;
  }

  /* -----------------------------------------------------------------------
     DERIVED PLAN: translate the reserved removal marker into an empty slot.
     ----------------------------------------------------------------------- */

  const pass5BaseEffectiveWeeks = effectiveWeeks;
  effectiveWeeks = function effectiveWeeksWithRemovedMeals() {
    const weeks = pass5BaseEffectiveWeeks();
    weeks.forEach((week, wi) => {
      week.days.forEach((day, di) => {
        ['lunch', 'dinner'].forEach(slot => {
          const key = mealOverrideKey(wi, di, slot);
          if (appState.weekOverrides && appState.weekOverrides[key] === REMOVED_MEAL_ID) {
            day[slot] = null;
          }
        });
      });
    });
    return weeks;
  };

  // Only real, currently used recipes may feed Grocery.
  weekRecipeIds = function pass5WeekRecipeIds(weekIdx) {
    const week = effectiveWeeks()[weekIdx];
    if (!week) return [];
    const ids = [];
    week.days.forEach(day => {
      [day.lunch, day.dinner].forEach(id => {
        if (id && getRecipe(id) && !ids.includes(id)) ids.push(id);
      });
    });
    return ids;
  };

  function clearRecipeGroceryChecks(weekIdx, recipeId) {
    const prefix = `w${weekIdx}-${recipeId}-`;
    Object.keys(appState.grocery || {}).forEach(key => {
      if (key.startsWith(prefix)) delete appState.grocery[key];
    });
  }

  function cleanupUnusedGroceryChecks(weekIdx) {
    const used = new Set(weekRecipeIds(weekIdx));
    const prefix = `w${weekIdx}-`;
    let changed = false;

    Object.keys(appState.grocery || {}).forEach(key => {
      if (!key.startsWith(prefix)) return;
      const rest = key.slice(prefix.length);
      const match = rest.match(/^(.*)-(\d+)$/);
      if (!match) return;
      const recipeId = match[1];
      if (!used.has(recipeId)) {
        delete appState.grocery[key];
        changed = true;
      }
    });

    return changed;
  }

  /* -----------------------------------------------------------------------
     CHANGE-LOG SUPPORT: one batch removal can still be undone as one change.
     ----------------------------------------------------------------------- */

  const pass5BaseApplyRevert = applyRevert;
  applyRevert = function applyPass5Revert(revert) {
    if (revert && revert.type === 'weekOverrideBatch') {
      (revert.entries || []).forEach(entry => {
        if (entry.prevValue === null || entry.prevValue === undefined) {
          delete appState.weekOverrides[entry.key];
        } else {
          appState.weekOverrides[entry.key] = entry.prevValue;
        }
      });
      cleanupUnusedGroceryChecks(revert.weekIdx);
      refreshWeekPlan();
      return;
    }
    pass5BaseApplyRevert(revert);
  };

  function removeMealSlot(weekIdx, dayIdx, slot) {
    const week = effectiveWeeks()[weekIdx];
    const day = week && week.days[dayIdx];
    if (!day || !day[slot]) return;

    const recipe = getRecipe(day[slot]);
    const key = mealOverrideKey(weekIdx, dayIdx, slot);
    const prevValue = previousOverrideValue(key);

    appState.weekOverrides[key] = REMOVED_MEAL_ID;
    cleanupUnusedGroceryChecks(weekIdx);
    logChange(
      'plan',
      `${day.label} ${slot}: removed “${recipe ? recipe.name : 'meal'}”`,
      { type: 'weekOverride', key, prevValue }
    );
    saveState();
    render();
  }

  function removeRecipeFromWeek(weekIdx, recipeId) {
    const week = effectiveWeeks()[weekIdx];
    const recipe = getRecipe(recipeId);
    if (!week || !recipe) return;

    const matches = [];
    week.days.forEach((day, di) => {
      ['lunch', 'dinner'].forEach(slot => {
        if (day[slot] !== recipeId) return;
        const key = mealOverrideKey(weekIdx, di, slot);
        matches.push({ key, prevValue: previousOverrideValue(key) });
      });
    });
    if (!matches.length) return;

    const slotWord = matches.length === 1 ? 'meal slot' : 'meal slots';
    const ok = confirm(`Remove “${recipe.name}” from ${matches.length} ${slotWord} this week?`);
    if (!ok) return;

    matches.forEach(entry => {
      appState.weekOverrides[entry.key] = REMOVED_MEAL_ID;
    });
    cleanupUnusedGroceryChecks(weekIdx);
    logChange(
      'plan',
      `Removed “${recipe.name}” from ${matches.length} ${slotWord} this week`,
      { type: 'weekOverrideBatch', weekIdx, entries: matches }
    );
    saveState();
    render();
  }

  /* -----------------------------------------------------------------------
     SWAP / ADD: same picker behavior, plus stale Grocery cleanup.
     ----------------------------------------------------------------------- */

  openSwapPicker = function openPass5SwapPicker(weekIdx, dayIdx, slot) {
    const cardsHtml = activeRecipes().map(recipe => `
      <div class="picker-card" data-id="${escapeHtml(recipe.id)}">
        <h6>${escapeHtml(recipe.name)}</h6>
        <span class="badge kcal">${escapeHtml(String(recipe.kcalNum))} kcal / ${escapeHtml(recipe.kcalUnit)}</span>
        ${recipe.isCustom ? '<span class="badge custom">Custom</span>' : ''}
      </div>
    `).join('');

    const currentWeek = effectiveWeeks()[weekIdx];
    const currentDay = currentWeek && currentWeek.days[dayIdx];
    const hasMeal = !!(currentDay && currentDay[slot]);

    openModal(`
      <button class="modal-close" id="modalClose">&times;</button>
      <h3>${hasMeal ? 'Swap' : 'Add'} ${slot === 'lunch' ? 'Lunch' : 'Dinner'}</h3>
      <p class="view-desc modal-desc">Pick a recipe — totals, batch cook, and Grocery update together.</p>
      <div class="picker-grid">${cardsHtml}</div>
    `);

    document.getElementById('modalContent').querySelectorAll('.picker-card').forEach(card => {
      card.addEventListener('click', () => {
        const week = effectiveWeeks()[weekIdx];
        const day = week.days[dayIdx];
        const oldRecipe = getRecipe(day[slot]);
        const newRecipe = getRecipe(card.dataset.id);
        const key = mealOverrideKey(weekIdx, dayIdx, slot);
        const prevValue = previousOverrideValue(key);
        const usedBefore = new Set(weekRecipeIds(weekIdx));

        // If this recipe was not already used this week, start its Grocery
        // checklist fresh instead of resurrecting stale checks from old builds.
        if (!usedBefore.has(card.dataset.id)) {
          clearRecipeGroceryChecks(weekIdx, card.dataset.id);
        }

        appState.weekOverrides[key] = card.dataset.id;
        cleanupUnusedGroceryChecks(weekIdx);

        const text = oldRecipe
          ? `${day.label} ${slot}: “${oldRecipe.name}” → “${newRecipe ? newRecipe.name : '—'}”`
          : `${day.label} ${slot}: added “${newRecipe ? newRecipe.name : 'meal'}”`;
        logChange('plan', text, { type: 'weekOverride', key, prevValue });

        saveState();
        closeModal();
        render();
      });
    });
  };

  /* -----------------------------------------------------------------------
     MEAL PLAN RENDER
     ----------------------------------------------------------------------- */

  function mealRowHtml(slot, recipe, weekIdx, dayIdx) {
    const label = slot === 'lunch' ? 'Lunch' : 'Dinner';
    if (!recipe) {
      return `
        <div class="meal-row pass5-meal-row meal-row-empty">
          <span class="pass5-meal-copy">
            <span class="meal-tag">${label}</span>
            <span class="meal-name">No meal set</span>
          </span>
          <div class="meal-row-actions">
            <button class="swap-btn meal-add-btn" data-week="${weekIdx}" data-day="${dayIdx}" data-slot="${slot}">+ Add meal</button>
          </div>
        </div>`;
    }

    return `
      <div class="meal-row pass5-meal-row">
        <span class="pass5-meal-copy">
          <span class="meal-tag">${label}</span>
          <span class="meal-name">${escapeHtml(recipe.name)}</span>
          <span class="meal-kcal">${escapeHtml(String(recipe.kcalNum))} kcal</span>
        </span>
        <div class="meal-row-actions">
          <button class="swap-btn meal-swap-btn" data-week="${weekIdx}" data-day="${dayIdx}" data-slot="${slot}">Swap</button>
          <button class="meal-remove-btn" data-week="${weekIdx}" data-day="${dayIdx}" data-slot="${slot}" aria-label="Remove ${label}">Remove</button>
        </div>
      </div>`;
  }

  renderWeekDetail = function renderPass5WeekDetail() {
    const weekIdx = appState.currentWeek;
    const week = effectiveWeeks()[weekIdx];
    if (!week) return;
    const isActiveWeek = weekIdx === appState.activeMealPlanWeek;

    const usage = {};
    week.days.forEach((day, di) => {
      [['lunch', day.lunch], ['dinner', day.dinner]].forEach(([slot, id]) => {
        const recipe = id && getRecipe(id);
        if (!recipe) return;
        if (!usage[id]) usage[id] = { labels: [], slots: [] };
        if (!usage[id].labels.includes(day.label)) usage[id].labels.push(day.label);
        usage[id].slots.push({ dayIdx: di, slot });
      });
    });

    const batchHtml = Object.keys(usage).map(id => {
      const recipe = getRecipe(id);
      const info = usage[id];
      if (!recipe) return '';
      const slotCount = info.slots.length;
      return `
        <div class="batch-card pass5-batch-card">
          <div class="pass5-batch-copy">
            <div class="bc-name">${escapeHtml(recipe.name)} <span class="badge kcal badge-inline">${escapeHtml(String(recipe.kcalNum))} kcal / ${escapeHtml(recipe.kcalUnit)}</span></div>
            <div class="bc-days">${info.labels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>
            <div class="batch-usage-note">Used in ${slotCount} ${slotCount === 1 ? 'meal slot' : 'meal slots'} this week</div>
          </div>
          <button class="batch-remove-btn" data-id="${escapeHtml(id)}" data-week="${weekIdx}">Remove from week</button>
        </div>`;
    }).join('');

    const prepBanner = document.getElementById('prepBanner');
    prepBanner.innerHTML = batchHtml || `
      <div class="pass5-plan-empty">
        <strong>No batch cooking needed yet.</strong>
        <span>Add a Lunch or Dinner below and it will appear here automatically.</span>
      </div>`;

    const dayBlocks = document.getElementById('dayBlocks');
    dayBlocks.innerHTML = `
      <div class="section-head-row meal-plan-active-week-row">
        <h2 class="view-title week-block-title">${escapeHtml(week.title)}</h2>
        <button
          type="button"
          class="btn btn-sm ${isActiveWeek ? 'btn-done' : 'btn-ghost'} active-week-btn"
          ${isActiveWeek ? 'disabled aria-current="true"' : ''}
        >${isActiveWeek ? 'Active Week' : 'Set as Active Week'}</button>
      </div>
      ${week.days.map((day, di) => {
        const totals = dayTotals(day);
        return `
          <div class="day-block pass5-day-block">
            <h4>${escapeHtml(day.label)}</h4>
            <div class="meal-row pass5-meal-row breakfast-row">
              <span class="pass5-meal-copy"><span class="meal-tag">Breakfast</span><span class="meal-name">Fixed 600-kcal base</span></span>
              <span class="meal-kcal">600 kcal</span>
            </div>
            ${mealRowHtml('lunch', totals.lunch, weekIdx, di)}
            ${mealRowHtml('dinner', totals.dinner, weekIdx, di)}
            <div class="total-line pass5-total-line">
              <p class="meal-line meal-total-line">Day total: <b>${escapeHtml(String(totals.total))} kcal</b></p>
              <span class="snack-target">Snack target: ~${escapeHtml(String(totals.snack))} kcal</span>
            </div>
          </div>`;
      }).join('')}`;

    const activeWeekBtn = dayBlocks.querySelector('.active-week-btn:not(:disabled)');
    if (activeWeekBtn) {
      activeWeekBtn.addEventListener('click', () => activateMealPlanWeek(weekIdx));
    }

    prepBanner.querySelectorAll('.batch-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeRecipeFromWeek(parseInt(btn.dataset.week, 10), btn.dataset.id));
    });

    dayBlocks.querySelectorAll('.meal-swap-btn, .meal-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openSwapPicker(parseInt(btn.dataset.week, 10), parseInt(btn.dataset.day, 10), btn.dataset.slot);
      });
    });

    dayBlocks.querySelectorAll('.meal-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        removeMealSlot(parseInt(btn.dataset.week, 10), parseInt(btn.dataset.day, 10), btn.dataset.slot);
      });
    });
  };

  /* -----------------------------------------------------------------------
     GROCERY PROGRESS POLISH
     ----------------------------------------------------------------------- */

  function groceryStats(weekIdx) {
    let total = 0;
    let checked = 0;
    weekRecipeIds(weekIdx).forEach(id => {
      const recipe = getRecipe(id);
      if (!recipe) return;
      recipe.ingredients.forEach((_, i) => {
        total++;
        if (appState.grocery[`w${weekIdx}-${id}-${i}`]) checked++;
      });
    });
    return { total, checked, remaining: Math.max(0, total - checked) };
  }

  function enhanceGroceryProgress() {
    const progress = document.getElementById('grocProgress');
    const toolbar = progress && progress.closest('.grocery-toolbar');
    const grid = document.getElementById('groceryGrid');
    if (!progress || !toolbar || !grid) return;

    let wrap = toolbar.querySelector('.grocery-progress-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'grocery-progress-wrap';
      toolbar.insertBefore(wrap, toolbar.firstChild);
      wrap.appendChild(progress);

      const meter = document.createElement('div');
      meter.className = 'grocery-progress-meter';
      meter.setAttribute('role', 'progressbar');
      meter.setAttribute('aria-label', 'Grocery checklist progress');
      meter.innerHTML = '<span class="grocery-progress-fill"></span>';
      wrap.appendChild(meter);
    }

    const stats = groceryStats(appState.grocWeek);
    const meter = wrap.querySelector('.grocery-progress-meter');
    const fill = wrap.querySelector('.grocery-progress-fill');
    const pct = stats.total ? Math.round((stats.checked / stats.total) * 100) : 0;

    if (!stats.total) {
      progress.textContent = 'No grocery items for this week';
    } else if (!stats.remaining) {
      progress.textContent = `All ${stats.total} items checked`;
    } else {
      progress.textContent = `${stats.checked} / ${stats.total} checked · ${stats.remaining} left`;
    }

    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', String(stats.total || 0));
    meter.setAttribute('aria-valuenow', String(stats.checked));
    fill.style.width = `${pct}%`;

    toolbar.classList.toggle('grocery-complete', stats.total > 0 && stats.remaining === 0);
    grid.classList.toggle('grocery-empty', stats.total === 0);
  }

  const pass5BaseRenderGrocery = renderGrocery;
  renderGrocery = function renderPass5Grocery() {
    const cleaned = cleanupUnusedGroceryChecks(appState.grocWeek);
    if (cleaned) saveState();
    pass5BaseRenderGrocery();
    enhanceGroceryProgress();
  };

  // Make the existing batch section heading available for scoped styling.
  const batchHeading = document.querySelector('#view-plan > h5');
  if (batchHeading) batchHeading.classList.add('pass5-batch-heading');
})();
