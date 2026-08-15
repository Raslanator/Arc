/**
 * nav-mobile-pass8.js
 * Pass 8 — mobile navigation and small-screen navigation behaviour.
 *
 * Desktop/tablet keeps the existing pill navigation. At phone widths the
 * eight-tab bar is replaced by a fixed five-item dock with a More sheet.
 */

(function initPass8MobileNavigation() {
  const MOBILE_QUERY = '(max-width: 720px)';
  const PRIMARY_VIEWS = ['today', 'calories', 'progress', 'gym'];
  const MORE_VIEWS = [
    { view: 'plan', label: 'Meal Plan', detail: 'Meals and weekly rotation', icon: 'plan' },
    { view: 'recipes', label: 'Recipes', detail: 'Recipe library' },
    { view: 'grocery', label: 'Grocery', detail: 'Weekly shopping lists' },
    { view: 'goals', label: 'Settings', detail: 'Targets and appearance' },
  ];

  const PRIMARY_ITEMS = [
    { view: 'today', label: 'Today', icon: 'today' },
    { view: 'calories', label: 'Calories', icon: 'calories' },
    { view: 'progress', label: 'Progress', icon: 'progress' },
    { view: 'gym', label: 'Gym', icon: 'gym' },
  ];

  const PROGRESS_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M4 18V11"/>
    <path d="M10 18V7"/>
    <path d="M16 18V4"/>
    <path d="M3 20h18"/>
    <path d="M4 10l5-4 5 2 6-5"/>
  </svg>`;

  let lastFocusedElement = null;

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function iconMarkup(name) {
    if (name === 'progress') return PROGRESS_ICON;
    return typeof icon === 'function' ? icon(name) : '';
  }

  function buildMobileNavigation() {
    if (document.getElementById('mobileTabbar')) return;

    const dock = document.createElement('nav');
    dock.className = 'mobile-tabbar';
    dock.id = 'mobileTabbar';
    dock.setAttribute('aria-label', 'Primary navigation');

    PRIMARY_ITEMS.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-tabbar-item';
      button.dataset.view = item.view;
      button.setAttribute('aria-label', item.label);
      button.innerHTML = `${iconMarkup(item.icon)}<span>${escapeHtml(item.label)}</span>`;
      button.addEventListener('click', () => navigateMobile(item.view));
      dock.appendChild(button);
    });

    const moreButton = document.createElement('button');
    moreButton.type = 'button';
    moreButton.className = 'mobile-tabbar-item mobile-tabbar-more';
    moreButton.id = 'mobileMoreButton';
    moreButton.setAttribute('aria-label', 'More navigation');
    moreButton.setAttribute('aria-expanded', 'false');
    moreButton.setAttribute('aria-controls', 'mobileMoreSheet');
    moreButton.innerHTML = `${iconMarkup('more')}<span>More</span>`;
    moreButton.addEventListener('click', toggleMoreSheet);
    dock.appendChild(moreButton);

    const backdrop = document.createElement('div');
    backdrop.className = 'mobile-more-backdrop';
    backdrop.id = 'mobileMoreBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', closeMoreSheet);

    const sheet = document.createElement('div');
    sheet.className = 'mobile-more-sheet';
    sheet.id = 'mobileMoreSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'mobileMoreTitle');
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = `
      <div class="mobile-more-handle" aria-hidden="true"></div>
      <div class="mobile-more-head">
        <div>
          <span>Navigation</span>
          <strong id="mobileMoreTitle">More</strong>
        </div>
        <button type="button" class="mobile-more-close" id="mobileMoreClose" aria-label="Close navigation">&times;</button>
      </div>
      <div class="mobile-more-grid" id="mobileMoreGrid"></div>
    `;

    const grid = sheet.querySelector('#mobileMoreGrid');
    MORE_VIEWS.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-more-item';
      button.dataset.view = item.view;
      button.innerHTML = `
        <span class="mobile-more-item-icon" aria-hidden="true">${item.icon ? iconMarkup(item.icon) : escapeHtml(item.label.charAt(0))}</span>
        <span class="mobile-more-item-copy">
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </span>
        <span class="mobile-more-chevron" aria-hidden="true">&#8250;</span>
      `;
      button.addEventListener('click', () => {
        closeMoreSheet(false);
        navigateMobile(item.view);
      });
      grid.appendChild(button);
    });

    sheet.querySelector('#mobileMoreClose').addEventListener('click', closeMoreSheet);
    sheet.addEventListener('keydown', handleSheetKeydown);

    document.body.append(backdrop, sheet, dock);
    syncMobileNavigation(appState && appState.activeTab ? appState.activeTab : 'today');
  }

  function navigateMobile(view) {
    if (typeof activateTab !== 'function') return;
    closeMoreSheet(false);
    activateTab(view);
    if (isMobile()) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function openMoreSheet() {
    if (!isMobile()) return;
    const sheet = document.getElementById('mobileMoreSheet');
    const backdrop = document.getElementById('mobileMoreBackdrop');
    const moreButton = document.getElementById('mobileMoreButton');
    if (!sheet || !backdrop || !moreButton) return;

    lastFocusedElement = document.activeElement;
    document.body.classList.add('mobile-more-open');
    sheet.classList.add('open');
    backdrop.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    moreButton.setAttribute('aria-expanded', 'true');

    const activeItem = sheet.querySelector('.mobile-more-item.active');
    const firstItem = sheet.querySelector('.mobile-more-item');
    requestAnimationFrame(() => (activeItem || firstItem)?.focus());
  }

  function closeMoreSheet(restoreFocus = true) {
    const sheet = document.getElementById('mobileMoreSheet');
    const backdrop = document.getElementById('mobileMoreBackdrop');
    const moreButton = document.getElementById('mobileMoreButton');
    if (!sheet || !backdrop || !moreButton) return;

    document.body.classList.remove('mobile-more-open');
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    moreButton.setAttribute('aria-expanded', 'false');

    if (restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function toggleMoreSheet() {
    const sheet = document.getElementById('mobileMoreSheet');
    if (!sheet) return;
    sheet.classList.contains('open') ? closeMoreSheet() : openMoreSheet();
  }

  function handleSheetKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMoreSheet();
      return;
    }

    if (event.key !== 'Tab') return;
    const sheet = document.getElementById('mobileMoreSheet');
    if (!sheet || !sheet.classList.contains('open')) return;
    const focusable = Array.from(sheet.querySelectorAll('button:not(:disabled)'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function syncMobileNavigation(view) {
    const dock = document.getElementById('mobileTabbar');
    if (!dock) return;

    dock.querySelectorAll('.mobile-tabbar-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    const isMoreView = !PRIMARY_VIEWS.includes(view);
    const moreButton = document.getElementById('mobileMoreButton');
    if (moreButton) {
      moreButton.classList.toggle('active', isMoreView);
      if (isMoreView) moreButton.setAttribute('aria-current', 'page');
      else moreButton.removeAttribute('aria-current');
    }

    document.querySelectorAll('#mobileMoreGrid .mobile-more-item').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function keepDesktopTabVisible(view) {
    if (isMobile()) return;
    const nav = document.querySelector('nav.tabs');
    const button = nav && nav.querySelector(`button[data-view="${view}"]`);
    if (!nav || !button) return;
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    if (buttonRect.left < navRect.left || buttonRect.right > navRect.right) {
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  buildMobileNavigation();

  const baseActivateTab = activateTab;
  activateTab = function activateTabWithPass8Navigation(view) {
    baseActivateTab(view);
    syncMobileNavigation(view);
    keepDesktopTabVisible(view);
  };

  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener('change', event => {
    if (!event.matches) closeMoreSheet(false);
    syncMobileNavigation(appState && appState.activeTab ? appState.activeTab : 'today');
  });

  window.Pass8Navigation = {
    sync: syncMobileNavigation,
    openMore: openMoreSheet,
    closeMore: closeMoreSheet,
  };
})();
