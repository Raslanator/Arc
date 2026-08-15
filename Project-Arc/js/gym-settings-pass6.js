/**
 * gym-settings-pass6.js
 * Pass 6 — Gym + Settings refinement.
 *
 * Keeps the existing gym/settings data model and persistence intact while
 * tightening hierarchy, editing, recovery tracking, and settings copy.
 */

(function initGymSettingsPass6() {
  /* -----------------------------------------------------------------------
     STATIC VIEW PREP
     ----------------------------------------------------------------------- */

  function prepareGymDom() {
    const view = document.getElementById('view-gym');
    if (!view) return;

    const desc = view.querySelector(':scope > .view-desc');
    if (desc) {
      desc.textContent = 'Choose a training day, review the session, then track cardio, swim, sauna, and steam across the week.';
    }

    const recoveryBlock = document.getElementById('trackerWeekLabel')?.closest('.day-block');
    if (recoveryBlock) {
      recoveryBlock.classList.add('pass6-recovery-block');
      recoveryBlock.removeAttribute('style');
      const toolbar = recoveryBlock.querySelector('.grocery-toolbar');
      if (toolbar) {
        toolbar.classList.add('pass6-recovery-toolbar');
        toolbar.removeAttribute('style');
      }
      const heading = recoveryBlock.querySelector('h4');
      if (heading) heading.removeAttribute('style');
    }
  }

  function prepareSettingsDom() {
    const view = document.getElementById('view-goals');
    if (!view) return;

    const desc = view.querySelector(':scope > .view-desc');
    if (desc) {
      desc.textContent = 'Set your calorie target and day boundaries. Untouched schedule checkpoints adapt with wake and sleep; events with manually edited times stay fixed.';
    }

    const form = document.getElementById('goalsForm');
    if (form) {
      form.classList.add('pass6-settings-form');
      const actions = form.querySelector(':scope > .form-actions');
      if (actions) {
        actions.classList.add('pass6-settings-actions');
        actions.removeAttribute('style');
      }

      const targetHint = form.querySelector('#goalDailyTarget')?.closest('.field')?.querySelector('.hint');
      const wakeHint = form.querySelector('#goalWake')?.closest('.field')?.querySelector('.hint');
      const sleepHint = form.querySelector('#goalSleep')?.closest('.field')?.querySelector('.hint');
      if (targetHint) targetHint.textContent = 'Updates Meal Plan snack targets and calorie tracking targets.';
      if (wakeHint) wakeHint.textContent = 'Moves schedule checkpoints that still use their default scaled timing. Manually timed events stay fixed.';
      if (sleepHint) sleepHint.textContent = 'Rescales default-timed checkpoints across the day. Manually timed events stay fixed.';

      const saved = document.getElementById('goalsSavedBanner');
      if (saved) saved.textContent = 'Saved — calorie targets and day boundaries are updated.';
    }

    const themeToggle = document.getElementById('themeToggle');
    const appearance = themeToggle?.closest('.day-block');
    if (appearance) {
      appearance.classList.add('pass6-settings-section', 'pass6-appearance-section');
      appearance.removeAttribute('style');
      const copy = appearance.querySelector('.meal-line');
      if (copy) {
        copy.removeAttribute('style');
        copy.textContent = 'Choose light or dark mode. Your choice is saved on this device.';
      }
    }

    const resetBtn = document.getElementById('resetAppBtn');
    const danger = resetBtn?.closest('.day-block');
    if (danger) {
      danger.classList.add('pass6-settings-section', 'pass6-danger-section');
      danger.removeAttribute('style');
      const heading = danger.querySelector('h4');
      if (heading) heading.removeAttribute('style');
      const copy = danger.querySelector('.meal-line');
      if (copy) {
        copy.textContent = 'Wipes meal-plan changes, recipe edits, timeline edits and completion status, gym edits, calorie history, grocery checks, and settings. This cannot be undone.';
      }
      const actions = danger.querySelector('.form-actions');
      if (actions) {
        actions.classList.add('pass6-danger-actions');
        actions.removeAttribute('style');
      }
      resetBtn.classList.add('pass6-danger-button');
      resetBtn.removeAttribute('style');
    }
  }

  prepareGymDom();
  prepareSettingsDom();

  /* -----------------------------------------------------------------------
     GYM DAY SELECTOR
     ----------------------------------------------------------------------- */

  renderGymSelect = function renderPass6GymSelect() {
    const el = document.getElementById('gymDaySelect');
    const days = effectiveGymDays();
    if (!el) return;

    el.innerHTML = days.map((day, index) => `
      <button type="button" data-i="${index}" class="${index === appState.gymDay ? 'active' : ''}" aria-pressed="${index === appState.gymDay ? 'true' : 'false'}">
        <span class="pass6-day-kicker">${escapeHtml(day.label)}</span>
        <b>${escapeHtml(day.name)}</b>
        <span class="pass6-day-focus">${escapeHtml(day.sub)}</span>
      </button>
    `).join('');

    el.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        appState.gymDay = parseInt(button.dataset.i, 10);
        saveState();
        render();
      });
    });
  };

  /* -----------------------------------------------------------------------
     GYM DAY DETAIL
     ----------------------------------------------------------------------- */

  renderGymDetail = function renderPass6GymDetail() {
    const day = effectiveGymDays()[appState.gymDay];
    const detail = document.getElementById('gymDayDetail');
    if (!detail || !day) return;

    const exerciseHtml = day.exercises.length
      ? day.exercises.map(([name, sets], index) => `
          <div class="exercise-row pass6-exercise-row">
            <span class="pass6-exercise-index">${index + 1}</span>
            <span class="pass6-exercise-name">${escapeHtml(name)}</span>
            <span class="sets">${escapeHtml(sets)}</span>
          </div>
        `).join('')
      : '<div class="pass6-rest-state"><strong>No lifting today.</strong><span>Use the recovery/cardio plan below for this day.</span></div>';

    detail.classList.add('pass6-gym-detail');
    detail.innerHTML = `
      <div class="pass6-gym-detail-head">
        <div class="pass6-gym-heading-copy">
          <span class="pass6-gym-overline">${escapeHtml(day.label)}</span>
          <h4>${escapeHtml(day.name)}</h4>
          <p>${escapeHtml(day.sub)}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm pass6-edit-day-btn" id="editGymDayBtn">Edit Day</button>
      </div>
      <div class="pass6-exercise-list">${exerciseHtml}</div>
      <div class="pass6-cardio-plan">
        <span>Cardio / Swim</span>
        <strong>${escapeHtml(day.cardio)}</strong>
      </div>
    `;

    document.getElementById('editGymDayBtn').addEventListener('click', () => openGymEdit(appState.gymDay));
  };

  /* -----------------------------------------------------------------------
     RECOVERY PROTOCOLS
     ----------------------------------------------------------------------- */

  renderProtocols = function renderPass6Protocols() {
    const grid = document.getElementById('protocolGrid');
    if (!grid) return;

    grid.innerHTML = PROTOCOLS.map(protocol => `
      <div class="protocol-card pass6-protocol-card ${protocol.warn ? 'pass6-protocol-warning' : ''}">
        <h5>${escapeHtml(protocol.title)}</h5>
        <p>${escapeHtml(protocol.body)}</p>
      </div>
    `).join('');
  };

  /* -----------------------------------------------------------------------
     WEEKLY RECOVERY TRACKER
     ----------------------------------------------------------------------- */

  renderTracker = function renderPass6Tracker() {
    const week = getTrackerWeek();
    const days = effectiveGymDays();
    const weekLabel = document.getElementById('trackerWeekLabel');
    const list = document.getElementById('cardioSwimList');
    if (!weekLabel || !list) return;

    weekLabel.textContent = `${fmtShort(currentTrackerWeekKey())} – ${fmtShort(getWeekDateKeys()[6])}`;

    let cardioDone = 0;
    let swimDone = 0;
    days.forEach((_, index) => {
      const state = week.days[index] || { cardio: false, swim: false };
      if (state.cardio) cardioDone++;
      if (state.swim) swimDone++;
    });

    list.innerHTML = `
      <div class="pass6-tracker-summary" aria-label="Weekly recovery summary">
        <span><b>${cardioDone}</b><small>Cardio</small></span>
        <span><b>${swimDone}</b><small>Swim</small></span>
        <span><b>${week.sauna || 0}</b><small>Sauna</small></span>
        <span><b>${week.steam || 0}</b><small>Steam</small></span>
      </div>
      ${days.map((day, index) => {
        const state = week.days[index] || { cardio: false, swim: false };
        return `
          <div class="tracker-row pass6-tracker-row">
            <div class="tr-day">
              <b>${escapeHtml(day.label)} — ${escapeHtml(day.name)}</b>
              <span>${escapeHtml(day.cardio)}</span>
            </div>
            <div class="pass6-tracker-actions">
              <label class="tr-check"><input type="checkbox" data-day="${index}" data-kind="cardio" ${state.cardio ? 'checked' : ''}/><span>Cardio</span></label>
              <label class="tr-check"><input type="checkbox" data-day="${index}" data-kind="swim" ${state.swim ? 'checked' : ''}/><span>Swim</span></label>
            </div>
          </div>`;
      }).join('')}
    `;

    list.querySelectorAll('input[type="checkbox"]').forEach(box => {
      box.addEventListener('change', () => {
        const trackerWeek = getTrackerWeek();
        const dayIdx = box.dataset.day;
        const kind = box.dataset.kind;
        if (!trackerWeek.days[dayIdx]) trackerWeek.days[dayIdx] = { cardio: false, swim: false };
        trackerWeek.days[dayIdx][kind] = box.checked;
        saveState();
        render();
      });
    });

    document.getElementById('saunaCount').textContent = week.sauna || 0;
    document.getElementById('steamCount').textContent = week.steam || 0;
  };

  /* -----------------------------------------------------------------------
     GYM DAY EDITOR
     ----------------------------------------------------------------------- */

  openGymEdit = function openPass6GymEdit(dayIdx) {
    const day = effectiveGymDays()[dayIdx];
    if (!day) return;

    const rowsHtml = day.exercises.map(([name, sets], index) => `
      <div class="ex-edit-row pass6-ex-edit-row" data-i="${index}">
        <span class="pass6-ex-edit-index">${index + 1}</span>
        <input type="text" class="exName" value="${escapeHtml(name)}" placeholder="Exercise" aria-label="Exercise name"/>
        <input type="text" class="exSets" value="${escapeHtml(sets)}" placeholder="Sets" aria-label="Sets and reps"/>
        <button type="button" class="ex-remove" aria-label="Remove exercise">&times;</button>
      </div>
    `).join('');

    const hasOverride = Object.prototype.hasOwnProperty.call(appState.gymOverrides || {}, dayIdx);

    openModal(`
      <button class="modal-close" id="modalClose">&times;</button>
      <span class="pass6-modal-overline">${escapeHtml(day.label)}</span>
      <h3>Edit ${escapeHtml(day.name)}</h3>
      <p class="view-desc modal-desc pass6-gym-modal-desc">Changes are saved for this training day and shown everywhere the workout is used.</p>
      <form id="gymEditForm" class="pass6-gym-edit-form">
        <div class="form-grid single">
          <div class="field"><label>Focus</label><input type="text" id="geSub" value="${escapeHtml(day.sub)}"/></div>
          <div class="field"><label>Cardio / swim plan</label><input type="text" id="geCardio" value="${escapeHtml(day.cardio)}"/></div>
          <div class="field pass6-exercises-field">
            <div class="pass6-field-head"><label>Exercises</label><span>Name + sets / reps</span></div>
            <div id="exRows">${rowsHtml}</div>
            <button type="button" class="btn btn-ghost btn-sm btn-self-start" id="addExRow">+ Add Exercise</button>
          </div>
        </div>
        <div class="form-actions pass6-gym-edit-actions ${hasOverride ? 'pass6-gym-edit-actions-between' : ''}">
          ${hasOverride ? '<button type="button" class="btn btn-ghost pass6-reset-day-btn" id="geResetDay">Reset Day</button>' : '<span></span>'}
          <span class="btn-group">
            <button type="button" class="btn btn-ghost" id="geCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Day</button>
          </span>
        </div>
      </form>
    `);

    const rows = document.getElementById('exRows');

    function refreshRowNumbers() {
      rows.querySelectorAll('.pass6-ex-edit-row').forEach((row, index) => {
        row.dataset.i = index;
        const number = row.querySelector('.pass6-ex-edit-index');
        if (number) number.textContent = String(index + 1);
      });
    }

    function wireRemove(button) {
      button.addEventListener('click', () => {
        button.closest('.ex-edit-row')?.remove();
        refreshRowNumbers();
      });
    }

    rows.querySelectorAll('.ex-remove').forEach(wireRemove);

    document.getElementById('addExRow').addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'ex-edit-row pass6-ex-edit-row';
      row.innerHTML = `
        <span class="pass6-ex-edit-index"></span>
        <input type="text" class="exName" placeholder="Exercise" aria-label="Exercise name"/>
        <input type="text" class="exSets" placeholder="Sets" aria-label="Sets and reps"/>
        <button type="button" class="ex-remove" aria-label="Remove exercise">&times;</button>`;
      rows.appendChild(row);
      wireRemove(row.querySelector('.ex-remove'));
      refreshRowNumbers();
      row.querySelector('.exName').focus();
    });

    document.getElementById('geCancel').addEventListener('click', closeModal);

    const resetDay = document.getElementById('geResetDay');
    if (resetDay) {
      resetDay.addEventListener('click', () => {
        const ok = confirm(`Reset ${day.label} — ${day.name} to the original workout?`);
        if (!ok) return;
        delete appState.gymOverrides[dayIdx];
        saveState();
        closeModal();
        render();
      });
    }

    document.getElementById('gymEditForm').addEventListener('submit', event => {
      event.preventDefault();
      const sub = document.getElementById('geSub').value.trim();
      const cardio = document.getElementById('geCardio').value.trim();
      const exercises = [...rows.querySelectorAll('.ex-edit-row')]
        .map(row => [row.querySelector('.exName').value.trim(), row.querySelector('.exSets').value.trim()])
        .filter(([name]) => name);

      appState.gymOverrides[dayIdx] = { sub, cardio, exercises };
      saveState();
      closeModal();
      render();
    });
  };
})();
