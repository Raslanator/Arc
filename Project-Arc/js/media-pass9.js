/**
 * media-pass9.js
 * Pass 9 — shared image scaffold for Daily Brief, Recipes, Meal Plan,
 * Grocery, and Gym.
 *
 * No real photos are registered yet. The registry and DOM slots are prepared
 * so later image work only needs normal asset files plus registry entries.
 */

(function bootstrapArcMediaScaffold() {
  function initArcMediaScaffold() {
    if (window.ArcMedia) return;

    const registry = {
      dailyBrief: {},
      recipes: {},
      mealPlan: {},
      grocery: {},
      gym: {},
    };

    function ensureStylesheet() {
      if (document.querySelector('link[data-arc-media-pass9]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'css/media-pass9.css';
      link.dataset.arcMediaPass9 = 'true';
      document.head.appendChild(link);
    }

    function resolveAsset(section, key) {
      if (!section || key === null || key === undefined) return null;
      const normalizedKey = String(key);
      const direct = registry[section] && registry[section][normalizedKey];
      if (direct) return direct;

      // Meal Plan and Grocery may reuse the main recipe photograph unless a
      // section-specific crop is registered later.
      if ((section === 'mealPlan' || section === 'grocery') && registry.recipes[normalizedKey]) {
        return registry.recipes[normalizedKey];
      }
      return null;
    }

    function createMediaSlot(section, key, options) {
      const opts = options || {};
      const asset = resolveAsset(section, key);
      const slot = document.createElement('div');
      slot.className = `arc-media-slot ${opts.className || ''}`.trim();
      slot.dataset.mediaSection = section;
      if (key !== null && key !== undefined) slot.dataset.mediaKey = String(key);

      if (!asset || !asset.src) {
        slot.classList.add('is-placeholder');
        slot.setAttribute('aria-hidden', 'true');
        const placeholder = document.createElement('span');
        placeholder.className = 'arc-media-placeholder';
        placeholder.textContent = opts.placeholder || 'Image space';
        slot.appendChild(placeholder);
        return slot;
      }

      slot.classList.add('has-image');
      const img = document.createElement('img');
      img.src = asset.src;
      img.alt = asset.alt || '';
      img.loading = opts.eager ? 'eager' : 'lazy';
      img.decoding = 'async';

      if (asset.width) img.width = asset.width;
      if (asset.height) img.height = asset.height;
      if (asset.photographer) slot.dataset.photographer = asset.photographer;
      if (asset.sourceUrl) slot.dataset.sourceUrl = asset.sourceUrl;
      if (asset.pexelsId) slot.dataset.pexelsId = String(asset.pexelsId);

      img.addEventListener('error', () => {
        slot.replaceChildren();
        slot.classList.remove('has-image');
        slot.classList.add('is-placeholder');
        slot.setAttribute('aria-hidden', 'true');
        const placeholder = document.createElement('span');
        placeholder.className = 'arc-media-placeholder';
        placeholder.textContent = opts.placeholder || 'Image space';
        slot.appendChild(placeholder);
      }, { once: true });

      slot.appendChild(img);
      return slot;
    }

    function enhanceDailyBrief() {
      const brief = document.getElementById('todaySummary');
      const shell = brief && brief.querySelector('.daily-brief-shell');
      if (!shell || shell.querySelector(':scope > .arc-media-daily-brief-slot')) return;

      shell.classList.add('arc-media-daily-brief-shell');
      shell.append(createMediaSlot('dailyBrief', 'today', {
        className: 'arc-media-daily-brief-slot',
        placeholder: 'Daily brief photo',
        eager: true,
      }));
    }

    function enhanceRecipeCards() {
      const grid = document.getElementById('recipeGrid');
      if (!grid) return;

      grid.querySelectorAll('.recipe-card-pass4').forEach(card => {
        if (card.querySelector(':scope > .arc-media-recipe-card-slot')) return;
        const recipeId = card.dataset.id;
        card.classList.add('arc-media-recipe-card');
        card.prepend(createMediaSlot('recipes', recipeId, {
          className: 'arc-media-recipe-card-slot',
          placeholder: 'Recipe photo',
        }));
      });
    }

    function enhanceRecipeModal(recipe) {
      const modal = document.getElementById('modalContent');
      if (!modal || !recipe || modal.querySelector('.arc-media-recipe-modal-slot')) return;

      const slot = createMediaSlot('recipes', recipe.id, {
        className: 'arc-media-recipe-modal-slot',
        placeholder: 'Recipe photo',
        eager: true,
      });
      const title = modal.querySelector('h3');
      if (title) modal.insertBefore(slot, title);
      else modal.prepend(slot);
    }

    function enhanceMealPlan() {
      const dayBlocks = document.getElementById('dayBlocks');
      const week = effectiveWeeks()[appState.currentWeek];
      if (!dayBlocks || !week) return;

      const blocks = dayBlocks.querySelectorAll('.pass5-day-block');
      blocks.forEach((block, dayIndex) => {
        const day = week.days[dayIndex];
        if (!day) return;

        const mealRows = block.querySelectorAll('.pass5-meal-row:not(.breakfast-row)');
        [['lunch', day.lunch], ['dinner', day.dinner]].forEach(([slotName, recipeId], rowIndex) => {
          const row = mealRows[rowIndex];
          if (!row || !recipeId || row.querySelector('.arc-media-meal-slot')) return;
          row.classList.add('arc-media-meal-row');
          row.prepend(createMediaSlot('mealPlan', recipeId, {
            className: 'arc-media-meal-slot',
            placeholder: `${slotName} photo`,
          }));
        });
      });
    }

    function enhanceGrocery() {
      const grid = document.getElementById('groceryGrid');
      if (!grid || grid.classList.contains('grocery-empty')) return;

      const recipeIds = weekRecipeIds(appState.grocWeek);
      const headers = grid.querySelectorAll('.grocery-section-header');
      headers.forEach((header, index) => {
        if (header.classList.contains('arc-media-grocery-header')) return;
        const recipeId = recipeIds[index];
        if (!recipeId) return;

        const titleText = header.textContent.trim();
        const title = document.createElement('span');
        title.className = 'arc-media-grocery-title';
        title.textContent = titleText;

        header.textContent = '';
        header.classList.add('arc-media-grocery-header');
        header.append(
          createMediaSlot('grocery', recipeId, {
            className: 'arc-media-grocery-slot',
            placeholder: 'Grocery photo',
          }),
          title
        );
      });
    }

    function enhanceGym() {
      const detail = document.getElementById('gymDayDetail');
      if (!detail || detail.querySelector('.arc-media-gym-slot')) return;

      const key = String(appState.gymDay);
      const slot = createMediaSlot('gym', key, {
        className: 'arc-media-gym-slot',
        placeholder: 'Training image',
        eager: true,
      });
      const head = detail.querySelector('.pass6-gym-detail-head');
      if (head) head.after(slot);
      else detail.prepend(slot);
    }

    function enhanceCurrentDom() {
      enhanceDailyBrief();
      enhanceRecipeCards();
      enhanceMealPlan();
      enhanceGrocery();
      enhanceGym();
    }

    function register(section, key, asset) {
      if (!registry[section] || key === null || key === undefined || !asset) return false;
      registry[section][String(key)] = { ...asset };
      return true;
    }

    function registerMany(section, assets) {
      if (!registry[section] || !assets) return false;
      Object.entries(assets).forEach(([key, asset]) => register(section, key, asset));
      return true;
    }

    ensureStylesheet();

    // Daily Brief is transformed into its carousel shell just after
    // renderTodaySummary(), so wait one animation frame before adding media.
    const baseRenderTodaySummary = renderTodaySummary;
    renderTodaySummary = function renderTodaySummaryWithMediaSlot() {
      baseRenderTodaySummary();
      requestAnimationFrame(enhanceDailyBrief);
    };

    const baseRenderRecipes = renderRecipes;
    renderRecipes = function renderRecipesWithMediaSlots() {
      baseRenderRecipes();
      enhanceRecipeCards();
    };

    const baseOpenRecipe = openRecipe;
    openRecipe = function openRecipeWithMediaSlot(recipe) {
      baseOpenRecipe(recipe);
      enhanceRecipeModal(recipe);
    };

    const baseRenderWeekDetail = renderWeekDetail;
    renderWeekDetail = function renderWeekDetailWithMediaSlots() {
      baseRenderWeekDetail();
      enhanceMealPlan();
    };

    const baseRenderGrocery = renderGrocery;
    renderGrocery = function renderGroceryWithMediaSlots() {
      baseRenderGrocery();
      enhanceGrocery();
    };

    const baseRenderGymDetail = renderGymDetail;
    renderGymDetail = function renderGymDetailWithMediaSlot() {
      baseRenderGymDetail();
      enhanceGym();
    };

    window.ArcMedia = {
      registry,
      register,
      registerMany,
      resolve: resolveAsset,
      refresh: enhanceCurrentDom,
      root: 'assets/images',
      version: 'pass9-scaffold-2',
    };

    // Main may already have rendered by the time this dynamically loaded pass
    // initializes, so decorate the current DOM once without forcing a rerender.
    enhanceCurrentDom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArcMediaScaffold, { once: true });
  } else {
    initArcMediaScaffold();
  }
})();
