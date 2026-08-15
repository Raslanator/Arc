/**
 * meal-plan-pass5-refine.js
 * Visual/interaction correction for Pass 5 Batch Cook.
 * Keeps the Pass 5 integrity model intact while restoring the original
 * list-like Batch Cook interaction: one overflow menu with Swap + Remove.
 */

(function refinePass5BatchCook() {
  let openMenu = null;

  function closeBatchMenu() {
    if (!openMenu) return;
    openMenu.menu.hidden = true;
    openMenu.trigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }

  function firstRecipeUsage(weekIdx, recipeId) {
    const week = effectiveWeeks()[weekIdx];
    if (!week) return null;

    for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
      const day = week.days[dayIdx];
      for (const slot of ['lunch', 'dinner']) {
        if (day[slot] === recipeId) return { dayIdx, slot };
      }
    }
    return null;
  }

  function enhanceBatchCookMenu() {
    const prepBanner = document.getElementById('prepBanner');
    if (!prepBanner) return;

    prepBanner.querySelectorAll('.pass5-batch-card').forEach(card => {
      if (card.querySelector('.batch-overflow-wrap')) return;

      const removeBtn = card.querySelector('.batch-remove-btn');
      if (!removeBtn) return;

      const recipeId = removeBtn.dataset.id;
      const weekIdx = parseInt(removeBtn.dataset.week, 10);

      const wrap = document.createElement('div');
      wrap.className = 'batch-overflow-wrap';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'batch-overflow-trigger';
      trigger.setAttribute('aria-label', 'Batch cook actions');
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.textContent = '…';

      const menu = document.createElement('div');
      menu.className = 'batch-overflow-menu';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;

      const swapBtn = document.createElement('button');
      swapBtn.type = 'button';
      swapBtn.className = 'batch-menu-item batch-menu-swap';
      swapBtn.setAttribute('role', 'menuitem');
      swapBtn.textContent = 'Swap';

      // Keep the existing Remove listener by moving the original button into
      // the menu rather than replacing it with a new control.
      removeBtn.textContent = 'Remove';
      removeBtn.classList.add('batch-menu-item', 'batch-menu-remove');
      removeBtn.setAttribute('role', 'menuitem');

      menu.append(swapBtn, removeBtn);
      wrap.append(trigger, menu);
      card.appendChild(wrap);

      trigger.addEventListener('click', event => {
        event.stopPropagation();
        const isOpen = !menu.hidden;
        closeBatchMenu();
        if (isOpen) return;
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        openMenu = { menu, trigger };
      });

      menu.addEventListener('click', event => event.stopPropagation());

      swapBtn.addEventListener('click', () => {
        const usage = firstRecipeUsage(weekIdx, recipeId);
        closeBatchMenu();
        if (usage) openSwapPicker(weekIdx, usage.dayIdx, usage.slot);
      });

      removeBtn.addEventListener('click', () => {
        closeBatchMenu();
      });
    });
  }

  const pass5RenderWeekDetail = renderWeekDetail;
  renderWeekDetail = function renderWeekDetailWithRestoredBatchMenu() {
    closeBatchMenu();
    pass5RenderWeekDetail();
    enhanceBatchCookMenu();
  };

  document.addEventListener('click', closeBatchMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeBatchMenu();
  });
})();
