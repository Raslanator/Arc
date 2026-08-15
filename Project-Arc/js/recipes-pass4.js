/**
 * recipes-pass4.js
 * Pass 4 — Recipe Library card cleanup and compact action menu.
 *
 * Keeps the existing recipe data/state and archive/delete replacement safety.
 * Only the Recipe Library card rendering and card-level interactions change.
 */

(function initRecipesPass4() {
  function closeRecipeMenus(exceptMenu) {
    document.querySelectorAll('#recipeGrid .recipe-menu-popover').forEach(menu => {
      if (menu === exceptMenu) return;
      menu.hidden = true;
      const toggle = menu.closest('.recipe-card-menu')?.querySelector('.recipe-menu-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function recipeStatusText(recipe, showArchived) {
    const parts = [];
    if (recipe.isCustom) parts.push('Custom recipe');
    if (showArchived) parts.push('Archived');
    return parts.join(' · ');
  }

  renderRecipes = function renderRecipesPass4() {
    const filterEl = document.getElementById('recipeFilter');
    if (filterEl) {
      filterEl.querySelectorAll('button').forEach(button => {
        button.classList.toggle(
          'active',
          (button.dataset.f === 'archived') === !!appState.recipeShowArchived
        );
      });
    }

    const showArchived = !!appState.recipeShowArchived;
    const list = showArchived
      ? allRecipes().filter(recipe => isArchived(recipe.id))
      : activeRecipes();
    const grid = document.getElementById('recipeGrid');
    if (!grid) return;

    grid.innerHTML = list.map(recipe => {
      const safeWatch = sanitizeUrl(recipe.youtubeLink);
      const status = recipeStatusText(recipe, showArchived);
      const timeBadge = recipe.time && recipe.time !== '—'
        ? `<span class="badge recipe-time-badge">${escapeHtml(recipe.time)}</span>`
        : '';

      return `
        <div class="card card-relative recipe-card-pass4" data-id="${escapeHtml(recipe.id)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(recipe.name)}">
          <div class="recipe-card-menu">
            <button type="button" class="recipe-menu-toggle" aria-label="Recipe actions for ${escapeHtml(recipe.name)}" aria-haspopup="menu" aria-expanded="false">&#8943;</button>
            <div class="recipe-menu-popover" role="menu" hidden>
              <button type="button" class="recipe-menu-action" role="menuitem" data-action="edit" data-id="${escapeHtml(recipe.id)}">Edit</button>
              ${safeWatch ? `<button type="button" class="recipe-menu-action" role="menuitem" data-action="watch" data-id="${escapeHtml(recipe.id)}" data-url="${escapeHtml(safeWatch)}">Watch</button>` : ''}
              <button type="button" class="recipe-menu-action" role="menuitem" data-action="archive" data-id="${escapeHtml(recipe.id)}">${showArchived ? 'Unarchive' : 'Archive'}</button>
              <button type="button" class="recipe-menu-action recipe-menu-danger" role="menuitem" data-action="delete" data-id="${escapeHtml(recipe.id)}">Delete</button>
            </div>
          </div>
          ${status ? `<p class="recipe-card-status">${escapeHtml(status)}</p>` : ''}
          <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
          <div class="badges recipe-card-badges">
            <span class="badge kcal">${escapeHtml(String(recipe.kcalNum))} kcal / ${escapeHtml(recipe.kcalUnit)}</span>
            ${timeBadge}
          </div>
        </div>`;
    }).join('') || `<p class="meal-line">${showArchived ? 'No archived recipes.' : 'No recipes here — add one, or check Archived.'}</p>`;

    grid.querySelectorAll('.recipe-card-pass4').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('.recipe-card-menu')) return;
        openRecipe(getRecipe(card.dataset.id));
      });
      card.addEventListener('keydown', event => {
        if (event.target !== card || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        openRecipe(getRecipe(card.dataset.id));
      });
    });

    grid.querySelectorAll('.recipe-card-menu').forEach(menuRoot => {
      menuRoot.addEventListener('click', event => event.stopPropagation());
    });

    grid.querySelectorAll('.recipe-menu-toggle').forEach(toggle => {
      toggle.addEventListener('click', event => {
        event.stopPropagation();
        const menu = toggle.nextElementSibling;
        if (!menu) return;
        const willOpen = menu.hidden;
        closeRecipeMenus(willOpen ? menu : null);
        menu.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (willOpen) {
          const firstAction = menu.querySelector('.recipe-menu-action');
          if (firstAction) requestAnimationFrame(() => firstAction.focus());
        }
      });
    });

    grid.querySelectorAll('.recipe-menu-action').forEach(action => {
      action.addEventListener('click', event => {
        event.stopPropagation();
        const recipe = getRecipe(action.dataset.id);
        if (!recipe) return;
        closeRecipeMenus();

        switch (action.dataset.action) {
          case 'edit':
            openRecipeForm(recipe);
            break;
          case 'watch': {
            const safeUrl = sanitizeUrl(action.dataset.url);
            if (safeUrl) window.open(safeUrl, '_blank', 'noopener noreferrer');
            break;
          }
          case 'archive':
            if (showArchived) unarchiveRecipe(recipe.id);
            else handleArchiveRecipe(recipe.id);
            break;
          case 'delete':
            handleDeleteRecipe(recipe.id);
            break;
        }
      });
    });
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('#recipeGrid .recipe-card-menu')) closeRecipeMenus();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeRecipeMenus();
  });
})();
