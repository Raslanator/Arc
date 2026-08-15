/**
 * ui.js
 * Self-contained UI behaviours that are independent of app state:
 *   - Hover spotlight (light-follow) effect
 *   - Number stepper (hold-to-repeat)
 *   - Custom time picker (glass dropdown replacing <input type="time">)
 */

/* ==========================================================================
   HOVER SPOTLIGHT (light-follow)
   Tracks pointer position and sets --mx / --my CSS custom properties on
   the nearest spotlight-eligible ancestor so the radial-gradient pseudo-
   element in base.css follows the cursor inside each card/button.
   ========================================================================== */

(function initSpotlight() {
  const SPOTLIGHT_SEL =
    '.arc-card, .timeline-list, .card, .day-block, .prayer-card, .prep-banner, ' +
    '.cal-card, .goal-card, .protocol-card, .batch-card, .picker-card, .counter-card, ' +
    '.grocery-item, .modal, ' +
    '.btn, .counter-btn, .qa-btn, .week-select button, .arc-zoom-controls button, ' +
    '.custom-add-form button, .target-pill, .stepper-btn, .time-trigger';

  let rafId = null;
  let lastEvt = null;
  let activeEl = null;

  function positionOn(el, e) {
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left)  / r.width  * 100).toFixed(2);
    const y = ((e.clientY - r.top)   / r.height * 100).toFixed(2);
    el.style.setProperty('--mx', x + '%');
    el.style.setProperty('--my', y + '%');
  }

  function apply() {
    rafId = null;
    const e = lastEvt;
    if (!e) return;

    // closest() finds the nearest spotlight ancestor of whatever element
    // the cursor is directly over, so moving across children inside the
    // same container never trips a false exit.
    const el = e.target.closest ? e.target.closest(SPOTLIGHT_SEL) : null;

    if (activeEl && activeEl !== el) {
      // Deliberately do NOT reset --mx/--my here. The glow's opacity is
      // driven purely by CSS :hover, so it fades out from wherever the
      // cursor last was — never snapping back to the default center.
      activeEl = null;
    }
    if (el) {
      activeEl = el;
      positionOn(el, e);
    }
  }

  document.addEventListener('pointermove', e => {
    lastEvt = e;
    if (rafId === null) rafId = requestAnimationFrame(apply);
  }, { passive: true });

  // Only clear the reference when the pointer leaves the document entirely.
  document.addEventListener('pointerleave', () => { activeEl = null; });
})();

/* ==========================================================================
   NUMBER STEPPER
   Handles +/− buttons that wrap a numeric <input>.
   Supports hold-to-repeat with accelerating repeat rate.
   ========================================================================== */

(function initStepper() {
  let holdTimer = null;

  function bump(input, dir) {
    const step = parseFloat(input.step) || 1;
    const min  = input.min !== '' ? parseFloat(input.min) : -Infinity;
    const max  = input.max !== '' ? parseFloat(input.max) :  Infinity;
    let v = (parseFloat(input.value) || 0) + dir * step;
    v = Math.max(min, Math.min(max, v));
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.stepper-btn');
    if (!btn) return;
    e.preventDefault();

    const input = document.getElementById(btn.dataset.target);
    if (!input) return;

    const dir = btn.classList.contains('inc') ? 1 : -1;
    bump(input, dir);

    let delay = 420;
    const schedule = () => {
      holdTimer = setTimeout(() => {
        bump(input, dir);
        delay = Math.max(45, delay * 0.72);
        schedule();
      }, delay);
    };
    schedule();

    const stop = () => {
      clearTimeout(holdTimer);
      window.removeEventListener('pointerup',     stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup',     stop);
    window.addEventListener('pointercancel', stop);
  });
})();

/* ==========================================================================
   CUSTOM TIME PICKER
   Replaces <input type="time"> with a glass floating hour/minute/AM-PM
   dropdown. Panels are portalled to <body> so no ancestor stacking context
   can ever paint over them.
   ========================================================================== */

/** Close all open time panels and deactivate their triggers. */
function closeAllTimePanels() {
  document.querySelectorAll('.time-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.time-trigger.active').forEach(t => t.classList.remove('active'));
}

// Close panels when clicking outside a time-field or its portalled panel.
document.addEventListener('click', e => {
  if (!e.target.closest('.time-field') && !e.target.closest('.time-panel')) {
    closeAllTimePanels();
  }
});

// Keep open portalled panels glued to their trigger on scroll/resize.
window.addEventListener('scroll', () => {
  document.querySelectorAll('.time-panel.open.tp-portal').forEach(p => {
    if (p._reposition) p._reposition();
  });
}, { passive: true, capture: true });

window.addEventListener('resize', () => {
  document.querySelectorAll('.time-panel.open.tp-portal').forEach(p => {
    if (p._reposition) p._reposition();
  });
});

/** Read the current h12/m/ap parts from a time input's value. */
function timePickerParts(input) {
  let h24 = 5, m = 0;
  if (input.value) {
    const p = input.value.split(':').map(Number);
    h24 = p[0]; m = p[1];
  }
  const ap  = h24 >= 12 ? 'PM' : 'AM';
  let h12   = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { h12, m, ap };
}

/** Update the visible trigger label from the underlying input value. */
function updateTimeTriggerLabel(input) {
  const field = input.closest('.time-field');
  if (!field) return;
  const label = field.querySelector('.time-trigger-label');
  if (label) label.textContent = input.value ? minToLabel12(hhmmToMin(input.value)) : 'Select time';
}

/**
 * Mount a custom time picker on a native <input type="time">.
 * Idempotent — safe to call again to refresh the trigger label.
 *
 * The native input is hidden; a glass trigger button + portalled dropdown
 * panel replace it visually. The underlying input value is kept in sync
 * so form validation and change events still work normally.
 *
 * @param {HTMLInputElement} input
 */
function mountTimePicker(input) {
  if (!input) return;

  // Already mounted — just refresh the label.
  if (input.dataset.tpMounted) {
    updateTimeTriggerLabel(input);
    return;
  }
  input.dataset.tpMounted = '1';
  input.style.display = 'none';

  // Wrap the hidden input in a .time-field container.
  const field = document.createElement('div');
  field.className = 'time-field';
  input.parentNode.insertBefore(field, input);
  field.appendChild(input);

  // Build the visible trigger button.
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'time-trigger';
  trigger.innerHTML =
    '<svg class="time-trigger-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
    '<span class="time-trigger-label">Select time</span>' +
    '<svg class="time-trigger-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  field.appendChild(trigger);

  // Build the portalled dropdown panel.
  const panel = document.createElement('div');
  panel.className = 'time-panel tp-portal';
  panel.innerHTML =
    '<div class="time-panel-cols">' +
      '<div class="time-col" data-col="h"></div>' +
      '<div class="time-col" data-col="m"></div>' +
      '<div class="time-col ampm" data-col="ap"></div>' +
    '</div>' +
    '<div class="time-panel-footer"><button type="button" class="btn btn-primary btn-sm time-panel-done">Done</button></div>';
  document.body.appendChild(panel);
  trigger._panel = panel; // referenced by destroyPortalledTimePanels() for modal cleanup

  // Position the panel below (or above) the trigger.
  function positionPanel() {
    const r       = trigger.getBoundingClientRect();
    const panelH  = panel.offsetHeight || 260;
    const panelW  = Math.max(panel.offsetWidth || 236, 236);
    const spaceBelow = window.innerHeight - r.bottom;
    const openUpward = spaceBelow < panelH + 12 && r.top > panelH + 12;
    const top  = openUpward ? (r.top - panelH - 9) : (r.bottom + 9);
    let   left = r.left;
    const maxLeft = window.innerWidth - panelW - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    panel.style.top  = Math.max(8, top) + 'px';
    panel.style.left = left + 'px';
    panel.style.transformOrigin = openUpward ? 'bottom left' : 'top left';
  }
  panel._reposition = positionPanel;

  // Populate hour column (1–12).
  const hCol = panel.querySelector('[data-col="h"]');
  for (let h = 1; h <= 12; h++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'time-opt'; b.textContent = h; b.dataset.val = h;
    hCol.appendChild(b);
  }

  // Populate minute column (0, 5, 10 … 55).
  const mCol = panel.querySelector('[data-col="m"]');
  for (let m = 0; m < 60; m += 5) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'time-opt'; b.textContent = pad2(m); b.dataset.val = m;
    mCol.appendChild(b);
  }

  // Populate AM/PM column.
  const apCol = panel.querySelector('[data-col="ap"]');
  ['AM', 'PM'].forEach(ap => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'time-opt'; b.textContent = ap; b.dataset.val = ap;
    apCol.appendChild(b);
  });

  /** Highlight the column options that match the current input value. */
  function setActive() {
    const { h12, m, ap } = timePickerParts(input);
    const roundedM = Math.round(m / 5) * 5 % 60;
    hCol.querySelectorAll('.time-opt').forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === h12));
    mCol.querySelectorAll('.time-opt').forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) === roundedM));
    apCol.querySelectorAll('.time-opt').forEach(b => b.classList.toggle('active', b.dataset.val === ap));
  }

  function scrollActiveIntoView() {
    [hCol, mCol].forEach(col => {
      const active = col.querySelector('.time-opt.active');
      if (active) active.scrollIntoView({ block: 'center' });
    });
  }

  /**
   * Read the currently highlighted options and commit the resulting time
   * to the underlying input, falling back to the input's existing value
   * for any column that has no active option yet.
   */
  function commitFromPanel() {
    const def  = timePickerParts(input);
    const hBtn = hCol.querySelector('.time-opt.active');
    const mBtn = mCol.querySelector('.time-opt.active');
    const apBtn = apCol.querySelector('.time-opt.active');
    const h12  = hBtn  ? parseInt(hBtn.dataset.val,  10) : def.h12;
    const m    = mBtn  ? parseInt(mBtn.dataset.val,  10) : def.m;
    const ap   = apBtn ? apBtn.dataset.val               : def.ap;
    let h24    = h12 % 12;
    if (ap === 'PM') h24 += 12;
    input.value = pad2(h24) + ':' + pad2(m);
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    updateTimeTriggerLabel(input);
  }

  // Toggle the panel open/closed when the trigger is clicked.
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = panel.classList.contains('open');
    closeAllTimePanels();
    if (!wasOpen) {
      setActive();
      positionPanel();
      panel.classList.add('open');
      trigger.classList.add('active');
      scrollActiveIntoView();
    }
  });

  // Handle option clicks and the Done button inside the panel.
  panel.addEventListener('click', e => {
    if (e.target.closest('.time-panel-done')) {
      commitFromPanel();
      closeAllTimePanels();
      return;
    }
    const opt = e.target.closest('.time-opt');
    if (!opt) return;
    opt.closest('.time-col').querySelectorAll('.time-opt').forEach(b => b.classList.remove('active'));
    opt.classList.add('active');
    commitFromPanel();
  });

  updateTimeTriggerLabel(input);
}

/**
 * Remove all portalled time-picker panels that belong to time-fields
 * inside `root`. Call this before tearing down modal HTML to avoid
 * orphaned panels in the DOM.
 *
 * @param {Element} root
 */
function destroyPortalledTimePanels(root) {
  root.querySelectorAll('.time-field').forEach(field => {
    const input = field.querySelector('input[type="time"]');
    if (input && input.dataset.tpMounted) {
      const trigger = field.querySelector('.time-trigger');
      if (trigger && trigger._panel) trigger._panel.remove();
    }
  });
}
