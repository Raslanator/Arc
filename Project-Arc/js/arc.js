/**
 * arc.js
 * SVG daily arc: geometry, zoom/pan, dot layout, now-marker,
 * and the pop animation system.
 */

/* ==========================================================================
   ARC GEOMETRY CONSTANTS
   ========================================================================== */

const ARC_W      = 1100;
const ARC_H      = 210;
const ARC_PADX   = 40;
const ARC_TOP    = 40;
const ARC_BOTTOM = 150;

let ARC_MINT = 300;   // updated by recalcArcRange()
let ARC_MAXT = 1350;

/* ==========================================================================
   ZOOM / PAN STATE
   arcZoom/arcPanX/arcPanY = logical TARGET.
   arc*Disp = animated DISPLAYED state that eases toward the target.
   ========================================================================== */

const ARC_MIN_ZOOM = 1;
const ARC_MAX_ZOOM = 5;

let arcZoom = 1, arcPanX = 0, arcPanY = 0;
let arcZoomDisp = 1, arcPanXDisp = 0, arcPanYDisp = 0;
let arcAnimRAF = null;
let arcCurveFactor = 1;

/** Curvature flattens as zoom increases so the arc never clips top/bottom. */
function computeCurveFactor(zoom) {
  const t = Math.max(0, Math.min(1, (zoom - ARC_MIN_ZOOM) / (ARC_MAX_ZOOM - ARC_MIN_ZOOM)));
  return 1 - t * 0.9;
}

const DOT_SCALE_MIN = 0.55;

function dotScaleFor(zoom) {
  const t = Math.max(0, Math.min(1, (zoom - ARC_MIN_ZOOM) / (ARC_MAX_ZOOM - ARC_MIN_ZOOM)));
  return Math.max(DOT_SCALE_MIN, 1 - t * 0.45);
}

function nowMarkerScaleFor(zoom) {
  const t = Math.max(0, Math.min(1, (zoom - ARC_MIN_ZOOM) / (ARC_MAX_ZOOM - ARC_MIN_ZOOM)));
  return 1 - t * 0.32;
}

/* ==========================================================================
   ARC COORDINATE FUNCTIONS
   ========================================================================== */

function arcX(t) {
  return ARC_PADX + ((t - ARC_MINT) / (ARC_MAXT - ARC_MINT)) * (ARC_W - 2 * ARC_PADX);
}

function arcY(t) {
  const frac = (t - ARC_MINT) / (ARC_MAXT - ARC_MINT);
  return ARC_BOTTOM - Math.sin(Math.max(0, Math.min(1, frac)) * Math.PI) * (ARC_BOTTOM - ARC_TOP) * arcCurveFactor;
}

function dotTransform(cx, cy, scale) {
  return `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
}

/* ==========================================================================
   DOT LABEL LAYOUT SYSTEM
   Dots are always pinned exactly on the arc. Only labels are staggered
   when markers are too close together to avoid text collisions.
   ========================================================================== */

const LABEL_COLLISION_PX = 16;
const LABEL_RUNG_STEP    = 13;
const ARC_LABEL_MARGIN   = 26;

function clusterMarkersByProximity(markersSortedByTime) {
  const clusters = [];
  let cluster = [];
  markersSortedByTime.forEach(m => {
    const prev = cluster[cluster.length - 1];
    if (prev && (m.cx - prev.cx) < LABEL_COLLISION_PX) {
      cluster.push(m);
    } else {
      if (cluster.length) clusters.push(cluster);
      cluster = [m];
    }
  });
  if (cluster.length) clusters.push(cluster);
  return clusters;
}

function layoutClusterLabels(cluster) {
  cluster.forEach((m, i) => {
    if (i === 0) {
      m.labelRung = 0;
    } else {
      m.labelRung = Math.ceil(i / 2);
      m.above = (i % 2 === 1);
    }
  });
}

function clampLabelAnchor(cx) {
  if (cx < ARC_LABEL_MARGIN)          return { anchor: 'start', dx: 4 };
  if (cx > ARC_W - ARC_LABEL_MARGIN)  return { anchor: 'end',   dx: -4 };
  return { anchor: 'middle', dx: 0 };
}

function layoutArcMarkers(markers) {
  markers.forEach(m => { m.cy = arcY(m.t); m.labelRung = 0; });
  const sortedByTime = markers.slice().sort((a, b) => a.t - b.t);
  clusterMarkersByProximity(sortedByTime).forEach(layoutClusterLabels);
}

/* ==========================================================================
   ARC RANGE
   ========================================================================== */

/**
 * Recalculate ARC_MINT / ARC_MAXT to cover wake→sleep plus any prayer
 * times that fall outside that window (e.g. early Fajr).
 */
function recalcArcRange() {
  let minT = appState.settings.wakeMin;
  let maxT = appState.settings.sleepMin;
  if (prayerTimesToday) {
    PRAYER_NAMES.forEach(name => {
      const t = parsePrayerTimeToMin(prayerTimesToday[name]);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    });
  }
  ARC_MINT = minT;
  ARC_MAXT = maxT;
}

function arcNowMinutes() {
  return window.ArcSchedule && typeof window.ArcSchedule.getNowMinutes === 'function'
    ? window.ArcSchedule.getNowMinutes()
    : nowMinutes();
}

/* ==========================================================================
   ARC PATH & SHAPE UPDATE
   ========================================================================== */

function computeArcPathD() {
  let d = `M ${arcX(ARC_MINT)} ${arcY(ARC_MINT)} `;
  for (let t = ARC_MINT; t < ARC_MAXT; t += 10) {
    d += `L ${arcX(t)} ${arcY(t)} `;
  }
  d += `L ${arcX(ARC_MAXT)} ${arcY(ARC_MAXT)} `;
  return d;
}

/**
 * Recompute path + every dot position/scale in place without rebuilding
 * innerHTML — used continuously while zoom animates for smooth interpolation.
 */
function updateArcShape(scale) {
  const svg = document.getElementById('arcSvg');
  if (!svg) return;

  const path = svg.querySelector('#arcPath');
  if (path) path.setAttribute('d', computeArcPathD());

  svg.querySelectorAll('.arc-scale-dot').forEach(g => {
    const t     = parseFloat(g.dataset.t);
    const above = g.dataset.above === '1';
    const rung  = parseFloat(g.dataset.rung || '0');
    const cx = arcX(t), cy = arcY(t);
    g.dataset.cx = cx; g.dataset.cy = cy;
    g.setAttribute('transform', dotTransform(cx, cy, scale));

    const circle = g.querySelector('circle');
    if (circle) { circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); }

    const rect = g.querySelector('rect');
    if (rect) {
      rect.setAttribute('x', cx - 4);
      rect.setAttribute('y', cy - 4);
      rect.setAttribute('transform', `rotate(45 ${cx} ${cy})`);
    }

    const labelDist = (above ? -16 : 24) + (above ? -rung * 13 : rung * 13);
    const text = g.querySelector('text');
    if (text) {
      const la = clampLabelAnchor(cx);
      text.setAttribute('x', cx + la.dx);
      text.setAttribute('y', cy + labelDist);
      text.setAttribute('text-anchor', la.anchor);
    }

    const leader = g.querySelector('.arc-label-leader');
    if (leader) {
      if (rung > 0) {
        leader.setAttribute('x1', cx); leader.setAttribute('y1', cy + (above ? -6 : 6));
        leader.setAttribute('x2', cx); leader.setAttribute('y2', cy + labelDist + (above ? 4 : -9));
        leader.style.display = '';
      } else {
        leader.style.display = 'none';
      }
    }
  });

  const marker = document.getElementById('nowMarker');
  if (marker && marker.style.display !== 'none') {
    const t = arcNowMinutes();
    if (t >= ARC_MINT && t <= ARC_MAXT) {
      const ms = nowMarkerScaleFor(arcZoomDisp);
      marker.setAttribute('transform', `translate(${arcX(t)}, ${arcY(t)}) scale(${ms})`);
    }
  }
}

/* ==========================================================================
   VIEWBOX / ANIMATION
   ========================================================================== */

function clampArcPan() {
  const vw = ARC_W / arcZoom, vh = ARC_H / arcZoom;
  arcPanX = Math.max(0, Math.min(ARC_W - vw, arcPanX));
  arcPanY = Math.max(0, Math.min(ARC_H - vh, arcPanY));
}

function renderArcViewBox() {
  const svg = document.getElementById('arcSvg');
  if (!svg) return;
  arcCurveFactor = computeCurveFactor(arcZoomDisp);
  const vw = ARC_W / arcZoomDisp, vh = ARC_H / arcZoomDisp;
  svg.setAttribute('viewBox', `${arcPanXDisp} ${arcPanYDisp} ${vw} ${vh}`);
  updateArcShape(dotScaleFor(arcZoomDisp));
}

function stopArcAnim() {
  if (arcAnimRAF !== null) { cancelAnimationFrame(arcAnimRAF); arcAnimRAF = null; }
}

function stepArcAnim() {
  const dz = arcZoom - arcZoomDisp;
  const dx = arcPanX - arcPanXDisp;
  const dy = arcPanY - arcPanYDisp;
  if (Math.abs(dz) < 0.0015 && Math.abs(dx) < 0.04 && Math.abs(dy) < 0.04) {
    arcZoomDisp = arcZoom; arcPanXDisp = arcPanX; arcPanYDisp = arcPanY;
    renderArcViewBox();
    arcAnimRAF = null;
    return;
  }
  arcZoomDisp += dz * 0.22;
  arcPanXDisp += dx * 0.22;
  arcPanYDisp += dy * 0.22;
  renderArcViewBox();
  arcAnimRAF = requestAnimationFrame(stepArcAnim);
}

/** Instant sync — used for full re-renders, resize, and live drag/pinch. */
function applyArcViewBox() {
  clampArcPan();
  stopArcAnim();
  arcZoomDisp = arcZoom; arcPanXDisp = arcPanX; arcPanYDisp = arcPanY;
  renderArcViewBox();
}

/** Smooth eased transition — used for wheel, pinch, and zoom buttons. */
function animateArcViewBox() {
  clampArcPan();
  if (arcAnimRAF === null) arcAnimRAF = requestAnimationFrame(stepArcAnim);
}

function setArcZoomAtPoint(newZoom, fracX, fracY) {
  newZoom = Math.max(ARC_MIN_ZOOM, Math.min(ARC_MAX_ZOOM, newZoom));
  const oldVw = ARC_W / arcZoom, oldVh = ARC_H / arcZoom;
  const svgX  = arcPanX + fracX * oldVw;
  const svgY  = arcPanY + fracY * oldVh;
  arcZoom = newZoom;
  const newVw = ARC_W / arcZoom, newVh = ARC_H / arcZoom;
  arcPanX = svgX - fracX * newVw;
  arcPanY = svgY - fracY * newVh;
  animateArcViewBox();
}

function resetArcZoom() {
  arcZoom = 1; arcPanX = 0; arcPanY = 0;
  animateArcViewBox();
}

/* ==========================================================================
   ZOOM / PAN INPUT HANDLERS
   ========================================================================== */

function initArcZoomHandlers() {
  const wrap = document.getElementById('arcSvgWrap');
  if (!wrap) return;

  function pointFrac(clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height)),
    };
  }

  // Mouse wheel zoom
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const frac   = pointFrac(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * 0.0015);
    setArcZoomAtPoint(arcZoom * factor, frac.x, frac.y);
  }, { passive: false });

  // Mouse drag pan
  let dragging = false, dragStart = null;
  wrap.addEventListener('mousedown', e => {
    if (arcZoom <= 1) return;
    dragging  = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: arcPanX, panY: arcPanY };
    wrap.classList.add('grabbing');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const vw = ARC_W / arcZoom, vh = ARC_H / arcZoom;
    arcPanX = dragStart.panX - (e.clientX - dragStart.x) / rect.width  * vw;
    arcPanY = dragStart.panY - (e.clientY - dragStart.y) / rect.height * vh;
    applyArcViewBox();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    wrap.classList.remove('grabbing');
  });

  // Touch pinch-zoom and pan
  let touchState = null;
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches;
      touchState = {
        mode: 'pinch',
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        zoomAtStart: arcZoom,
        frac: pointFrac((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2),
      };
    } else if (e.touches.length === 1 && arcZoom > 1) {
      touchState = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, panX: arcPanX, panY: arcPanY };
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (!touchState) return;
    if (touchState.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      setArcZoomAtPoint(touchState.zoomAtStart * (dist / touchState.dist), touchState.frac.x, touchState.frac.y);
    } else if (touchState.mode === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const vw = ARC_W / arcZoom, vh = ARC_H / arcZoom;
      arcPanX = touchState.panX - (e.touches[0].clientX - touchState.x) / rect.width  * vw;
      arcPanY = touchState.panY - (e.touches[0].clientY - touchState.y) / rect.height * vh;
      applyArcViewBox();
    }
  }, { passive: false });

  wrap.addEventListener('touchend', () => { touchState = null; });

  // Zoom buttons
  const inBtn    = document.getElementById('arcZoomInBtn');
  const outBtn   = document.getElementById('arcZoomOutBtn');
  const resetBtn = document.getElementById('arcZoomResetBtn');
  if (inBtn)    inBtn.addEventListener('click',    () => setArcZoomAtPoint(arcZoom * 1.4, 0.5, 0.5));
  if (outBtn)   outBtn.addEventListener('click',   () => setArcZoomAtPoint(arcZoom / 1.4, 0.5, 0.5));
  if (resetBtn) resetBtn.addEventListener('click', resetArcZoom);
}

/* ==========================================================================
   RENDER ARC
   ========================================================================== */

function renderArc() {
  recalcArcRange();
  arcCurveFactor = computeCurveFactor(arcZoomDisp);
  const svg = document.getElementById('arcSvg');
  const dotScale = dotScaleFor(arcZoomDisp);

  let svgHtml = `<path id="arcPath" d="${computeArcPathD()}" fill="none" stroke="var(--line)" stroke-width="2"/>`;

  // Build full marker list (events + prayers) so overlap resolution
  // considers every dot together.
  const markers = [];
  TIMELINE.forEach((ev, i) => {
    const t = effectiveT(ev.t, appState.settings);
    markers.push({ kind: 'event', idx: i, t, above: (i % 2 === 0), cx: arcX(t) });
  });
  if (prayerTimesToday) {
    PRAYER_NAMES.forEach((name, i) => {
      const t = parsePrayerTimeToMin(prayerTimesToday[name]);
      markers.push({ kind: 'prayer', name, t, above: (i % 2 !== 0), cx: arcX(t) });
    });
  }
  layoutArcMarkers(markers);

  markers.forEach(m => {
    const cx = m.cx, cy = m.cy;
    const rung = m.labelRung || 0;
    const labelDist = (m.above ? -16 : 24) + (m.above ? -rung * 13 : rung * 13);
    const labelY = cy + labelDist;
    const la = clampLabelAnchor(cx);
    const leaderSvg = rung > 0
      ? `<line class="arc-label-leader" x1="${cx}" y1="${cy + (m.above ? -6 : 6)}" x2="${cx}" y2="${cy + labelDist + (m.above ? 4 : -9)}"/>`
      : `<line class="arc-label-leader" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy}" style="display:none;"/>`;

    if (m.kind === 'event') {
      const i = m.idx;
      svgHtml += `<g class="arc-dot arc-scale-dot" data-idx="${i}" data-t="${m.t}" data-rung="${rung}" data-above="${m.above ? 1 : 0}" data-cx="${cx}" data-cy="${cy}" transform="${dotTransform(cx, cy, dotScale)}">
        ${leaderSvg}
        <circle cx="${cx}" cy="${cy}" r="5" fill="${i === 0 || i === TIMELINE.length - 1 ? 'var(--rust)' : 'var(--amber)'}"/>
        <text class="arc-label" x="${cx + la.dx}" y="${labelY}" text-anchor="${la.anchor}">${minToLabel12(m.t).split(' ')[0]}</text>
      </g>`;
    } else {
      svgHtml += `<g class="arc-prayer-dot arc-scale-dot" data-name="${m.name}" data-t="${m.t}" data-rung="${rung}" data-above="${m.above ? 1 : 0}" data-cx="${cx}" data-cy="${cy}" transform="${dotTransform(cx, cy, dotScale)}">
        <rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="2" transform="rotate(45 ${cx} ${cy})" fill="var(--plum)"/>
      </g>`;
    }
  });

  svgHtml += `<g id="nowMarker" style="display:none;">
    <line class="now-guide" x1="0" y1="0" x2="0" y2="${ARC_BOTTOM + 40}"/>
    <circle class="now-ring" r="11"/>
    <circle class="now-halo" r="11"/>
    <circle class="now-dot"/>
    <rect id="nowChipBg" class="now-chip-bg" x="-30" y="-33" width="60" height="19" rx="9.5"/>
    <text id="nowChipText" class="now-chip-text" x="0" y="-23.5" text-anchor="middle" dominant-baseline="central">NOW</text>
  </g>`;

  svg.innerHTML = svgHtml;
  applyArcViewBox();

  // Attach dot click handlers
  svg.querySelectorAll('.arc-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      scrollToRowThenPop(document.getElementById('tl-' + dot.dataset.idx));
    });
  });
  svg.querySelectorAll('.arc-prayer-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      scrollToRowThenPop(document.getElementById('tl-prayer-' + dot.dataset.name));
    });
  });

  document.getElementById('arcDesc').textContent =
    `Wake at ${minToLabel12(appState.settings.wakeMin)}, lights out at ${minToLabel12(appState.settings.sleepMin)} — every checkpoint in between, mapped across the day.`;
}

/* ==========================================================================
   NOW MARKER
   ========================================================================== */

function updateNowMarker() {
  const marker  = document.getElementById('nowMarker');
  const readout = document.getElementById('nowReadout');
  const status  = document.getElementById('nowStatusReadout');
  if (readout) readout.textContent = minToLabel12(arcNowMinutes());
  if (!marker) return;

  const t = arcNowMinutes();
  if (t < ARC_MINT || t > ARC_MAXT) {
    marker.style.display = 'none';
    if (status) status.textContent = t < ARC_MINT ? '(before wake-up)' : '(after lights out)';
  } else {
    marker.style.display = '';
    const ms = nowMarkerScaleFor(arcZoomDisp);
    marker.setAttribute('transform', `translate(${arcX(t)}, ${arcY(t)}) scale(${ms})`);
    const chipText = document.getElementById('nowChipText');
    if (chipText) chipText.textContent = minToLabel12(t);
    if (status) status.textContent = '';
  }
}

/* ==========================================================================
   POP ANIMATION SYSTEM
   The emphasis overlay is a fixed-position element appended to document.body
   (a "portal"), sized and positioned over the target row via
   getBoundingClientRect. This prevents clipping by any ancestor's overflow,
   border-radius, or stacking context.
   ========================================================================== */

let arcPopPortal    = null;
let arcPopFollowRAF = null;

function ensureArcPopPortal() {
  if (arcPopPortal && document.body.contains(arcPopPortal)) return arcPopPortal;
  arcPopPortal = document.createElement('div');
  arcPopPortal.id = 'arcPopPortal';
  document.body.appendChild(arcPopPortal);
  return arcPopPortal;
}

const ARC_POP_PAD = 16;

function positionPopOverlay(overlay, row) {
  const rect = row.getBoundingClientRect();
  overlay.style.left   = (rect.left   - ARC_POP_PAD) + 'px';
  overlay.style.top    = (rect.top    - ARC_POP_PAD) + 'px';
  overlay.style.width  = (rect.width  + ARC_POP_PAD * 2) + 'px';
  overlay.style.height = (rect.height + ARC_POP_PAD * 2) + 'px';
}

function popRow(row) {
  if (!row) return;
  if (arcPopFollowRAF) { cancelAnimationFrame(arcPopFollowRAF); arcPopFollowRAF = null; }

  const portal = ensureArcPopPortal();
  portal.innerHTML = '';

  row.classList.remove('pop-lit');
  void row.offsetWidth; // force reflow so repeated highlights restart cleanly
  row.classList.add('pop-lit');

  const overlay = document.createElement('div');
  overlay.className = 'arc-pop-overlay';
  const rowRadius = parseFloat(getComputedStyle(row).borderRadius) || 0;
  overlay.style.setProperty('--pop-radius', (rowRadius > 0 ? rowRadius : 22) + 'px');
  positionPopOverlay(overlay, row);
  portal.appendChild(overlay);

  function follow() {
    positionPopOverlay(overlay, row);
    if (overlay.isConnected) arcPopFollowRAF = requestAnimationFrame(follow);
  }
  arcPopFollowRAF = requestAnimationFrame(follow);

  requestAnimationFrame(() => overlay.classList.add('pop-in'));

  overlay.addEventListener('animationend', function onPopIn(e) {
    if (e.animationName !== 'arcPopIn') return;
    overlay.removeEventListener('animationend', onPopIn);
    overlay.classList.remove('pop-in');
    overlay.classList.add('pop-fade');
    overlay.addEventListener('animationend', function onFade(e2) {
      if (e2.animationName !== 'arcPopFade') return;
      if (arcPopFollowRAF) { cancelAnimationFrame(arcPopFollowRAF); arcPopFollowRAF = null; }
      overlay.remove();
      row.classList.remove('pop-lit');
    }, { once: true });
  }, { once: true });
}

function getScrollParent(el) {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/**
 * Scroll a timeline row into view, wait for scrolling to settle,
 * then trigger the pop animation.
 */
function scrollToRowThenPop(row) {
  if (!row) return;
  const scrollParent = getScrollParent(row);
  const target = (scrollParent === document.scrollingElement || scrollParent === document.documentElement)
    ? window : scrollParent;

  let settleTimer  = null;
  let fallbackTimer = null;
  let popped = false;

  function finish() {
    if (popped) return;
    popped = true;
    target.removeEventListener('scroll', onScroll);
    clearTimeout(settleTimer);
    clearTimeout(fallbackTimer);
    popRow(row);
  }

  function onScroll() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(finish, 120);
  }

  target.addEventListener('scroll', onScroll, { passive: true });
  fallbackTimer = setTimeout(finish, 700);
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
