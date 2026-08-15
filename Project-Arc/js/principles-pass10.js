/**
 * principles-pass10.js
 * ARC.04 / Pass 10 — implement the agreed design principles as a thin layer
 * over the frozen application behavior.
 *
 * This module does not change persistence, data models, prayer fetching,
 * timeline mechanics, meal swapping, calorie logging, or gym editing.
 */

(function bootstrapPass10Principles() {
  function initPass10Principles() {
    if (window.ArcPass10) return;

    const EMPTY_ICON = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5h16v13H4z"></path>
        <path d="M8 9.5h8"></path>
        <path d="M8 13.5h5"></path>
      </svg>`;

    function ensureStylesheet() {
      if (document.querySelector('link[data-pass10-principles]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/principles-pass10.css';
      link.dataset.pass10Principles = 'true';
      document.head.appendChild(link);
    }

    function clearLegacyInline(element, className) {
      if (!element) return;
      element.removeAttribute('style');
      if (className) element.classList.add(className);
    }

    function normalizeLegacyStaticStyles() {
      const todayLogToolbar = document.getElementById('clearTodayBtn')?.closest('.grocery-toolbar');
      clearLegacyInline(todayLogToolbar, 'pass10-toolbar-compact');
      clearLegacyInline(todayLogToolbar?.querySelector('h4'), 'pass10-heading-reset');

      const batchKicker = document.querySelector('#view-plan > h5');
      clearLegacyInline(batchKicker, 'pass10-section-kicker');

      const breakfastHeading = Array.from(document.querySelectorAll('#view-plan .day-block h4'))
        .find(node => node.textContent.includes('600-kcal Breakfast Base'));
      const breakfastBlock = breakfastHeading?.closest('.day-block');
      clearLegacyInline(breakfastBlock, 'pass10-breakfast-base');
      clearLegacyInline(breakfastHeading, 'pass10-breakfast-title');
      const breakfastNote = breakfastBlock?.querySelector('.meal-line:last-child');
      clearLegacyInline(breakfastNote, 'pass10-breakfast-note');

      clearLegacyInline(document.querySelector('#view-recipes .section-head-row .view-desc'), 'pass10-desc-tight');
      clearLegacyInline(document.getElementById('recipeGrid'), 'pass10-grid-spaced');
      clearLegacyInline(document.getElementById('grocProgress'), 'pass10-grocery-progress');
      clearLegacyInline(document.getElementById('gymDayDetail'), 'pass10-relative');

      const recoveryBlock = document.getElementById('trackerWeekLabel')?.closest('.day-block');
      clearLegacyInline(recoveryBlock, 'pass10-section-gap');
      const recoveryToolbar = recoveryBlock?.querySelector('.grocery-toolbar');
      clearLegacyInline(recoveryToolbar, 'pass10-toolbar-tight');
      clearLegacyInline(recoveryToolbar?.querySelector('h4'), 'pass10-heading-reset');

      const goalsActions = document.querySelector('#goalsForm > .form-actions');
      clearLegacyInline(goalsActions, 'pass10-actions-start');

      const appearance = document.getElementById('themeToggle')?.closest('.day-block');
      clearLegacyInline(appearance, 'pass10-section-gap');
      clearLegacyInline(appearance?.querySelector('.meal-line'), 'pass10-appearance-copy');

      const resetButton = document.getElementById('resetAppBtn');
      const dangerBlock = resetButton?.closest('.day-block');
      clearLegacyInline(dangerBlock, 'pass10-danger-section');
      clearLegacyInline(dangerBlock?.querySelector('h4'), 'pass10-danger-title');
      clearLegacyInline(dangerBlock?.querySelector('.form-actions'), 'pass10-actions-start-gap');
      clearLegacyInline(resetButton, 'pass10-danger-button');
    }

    function arrangeTodayComposition() {
      const view = document.getElementById('view-today');
      const summary = document.getElementById('todaySummary');
      const arc = view?.querySelector('.arc-card');
      const prayer = view?.querySelector('.prayer-card');
      const timeline = document.getElementById('timelineList');
      if (!view || !summary || !arc || !prayer || !timeline) return;

      let grid = view.querySelector(':scope > .pass10-today-grid');
      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'pass10-today-grid';
        grid.setAttribute('aria-label', 'Today overview and timeline');
        summary.after(grid);
      }

      let primary = grid.querySelector(':scope > .pass10-today-primary');
      if (!primary) {
        primary = document.createElement('div');
        primary.className = 'pass10-today-primary';
        grid.appendChild(primary);
      }

      let secondary = grid.querySelector(':scope > .pass10-today-secondary');
      if (!secondary) {
        secondary = document.createElement('div');
        secondary.className = 'pass10-today-secondary';
        grid.appendChild(secondary);
      }

      if (arc.parentElement !== primary) primary.appendChild(arc);
      if (prayer.parentElement !== primary) primary.appendChild(prayer);
      if (timeline.parentElement !== secondary) secondary.appendChild(timeline);
    }

    function runArcEntranceOnce() {
      const arc = document.querySelector('#view-today .arc-card');
      if (!arc) return;

      let hasPlayed = false;
      try {
        hasPlayed = sessionStorage.getItem('arc-pass10-entrance-v1') === '1';
      } catch (error) {
        hasPlayed = false;
      }
      if (hasPlayed) return;

      arc.classList.add('pass10-arc-enter');
      arc.addEventListener('animationend', () => arc.classList.remove('pass10-arc-enter'), { once: true });
      try {
        sessionStorage.setItem('arc-pass10-entrance-v1', '1');
      } catch (error) {
        // Session-only polish; storage failure is non-fatal.
      }
    }

    function renderEmptyState(container, message) {
      if (!container) return;
      container.innerHTML = `
        <div class="pass10-empty-state" role="status">
          ${EMPTY_ICON}
          <p>${escapeHtml(message)}</p>
        </div>`;
    }

    function isSimpleEmptyContainer(container) {
      if (!container) return false;
      if (!container.textContent.trim()) return true;
      if (container.children.length !== 1) return false;
      const child = container.firstElementChild;
      if (!child) return true;
      return child.matches('p, .empty-state, .log-empty');
    }

    function enhanceRecipeCards() {
      const grid = document.getElementById('recipeGrid');
      if (!grid) return;

      if (!grid.querySelector('.recipe-card-pass4')) {
        renderEmptyState(
          grid,
          appState.recipeShowArchived ? 'No archived recipes.' : 'No recipes here yet.'
        );
        return;
      }

      grid.querySelectorAll('.recipe-card-pass4').forEach(card => {
        const recipe = getRecipe(card.dataset.id);
        const badges = card.querySelector('.recipe-card-badges');
        if (!recipe || !badges) return;

        const kcal = document.createElement('span');
        kcal.className = 'badge kcal';
        kcal.textContent = `${recipe.kcalNum} kcal / ${recipe.kcalUnit}`;

        badges.replaceChildren(kcal);

        let contextLabel = '';
        let contextClass = 'badge';
        let watchUrl = null;

        if (recipe.isCustom) {
          contextLabel = 'Custom';
          contextClass += ' custom';
        } else if (appState.recipeShowArchived) {
          contextLabel = 'Archived';
          contextClass += ' custom';
        } else {
          watchUrl = sanitizeUrl(recipe.youtubeLink);
          if (watchUrl) {
            contextLabel = 'Watch';
            contextClass += ' watch-btn';
          }
        }

        if (contextLabel) {
          const context = document.createElement(watchUrl ? 'button' : 'span');
          if (watchUrl) context.type = 'button';
          context.className = contextClass;
          context.textContent = contextLabel;
          if (watchUrl) {
            context.setAttribute('aria-label', `Watch ${recipe.name}`);
            context.addEventListener('click', event => {
              event.stopPropagation();
              window.open(watchUrl, '_blank', 'noopener noreferrer');
            });
          }
          badges.appendChild(context);
        }

        let meta = card.querySelector('.pass10-recipe-secondary-meta');
        if (!meta) {
          meta = document.createElement('div');
          meta.className = 'pass10-recipe-secondary-meta';
          badges.after(meta);
        }

        const details = [];
        if (recipe.time && recipe.time !== '—') details.push(recipe.time);
        if (recipe.cost && recipe.cost !== '—') details.push(recipe.cost);
        meta.textContent = details.join(' · ');
        meta.hidden = details.length === 0;
      });
    }

    function enhanceGroceryEmptyState() {
      const grid = document.getElementById('groceryGrid');
      if (!grid) return;

      const existingEmpty = grid.querySelector('.empty-state');
      if (existingEmpty) {
        existingEmpty.classList.add('pass10-empty-state');
        existingEmpty.setAttribute('role', 'status');
        return;
      }

      if (grid.classList.contains('grocery-empty') || !grid.querySelector('.grocery-item')) {
        renderEmptyState(grid, 'No grocery items for this week.');
      }
    }

    function enhanceTodayLogEmptyState() {
      const list = document.getElementById('todayLogList');
      if (!list || list.querySelector('.log-entry')) return;
      if (isSimpleEmptyContainer(list)) renderEmptyState(list, 'Nothing logged today.');
    }

    function enhanceChangeLogEmptyState(id) {
      const list = document.getElementById(id);
      if (!list) return;
      if (isSimpleEmptyContainer(list)) renderEmptyState(list, 'No recent changes.');
    }

    function enhanceCalorieAccessibility() {
      const consumed = document.getElementById('todayConsumed');
      const target = document.getElementById('todayTarget');
      const parent = consumed?.parentElement;
      if (parent && consumed && target) {
        parent.setAttribute('aria-label', `${consumed.textContent} of ${target.textContent} calories logged today`);
      }

      const weekConsumed = document.getElementById('weekConsumed');
      const weekTarget = document.getElementById('weekTarget');
      const weekParent = weekConsumed?.parentElement;
      if (weekParent && weekConsumed && weekTarget) {
        weekParent.setAttribute('aria-label', `${weekConsumed.textContent} of ${weekTarget.textContent} calories logged this week`);
      }
    }

    function enhanceMobileNavAccessibility() {
      const dock = document.querySelector('.arc-mobile-dock');
      if (!dock) return;

      function sync() {
        dock.querySelectorAll('button[data-view]').forEach(button => {
          if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
          else button.removeAttribute('aria-current');
        });
      }

      sync();
      const observer = new MutationObserver(sync);
      observer.observe(dock, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    function wrapRenderer(name, enhancer) {
      const base = window[name];
      if (typeof base !== 'function' || base.__pass10Wrapped) return;

      const wrapped = function pass10WrappedRenderer(...args) {
        const result = base.apply(this, args);
        enhancer(...args);
        return result;
      };
      wrapped.__pass10Wrapped = true;
      window[name] = wrapped;
    }

    ensureStylesheet();
    normalizeLegacyStaticStyles();
    arrangeTodayComposition();
    enhanceRecipeCards();
    enhanceGroceryEmptyState();
    enhanceTodayLogEmptyState();
    enhanceChangeLogEmptyState('calChangeLog');
    enhanceChangeLogEmptyState('planChangeLog');
    enhanceCalorieAccessibility();
    enhanceMobileNavAccessibility();
    runArcEntranceOnce();

    wrapRenderer('renderTodaySummary', arrangeTodayComposition);
    wrapRenderer('renderTimeline', arrangeTodayComposition);
    wrapRenderer('renderRecipes', enhanceRecipeCards);
    wrapRenderer('renderGrocery', enhanceGroceryEmptyState);
    wrapRenderer('renderTodayLog', enhanceTodayLogEmptyState);
    wrapRenderer('renderCalSummary', enhanceCalorieAccessibility);

    const baseRenderChangeLog = window.renderChangeLog;
    if (typeof baseRenderChangeLog === 'function' && !baseRenderChangeLog.__pass10Wrapped) {
      const wrappedChangeLog = function pass10RenderChangeLog(type, id) {
        const result = baseRenderChangeLog.apply(this, arguments);
        enhanceChangeLogEmptyState(id);
        return result;
      };
      wrappedChangeLog.__pass10Wrapped = true;
      window.renderChangeLog = wrappedChangeLog;
    }

    window.ArcPass10 = {
      version: '10.0-principles',
      refresh() {
        normalizeLegacyStaticStyles();
        arrangeTodayComposition();
        enhanceRecipeCards();
        enhanceGroceryEmptyState();
        enhanceTodayLogEmptyState();
        enhanceChangeLogEmptyState('calChangeLog');
        enhanceChangeLogEmptyState('planChangeLog');
        enhanceCalorieAccessibility();
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPass10Principles, { once: true });
  } else {
    initPass10Principles();
  }
})();
