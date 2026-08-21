/**
 * modals.js
 * Shared modal open/close helpers and all modal form implementations:
 *   - Recipe detail viewer
 *   - Recipe add/edit form
 *   - Recipe archive/delete with replacement picker
 *   - Meal swap picker
 *   - Timeline event done/time modal
 *   - Prayer done/time modal
 *   - Gym day edit form
 */

/* ==========================================================================
   SHARED MODAL HELPERS
   ========================================================================== */

/**
 * Open the shared modal with arbitrary HTML content.
 * Destroys any portalled time-picker panels from the previous content first
 * to avoid orphaned DOM nodes.
 *
 * @param {string} html - Inner HTML for the modal content element.
 */
function openModal(html) {
  destroyPortalledTimePanels(document.getElementById('modalContent'));
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalBackdrop').classList.add('active');
  const closeBtn = document.getElementById('modalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('active');
}

// Close modal when clicking the backdrop itself.
document.getElementById('modalBackdrop').addEventListener('click', e => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

/* ==========================================================================
   RECIPE DETAIL VIEWER
   ========================================================================== */

function openRecipe(r) {
  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>${escapeHtml(r.name)}</h3>
    <div class="badges">
      <span class="badge kcal">${escapeHtml(String(r.kcalNum))} kcal / ${escapeHtml(r.kcalUnit)}</span>
      <span class="badge">${escapeHtml(r.portions)}</span>
      <span class="badge">${escapeHtml(r.macros)}</span>
      <span class="badge">${escapeHtml(r.time)}</span>
      <span class="badge cost">${escapeHtml(r.cost)}</span>
      ${sanitizeUrl(r.youtubeLink) ? `<span class="badge watch-btn" id="modalWatchBtn">${icon('play')} Watch</span>` : ''}
    </div>
    <h5>Ingredients</h5>
    <ul>${r.ingredients.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    <h5>Method</h5>
    <ol>${r.steps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>
    <p class="storage-note">Storage: ${escapeHtml(r.storage)}</p>
  `);
  const watchBtn = document.getElementById('modalWatchBtn');
  if (watchBtn) {
    watchBtn.addEventListener('click', () => {
      const safeUrl = sanitizeUrl(r.youtubeLink);
      if (safeUrl) window.open(safeUrl, '_blank', 'noopener noreferrer');
    });
  }
}

/* ==========================================================================
   RECIPE ADD / EDIT FORM
   ========================================================================== */

function openRecipeForm(existing) {
  const isEdit = !!existing;
  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>${isEdit ? 'Edit Recipe' : 'Add a Recipe'}</h3>
    <p class="view-desc modal-desc">${isEdit
      ? 'Changes apply everywhere this recipe is used.'
      : "This recipe will show up in the library and can be swapped into any week's lunch or dinner."}</p>
    <form id="recipeForm">
      <div class="form-grid">
        <div class="field span2"><label>Recipe name</label><input type="text" id="nrName" required maxlength="80" value="${isEdit ? escapeHtml(existing.name) : ''}"/></div>
        <div class="field"><label>Kcal per unit</label>
          <div class="stepper-field">
            <button type="button" class="stepper-btn dec" data-target="nrKcal" aria-label="Decrease">&minus;</button>
            <input type="number" id="nrKcal" min="1" required value="${isEdit ? existing.kcalNum : ''}"/>
            <button type="button" class="stepper-btn inc" data-target="nrKcal" aria-label="Increase">&plus;</button>
          </div>
        </div>
        <div class="field"><label>Unit (e.g. portion, wrap)</label><input type="text" id="nrUnit" value="${isEdit ? escapeHtml(existing.kcalUnit) : 'portion'}" required/></div>
        <div class="field"><label>Portions</label><input type="text" id="nrPortions" placeholder="Makes 4 portions" value="${isEdit && existing.portions !== '\u2014' ? escapeHtml(existing.portions) : ''}"/></div>
        <div class="field"><label>Macros</label><input type="text" id="nrMacros" placeholder="45g P \u00b7 40g C \u00b7 15g F" value="${isEdit && existing.macros !== '\u2014' ? escapeHtml(existing.macros) : ''}"/></div>
        <div class="field"><label>Prep/cook time</label><input type="text" id="nrTime" placeholder="30 min" value="${isEdit && existing.time !== '\u2014' ? escapeHtml(existing.time) : ''}"/></div>
        <div class="field"><label>Cost estimate</label><input type="text" id="nrCost" placeholder="~400\u2013500 EGP total" value="${isEdit && existing.cost !== '\u2014' ? escapeHtml(existing.cost) : ''}"/></div>
        <div class="field span2"><label>Ingredients (one per line)</label><textarea id="nrIngredients" required>${isEdit ? escapeHtml(existing.ingredients.join('\n')) : ''}</textarea></div>
        <div class="field span2"><label>Method (one step per line)</label><textarea id="nrSteps" required>${isEdit ? escapeHtml(existing.steps.join('\n')) : ''}</textarea></div>
        <div class="field span2"><label>Storage note</label><input type="text" id="nrStorage" placeholder="3-4 days in the fridge." value="${isEdit && existing.storage !== '\u2014' ? escapeHtml(existing.storage) : ''}"/></div>
        <div class="field span2"><label>YouTube link</label><input type="url" id="nrYoutube" placeholder="https://youtube.com/watch?v=..." value="${isEdit && existing.youtubeLink ? escapeHtml(existing.youtubeLink) : ''}"/><span class="hint">Optional \u2014 shows a \u201cWatch\u201d button on the recipe.</span></div>
      </div>
      <div class="form-actions ${isEdit ? 'form-actions-between' : ''}">
        ${isEdit ? `<button type="button" class="btn btn-ghost btn-destructive" id="nrDelete">${icon('trash')} Delete Recipe</button>` : '<span></span>'}
        <span class="btn-group">
          <button type="button" class="btn btn-ghost" id="nrCancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Recipe'}</button>
        </span>
      </div>
    </form>
  `);

  document.getElementById('nrCancel').addEventListener('click', closeModal);

  const deleteBtn = document.getElementById('nrDelete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => handleDeleteRecipe(existing.id));

  document.getElementById('recipeForm').addEventListener('submit', e => {
    e.preventDefault();
    const name        = document.getElementById('nrName').value.trim();
    const kcalNum     = parseInt(document.getElementById('nrKcal').value);
    const kcalUnit    = document.getElementById('nrUnit').value.trim() || 'portion';
    const ingredients = document.getElementById('nrIngredients').value.split('\n').map(s => s.trim()).filter(Boolean);
    const steps       = document.getElementById('nrSteps').value.split('\n').map(s => s.trim()).filter(Boolean);
    const youtubeLink = document.getElementById('nrYoutube').value.trim();
    if (!name || !kcalNum || ingredients.length === 0 || steps.length === 0) return;

    const fields = {
      name, kcalNum, kcalUnit,
      portions:    document.getElementById('nrPortions').value.trim() || '\u2014',
      macros:      document.getElementById('nrMacros').value.trim()   || '\u2014',
      time:        document.getElementById('nrTime').value.trim()     || '\u2014',
      cost:        document.getElementById('nrCost').value.trim()     || '\u2014',
      ingredients, steps,
      storage:     document.getElementById('nrStorage').value.trim()  || '\u2014',
      youtubeLink: youtubeLink || undefined,
    };

    if (isEdit) {
      appState.recipeOverrides[existing.id] = fields;
    } else {
      appState.customRecipes.push({ id: createRecipeId(name), isCustom: true, ...fields });
    }
    saveState();
    closeModal();
    render();
  });
}

/* ==========================================================================
   RECIPE ARCHIVE / DELETE WITH REPLACEMENT PICKER
   ========================================================================== */

function handleArchiveRecipe(id) {
  const usages = findRecipeUsages(id);
  if (usages.length === 0) { archiveRecipe(id); return; }
  openReplacePopup(id, usages, 'archive');
}

function handleDeleteRecipe(id) {
  const recipe = getRecipe(id);
  const ok = confirm(`Delete "${recipe ? recipe.name : 'this recipe'}" permanently? This cannot be undone.`);
  if (!ok) return;
  const usages = findRecipeUsages(id);
  if (usages.length === 0) { deleteRecipeNow(id); closeModal(); return; }
  openReplacePopup(id, usages, 'delete');
}

function openReplacePopup(id, usages, mode) {
  const recipe     = getRecipe(id);
  const options    = activeRecipes().filter(r => r.id !== id);
  const usageHtml  = usages.map(u => `<li>${escapeHtml(u.weekTitle)} \u2014 ${escapeHtml(u.dayLabel)} (${escapeHtml(u.slot)})</li>`).join('');
  const actionWord = mode === 'delete' ? 'Delete' : 'Archive';
  const cardsHtml  = options.map(r => `
    <div class="picker-card" data-id="${escapeHtml(r.id)}">
      <h6>${escapeHtml(r.name)}</h6>
      <span class="badge kcal">${escapeHtml(String(r.kcalNum))} kcal / ${escapeHtml(r.kcalUnit)}</span>
    </div>
  `).join('');

  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>${escapeHtml(actionWord)} &#8220;${escapeHtml(recipe ? recipe.name : '')}&#8221;</h3>
    <p class="view-desc modal-desc">This recipe is still used in the meal plan:</p>
    <ul>${usageHtml}</ul>
    <h5>Choose a replacement</h5>
    <div class="picker-grid">${cardsHtml || '<p class="meal-line">No other active recipes available to swap in.</p>'}</div>
  `);

  document.getElementById('modalContent').querySelectorAll('.picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const replacementId = card.dataset.id;
      usages.forEach(u => {
        appState.weekOverrides[`w${u.wi}-${u.di}-${u.slot}`] = replacementId;
      });
      if (mode === 'delete') deleteRecipeNow(id); else archiveRecipe(id);
      closeModal();
    });
  });
}

/* ==========================================================================
   MEAL SWAP PICKER
   ========================================================================== */

function openSwapPicker(weekIdx, dayIdx, slot) {
  const cardsHtml = activeRecipes().map(r => `
    <div class="picker-card" data-id="${escapeHtml(r.id)}">
      <h6>${escapeHtml(r.name)}</h6>
      <span class="badge kcal">${escapeHtml(String(r.kcalNum))} kcal / ${escapeHtml(r.kcalUnit)}</span>
      ${r.isCustom ? '<span class="badge custom">Custom</span>' : ''}
    </div>
  `).join('');

  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>Swap ${slot === 'lunch' ? 'Lunch' : 'Dinner'}</h3>
    <p class="view-desc modal-desc">Pick a replacement \u2014 totals and the grocery list update right away.</p>
    <div class="picker-grid">${cardsHtml}</div>
  `);

  document.getElementById('modalContent').querySelectorAll('.picker-card').forEach(card => {
    card.addEventListener('click', () => {
      const week      = effectiveWeeks()[weekIdx];
      const dayLabel  = week.days[dayIdx].label;
      const oldRecipe = getRecipe(week.days[dayIdx][slot]);
      const newRecipe = getRecipe(card.dataset.id);
      const overrideKey = `w${weekIdx}-${dayIdx}-${slot}`;
      const prevValue   = Object.prototype.hasOwnProperty.call(appState.weekOverrides, overrideKey)
        ? appState.weekOverrides[overrideKey] : null;
      appState.weekOverrides[overrideKey] = card.dataset.id;
      logChange('plan',
        `${dayLabel} ${slot}: "${oldRecipe ? oldRecipe.name : '\u2014'}" \u2192 "${newRecipe ? newRecipe.name : '\u2014'}"`,
        { type: 'weekOverride', key: overrideKey, prevValue }
      );
      saveState();
      closeModal();
      render();
    });
  });
}

/* ==========================================================================
   TIMELINE EVENT DONE MODAL
   ========================================================================== */

function openDoneModal(idx) {
  const key      = todayKeyStr();
  const existing = (appState.timelineStatus[key] || {})[idx];

  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>${TIMELINE[idx].title}</h3>
    <p class="view-desc modal-desc">${existing
      ? 'Update when you did this \u2014 this can be changed anytime.'
      : 'When did you do this?'}</p>
    <div class="form-actions form-actions-start">
      <button class="btn btn-primary" id="doneOnTimeBtn">Done on time</button>
      <button class="btn btn-ghost"   id="doneOtherTimeBtn">Done at another time</button>
      ${existing ? '<button class="btn btn-ghost" id="clearDoneBtn">Mark not done</button>' : ''}
    </div>
    <div class="field span2 modal-time-field" id="customTimeField" style="display:${existing && existing.mode === 'custom' ? 'block' : 'none'}">
      <label>Time</label>
      <input type="time" id="doneTimeInput" value="${existing && existing.mode === 'custom' ? to24h(existing.time) : ''}"/>
      <div class="form-actions">
        <button class="btn btn-primary" id="confirmCustomTimeBtn">Confirm</button>
      </div>
    </div>
  `);

  document.getElementById('doneOnTimeBtn').addEventListener('click', () => {
    markTimelineDone(idx, 'on-time');
    closeModal();
  });
  document.getElementById('doneOtherTimeBtn').addEventListener('click', () => {
    document.getElementById('customTimeField').style.display = 'block';
  });
  document.getElementById('confirmCustomTimeBtn').addEventListener('click', () => {
    const val = document.getElementById('doneTimeInput').value;
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    markTimelineDone(idx, 'custom', minToLabel12(h * 60 + m));
    closeModal();
  });
  const clearBtn = document.getElementById('clearDoneBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { clearTimelineDone(idx); closeModal(); });

  mountTimePicker(document.getElementById('doneTimeInput'));
}

/* ==========================================================================
   PRAYER DONE MODAL
   ========================================================================== */

function openPrayerDoneModal(name) {
  const existing = getPrayerStatus(name);

  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>${name} <span class="prayer-tag">Salah</span></h3>
    <p class="view-desc modal-desc">${existing
      ? 'Update when you prayed \u2014 this can be changed anytime.'
      : 'When did you pray?'}</p>
    <div class="form-actions form-actions-start">
      <button class="btn btn-primary" id="prayerDoneOnTimeBtn">Done on time</button>
      <button class="btn btn-ghost"   id="prayerDoneOtherTimeBtn">Done at another time</button>
      ${existing ? '<button class="btn btn-ghost" id="prayerClearDoneBtn">Mark not done</button>' : ''}
    </div>
    <div class="field span2 modal-time-field" id="prayerCustomTimeField" style="display:${existing && existing.mode === 'custom' ? 'block' : 'none'}">
      <label>Time</label>
      <input type="time" id="prayerDoneTimeInput" value="${existing && existing.mode === 'custom' ? to24h(existing.time) : ''}"/>
      <div class="form-actions">
        <button class="btn btn-primary" id="prayerConfirmCustomTimeBtn">Confirm</button>
      </div>
    </div>
  `);

  document.getElementById('prayerDoneOnTimeBtn').addEventListener('click', () => {
    markPrayerDone(name, 'on-time');
    closeModal();
  });
  document.getElementById('prayerDoneOtherTimeBtn').addEventListener('click', () => {
    document.getElementById('prayerCustomTimeField').style.display = 'block';
  });
  document.getElementById('prayerConfirmCustomTimeBtn').addEventListener('click', () => {
    const val = document.getElementById('prayerDoneTimeInput').value;
    if (!val) return;
    const [h, m] = val.split(':').map(Number);
    markPrayerDone(name, 'custom', minToLabel12(h * 60 + m));
    closeModal();
  });
  const clearBtn = document.getElementById('prayerClearDoneBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { clearPrayerDone(name); closeModal(); });

  mountTimePicker(document.getElementById('prayerDoneTimeInput'));
}

/* ==========================================================================
   GYM DAY EDIT FORM
   ========================================================================== */

function openGymEdit(dayIdx) {
  const d = effectiveGymDays()[dayIdx];
  const rowsHtml = d.exercises.map(([name, sets], i) => `
    <div class="ex-edit-row" data-i="${i}">
      <input type="text" class="exName" value="${escapeHtml(name)}" placeholder="Exercise"/>
      <input type="text" class="exSets" value="${escapeHtml(sets)}" placeholder="Sets"/>
      <button type="button" class="ex-remove" data-i="${i}">&times;</button>
    </div>
  `).join('');

  openModal(`
    <button class="modal-close" id="modalClose">&times;</button>
    <h3>Edit ${escapeHtml(d.label)} \u2014 ${escapeHtml(d.name)}</h3>
    <form id="gymEditForm">
      <div class="form-grid single">
        <div class="field"><label>Focus (sub-label)</label><input type="text" id="geSub" value="${escapeHtml(d.sub)}"/></div>
        <div class="field"><label>Cardio / swim note</label><input type="text" id="geCardio" value="${escapeHtml(d.cardio)}"/></div>
        <div class="field">
          <label>Exercises (name + sets)</label>
          <div id="exRows">${rowsHtml}</div>
          <button type="button" class="btn btn-ghost btn-sm btn-self-start" id="addExRow">+ Add exercise</button>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="geCancel">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Day</button>
      </div>
    </form>
  `);

  document.getElementById('geCancel').addEventListener('click', closeModal);

  document.getElementById('addExRow').addEventListener('click', () => {
    const wrap = document.getElementById('exRows');
    const i    = wrap.children.length;
    const row  = document.createElement('div');
    row.className  = 'ex-edit-row';
    row.dataset.i  = i;
    row.innerHTML  = `<input type="text" class="exName" placeholder="Exercise"/><input type="text" class="exSets" placeholder="Sets"/><button type="button" class="ex-remove">&times;</button>`;
    wrap.appendChild(row);
    row.querySelector('.ex-remove').addEventListener('click', () => row.remove());
  });

  document.getElementById('exRows').querySelectorAll('.ex-remove').forEach(btn => {
    btn.addEventListener('click', e => e.target.closest('.ex-edit-row').remove());
  });

  document.getElementById('gymEditForm').addEventListener('submit', e => {
    e.preventDefault();
    const sub      = document.getElementById('geSub').value.trim();
    const cardio   = document.getElementById('geCardio').value.trim();
    const exercises = [...document.getElementById('exRows').querySelectorAll('.ex-edit-row')]
      .map(row => [row.querySelector('.exName').value.trim(), row.querySelector('.exSets').value.trim()])
      .filter(([n]) => n);
    appState.gymOverrides[dayIdx] = { sub, cardio, exercises };
    saveState();
    closeModal();
    render();
  });
}
