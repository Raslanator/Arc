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
