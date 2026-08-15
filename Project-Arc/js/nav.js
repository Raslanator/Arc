/**
 * nav.js
 * Tab navigation: activating views, sliding the indicator pill,
 * and persisting the active tab to appState.
 */

/* ==========================================================================
   NAV INDICATOR
   ========================================================================== */

/** Slide the orange indicator pill to sit under the active tab button. */
function updateNavIndicator() {
  const btn       = document.querySelector('nav.tabs button.active');
  const indicator = document.getElementById('navIndicator');
  if (!btn || !indicator) return;
  indicator.style.left  = btn.offsetLeft + 'px';
  indicator.style.width = btn.offsetWidth + 'px';
}

/* ==========================================================================
   TAB ACTIVATION
   ========================================================================== */

/**
 * Activate a tab by view name, updating the nav button, section visibility,
 * the sliding indicator, and persisting the choice to appState.
 *
 * @param {string} view - One of: today | calories | plan | recipes | grocery | gym | goals
 */
function activateTab(view) {
  const btn     = document.querySelector(`nav.tabs button[data-view="${view}"]`);
  const section = document.getElementById('view-' + view);
  if (!btn || !section) return;

  // Deactivate all other sections and buttons.
  document.querySelectorAll('section.view.active').forEach(s => {
    if (s !== section) s.classList.remove('active');
  });
  document.querySelectorAll('nav.tabs button.active').forEach(b => {
    if (b !== btn) {
      b.classList.remove('active');
      b.style.removeProperty('--mx');
      b.style.removeProperty('--my');
    }
  });

  // Activate the target button and section.
  // Centre the spotlight glow on the newly active tab at the same moment
  // the indicator pill begins sliding toward it, so both animations start
  // together and arrive as one unified movement.
  btn.classList.add('active');
  btn.style.setProperty('--mx', '50%');
  btn.style.setProperty('--my', '50%');
  section.classList.add('active');

  appState.activeTab = view;
  saveState();
  updateNavIndicator();
}

/* ==========================================================================
   INIT
   ========================================================================== */

/** Attach click listeners to all nav tab buttons. */
function initNav() {
  document.querySelectorAll('nav.tabs button').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.view));
  });
  window.addEventListener('resize', updateNavIndicator);
}
