/**
 * daily-brief-media-pass9.js
 * Pass 9 — Daily Brief detail/photo alternation.
 *
 * Keeps the existing Daily Brief carousel and its 6.5s rotation. For each
 * active brief detail, copy is shown first, then its matching image fades and
 * slides in from right to left inside the same detail box.
 */

(function initDailyBriefMediaAlternation() {
  let alternationTimer = null;
  let observedStage = null;
  let stageObserver = null;
  let summaryObserver = null;

  function ensureStylesheet() {
    if (document.querySelector('link[data-daily-brief-media-pass9]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/daily-brief-media-pass9.css';
    link.dataset.dailyBriefMediaPass9 = 'true';
    document.head.appendChild(link);
  }

  function resolveBriefAsset(key) {
    if (!window.ArcMedia || typeof window.ArcMedia.resolve !== 'function') return null;
    return window.ArcMedia.resolve('dailyBrief', key)
      || window.ArcMedia.resolve('dailyBrief', 'today')
      || null;
  }

  function buildPhotoPanel(key) {
    const asset = resolveBriefAsset(key);
    const panel = document.createElement('div');
    panel.className = 'arc-media-brief-photo-panel';
    panel.dataset.briefMediaFor = key;
    panel.setAttribute('aria-hidden', 'true');

    if (!asset || !asset.src) {
      panel.classList.add('is-placeholder');
      const label = document.createElement('span');
      label.className = 'arc-media-brief-photo-placeholder';
      label.textContent = `${key.replace(/-/g, ' ')} photo`;
      panel.appendChild(label);
      return panel;
    }

    panel.classList.add('has-image');
    const img = document.createElement('img');
    img.src = asset.src;
    img.alt = asset.alt || '';
    img.loading = 'eager';
    img.decoding = 'async';
    if (asset.width) img.width = asset.width;
    if (asset.height) img.height = asset.height;
    if (asset.photographer) panel.dataset.photographer = asset.photographer;
    if (asset.sourceUrl) panel.dataset.sourceUrl = asset.sourceUrl;
    if (asset.pexelsId) panel.dataset.pexelsId = String(asset.pexelsId);

    img.addEventListener('error', () => {
      panel.replaceChildren();
      panel.classList.remove('has-image');
      panel.classList.add('is-placeholder');
      const label = document.createElement('span');
      label.className = 'arc-media-brief-photo-placeholder';
      label.textContent = `${key.replace(/-/g, ' ')} photo`;
      panel.appendChild(label);
    }, { once: true });

    panel.appendChild(img);
    return panel;
  }

  function cancelLayerAnimations(item) {
    item.querySelectorAll('.arc-media-brief-copy, .arc-media-brief-photo-panel').forEach(layer => {
      layer.getAnimations().forEach(animation => animation.cancel());
    });
  }

  function showCopy(item) {
    if (!item) return;
    cancelLayerAnimations(item);
    item.classList.remove('arc-media-brief-show-photo');
    const photo = item.querySelector('.arc-media-brief-photo-panel');
    if (photo) photo.setAttribute('aria-hidden', 'true');
  }

  function showPhoto(item) {
    if (!item || item.getAttribute('aria-hidden') !== 'false') return;
    const copy = item.querySelector('.arc-media-brief-copy');
    const photo = item.querySelector('.arc-media-brief-photo-panel');
    if (!copy || !photo) return;

    cancelLayerAnimations(item);
    photo.setAttribute('aria-hidden', 'false');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || typeof photo.animate !== 'function') {
      item.classList.add('arc-media-brief-show-photo');
      return;
    }

    const timing = {
      duration: 520,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    };

    const copyAnimation = copy.animate([
      { opacity: 1, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(-34px)' },
    ], timing);

    const photoAnimation = photo.animate([
      { opacity: 0, transform: 'translateX(34px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ], timing);

    Promise.allSettled([copyAnimation.finished, photoAnimation.finished]).then(() => {
      if (item.getAttribute('aria-hidden') !== 'false') return;
      item.classList.add('arc-media-brief-show-photo');
      cancelLayerAnimations(item);
    });
  }

  function prepareItem(item) {
    if (!item || !item.dataset.briefKey || item.dataset.briefMediaPrepared === '1') return;
    item.dataset.briefMediaPrepared = '1';
    item.classList.add('arc-media-brief-alternating-item');

    const copy = document.createElement('div');
    copy.className = 'arc-media-brief-copy';
    while (item.firstChild) copy.appendChild(item.firstChild);

    item.append(copy, buildPhotoPanel(item.dataset.briefKey));
    showCopy(item);
  }

  function prepareStage(stage) {
    if (!stage) return;
    stage.querySelectorAll('.daily-brief-item[data-brief-key]').forEach(prepareItem);
  }

  function scheduleActiveAlternation(stage) {
    if (alternationTimer !== null) clearTimeout(alternationTimer);
    prepareStage(stage);

    const items = Array.from(stage.querySelectorAll('.daily-brief-item[data-brief-key]'));
    items.forEach(showCopy);

    const active = items.find(item => item.getAttribute('aria-hidden') === 'false' && !item.hidden);
    if (!active) return;

    // The parent carousel advances every 6500ms. Keep copy visible for roughly
    // half the turn, then let the image own the second half.
    alternationTimer = setTimeout(() => showPhoto(active), 3150);
  }

  function observeStage(stage) {
    if (!stage || stage === observedStage) {
      if (stage) scheduleActiveAlternation(stage);
      return;
    }

    if (stageObserver) stageObserver.disconnect();
    observedStage = stage;
    prepareStage(stage);

    stageObserver = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation =>
        mutation.type === 'childList'
        || (mutation.type === 'attributes' && (mutation.attributeName === 'hidden' || mutation.attributeName === 'aria-hidden'))
      );
      if (!relevant) return;
      requestAnimationFrame(() => scheduleActiveAlternation(stage));
    });

    stageObserver.observe(stage, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden'],
    });

    scheduleActiveAlternation(stage);
  }

  function syncDailyBrief() {
    const brief = document.getElementById('todaySummary');
    if (!brief) return;

    const shell = brief.querySelector('.daily-brief-shell');
    const stage = shell && shell.querySelector('.daily-brief-stage');
    if (!shell || !stage) return;

    // Remove the previous Pass 9 side-photo treatment. Photography now lives
    // entirely inside the rotating detail box.
    shell.classList.remove('arc-media-daily-brief-shell');
    shell.classList.add('arc-media-brief-alternating-shell');
    shell.querySelectorAll(':scope > .arc-media-daily-brief-slot').forEach(slot => slot.remove());

    observeStage(stage);
  }

  function start() {
    ensureStylesheet();
    syncDailyBrief();

    const brief = document.getElementById('todaySummary');
    if (brief && !summaryObserver) {
      summaryObserver = new MutationObserver(() => requestAnimationFrame(syncDailyBrief));
      summaryObserver.observe(brief, { childList: true, subtree: true });
    }

    // media-pass9.js may initialize before or after the main carousel. Re-sync
    // after the current task and first paint so either load order is safe.
    setTimeout(syncDailyBrief, 0);
    requestAnimationFrame(syncDailyBrief);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
