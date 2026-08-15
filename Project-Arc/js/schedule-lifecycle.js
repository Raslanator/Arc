/**
 * schedule-lifecycle.js
 * Keeps the editable schedule integrated with UI state that main.js owns.
 */

(function bridgeScheduleLifecycle() {
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

  const scheduleRenderTodaySummary = renderTodaySummary;
  renderTodaySummary = function renderTodaySummaryPreservingCarousel() {
    const el = document.getElementById('todaySummary');
    if (!el) return;

    const shell = el.querySelector('.daily-brief-shell');
    const stage = shell && shell.querySelector('.daily-brief-stage');
    if (!shell || !stage) {
      scheduleRenderTodaySummary();
      return;
    }

    const previousItems = Array.from(stage.querySelectorAll('.daily-brief-item'));
    let activeIndex = previousItems.findIndex(item => item.getAttribute('aria-hidden') === 'false');
    if (activeIndex < 0) activeIndex = 0;

    // Let the schedule-aware renderer produce fresh source items, then move
    // those items into the existing carousel shell so its arrow listeners and
    // motion/indicator structure remain alive.
    scheduleRenderTodaySummary();
    const freshItems = Array.from(el.querySelectorAll(':scope > .prep-item'));
    stage.replaceChildren(...freshItems);

    const nextItems = Array.from(stage.querySelectorAll('.prep-item'));
    if (activeIndex >= nextItems.length) activeIndex = 0;
    nextItems.forEach((item, index) => {
      item.classList.add('daily-brief-item');
      item.hidden = index !== activeIndex;
      item.setAttribute('aria-hidden', index === activeIndex ? 'false' : 'true');
    });

    const plan = getTodayPlan();
    const dayStrong = shell.querySelector('.daily-brief-day strong');
    if (dayStrong) dayStrong.textContent = `Today / ${plan.dayName}`;

    el.replaceChildren(shell);
  };
})();