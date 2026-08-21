/**
 * schedule.js
 * Pass 2B — editable Today schedule.
 *
 * Loaded after render.js and before main.js. It layers a persistent schedule
 * model over the original static TIMELINE without changing the Today layout.
 * Timeline, Arc, NEXT state, Done status, and schedule-aware Daily Brief text
 * all read from the same event source.
 */

(function initEditableSchedule() {
  // Keep the immutable ID snapshot inside its date bucket so the existing
  // whole-bucket retention wrapper applies without any ARC-16 changes.
  const TIMELINE_HISTORY_KEY = '__history';
  const DEFAULT_EVENT_IDS = [
    'wake',
    'pre-workout-fuel',
    'gym',
    'breakfast-recovery',
    'mid-morning-snack',
    'lunch',
    'afternoon-snack',
    'dinner',
    'wind-down',
    'sleep',
  ];

  function clampScheduleTime(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(2879, Math.round(n)));
  }

  function makeScheduleId(title) {
    const base = String(title || 'event')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 36) || 'event';
    return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function safeScheduleId(value, fallbackTitle) {
    const cleaned = String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 64);
    return cleaned || makeScheduleId(fallbackTitle);
  }

  function defaultScheduleEvents() {
    return TIMELINE.map((ev, i) => ({
      id: DEFAULT_EVENT_IDS[i] || `base-event-${i}`,
      t: ev.t,
      timeMode: 'scaled',
      title: ev.title,
      body: ev.body,
      why: ev.why || '',
    }));
  }

  function uniqueEventIds(ids) {
    return [...new Set((Array.isArray(ids) ? ids : [])
      .map(id => String(id || '').trim())
      .filter(id => id && id !== TIMELINE_HISTORY_KEY))]
      .sort((a, b) => a.localeCompare(b));
  }

  function timelineStatusBucket(dateKey_, create = false) {
    if (!appState.timelineStatus || typeof appState.timelineStatus !== 'object' || Array.isArray(appState.timelineStatus)) {
      appState.timelineStatus = {};
    }
    const existing = appState.timelineStatus[dateKey_];
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) return existing;
    if (!create) return null;
    appState.timelineStatus[dateKey_] = {};
    return appState.timelineStatus[dateKey_];
  }

  function statusEventIds(bucket) {
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) return [];
    return uniqueEventIds(Object.keys(bucket).filter(eventId => eventId !== TIMELINE_HISTORY_KEY));
  }

  function storedHistoryEventIds(bucket) {
    if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, TIMELINE_HISTORY_KEY)) return null;
    const meta = bucket[TIMELINE_HISTORY_KEY];
    return meta && Array.isArray(meta.eventIds) ? uniqueEventIds(meta.eventIds) : null;
  }

  function currentScheduleEventIds() {
    return uniqueEventIds(getScheduleEvents().map(event => event.id));
  }

  function normalizeTimelineHistory() {
    Object.keys(appState.timelineStatus || {}).forEach(dateKey_ => {
      const bucket = timelineStatusBucket(dateKey_);
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, TIMELINE_HISTORY_KEY)) return;
      const eventIds = storedHistoryEventIds(bucket);
      if (eventIds === null) {
        delete bucket[TIMELINE_HISTORY_KEY];
        return;
      }
      bucket[TIMELINE_HISTORY_KEY] = { eventIds };
    });
  }

  function timelineHistoryForDate(dateKey_) {
    const bucket = timelineStatusBucket(dateKey_);
    const historicalEventIds = storedHistoryEventIds(bucket);
    if (historicalEventIds !== null) {
      return { tracked: true, eventIds: historicalEventIds, source: 'snapshot' };
    }

    const legacyEventIds = statusEventIds(bucket);
    if (legacyEventIds.length) {
      // Legacy ARC.05 buckets prove only the IDs that have stored statuses;
      // do not invent missing historical expectations from today's schedule.
      return { tracked: true, eventIds: legacyEventIds, source: 'legacy-status' };
    }

    return { tracked: false, eventIds: currentScheduleEventIds(), source: 'current-schedule' };
  }

  function ensureTimelineHistorySnapshot(dateKey_, eventId) {
    const bucket = timelineStatusBucket(dateKey_, true);
    if (storedHistoryEventIds(bucket) !== null) return false;

    const legacyEventIds = statusEventIds(bucket);
    const eventIds = legacyEventIds.length ? legacyEventIds : currentScheduleEventIds();
    if (legacyEventIds.length && eventId) eventIds.push(eventId);
    bucket[TIMELINE_HISTORY_KEY] = { eventIds: uniqueEventIds(eventIds) };
    return true;
  }

  function normalizeScheduleEvents(events) {
    const source = Array.isArray(events) && events.length ? events : defaultScheduleEvents();
    const seen = new Set();

    return source.map((ev, i) => {
      const fallback = TIMELINE[i] || {};
      let id = safeScheduleId(ev && ev.id, (ev && ev.title) || fallback.title || `event-${i + 1}`);
      while (seen.has(id)) id = makeScheduleId((ev && ev.title) || fallback.title || 'event');
      seen.add(id);

      const hasExplicitMode = ev && (ev.timeMode === 'fixed' || ev.timeMode === 'scaled');
      const defaultId = DEFAULT_EVENT_IDS[i];
      const isLegacyDefault = !hasExplicitMode && (!ev || !ev.id) && !!defaultId;

      return {
        id,
        t: clampScheduleTime(ev && Number.isFinite(Number(ev.t)) ? ev.t : (fallback.t || 0)),
        timeMode: hasExplicitMode ? ev.timeMode : (isLegacyDefault ? 'scaled' : 'fixed'),
        title: String((ev && ev.title) || fallback.title || 'Untitled Event').slice(0, 80),
        body: String((ev && ev.body) || fallback.body || '').slice(0, 500),
        why: String((ev && ev.why) || fallback.why || '').slice(0, 400),
      };
    });
  }

  function migrateTimelineStatusToIds() {
    if (!appState.timelineStatus || typeof appState.timelineStatus !== 'object' || Array.isArray(appState.timelineStatus)) {
      appState.timelineStatus = {};
      return;
    }

    Object.keys(appState.timelineStatus).forEach(dateKey_ => {
      const oldBucket = appState.timelineStatus[dateKey_] || {};
      const nextBucket = {};

      Object.keys(oldBucket).forEach(rawKey => {
        if (rawKey === TIMELINE_HISTORY_KEY) {
          nextBucket[rawKey] = oldBucket[rawKey];
          return;
        }
        let eventId = rawKey;
        if (/^\d+$/.test(rawKey)) {
          const legacyIndex = parseInt(rawKey, 10);
          eventId = DEFAULT_EVENT_IDS[legacyIndex] || rawKey;
        }
        nextBucket[eventId] = oldBucket[rawKey];
      });

      appState.timelineStatus[dateKey_] = nextBucket;
    });
  }

  function ensureScheduleState() {
    appState.timelineEvents = normalizeScheduleEvents(appState.timelineEvents);
    migrateTimelineStatusToIds();
    normalizeTimelineHistory();
  }

  const baseLoadState = loadState;
  loadState = function loadStateWithSchedule() {
    baseLoadState();
    ensureScheduleState();
    saveState();
  };

  function getScheduleEvents() {
    if (!Array.isArray(appState.timelineEvents)) ensureScheduleState();
    return appState.timelineEvents;
  }

  function getScheduleEventById(id) {
    return getScheduleEvents().find(ev => ev.id === id) || null;
  }

  function scheduleEventTime(ev) {
    if (!ev) return Infinity;
    return ev.timeMode === 'fixed'
      ? clampScheduleTime(ev.t)
      : effectiveT(ev.t, appState.settings);
  }

  function getScheduleEventsChronological() {
    return getScheduleEvents()
      .map((ev, order) => ({ ev, order, time: scheduleEventTime(ev) }))
      .sort((a, b) => (a.time - b.time) || (a.order - b.order));
  }

  function getNextScheduleEvent() {
    const now = nowMinutes();
    const next = getScheduleEventsChronological().find(item => item.time > now);
    return next || null;
  }

  function resetScheduleToDefaults() {
    appState.timelineEvents = defaultScheduleEvents();
    saveState();
    render();
  }

  function moveScheduleEvent(eventId, direction) {
    const events = getScheduleEvents();
    const index = events.findIndex(ev => ev.id === eventId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= events.length) return false;
    [events[index], events[target]] = [events[target], events[index]];
    saveState();
    return true;
  }

  function openScheduleEventForm(eventId) {
    const existing = eventId ? getScheduleEventById(eventId) : null;
    const isEdit = !!existing;
    const events = getScheduleEvents();
    const index = existing ? events.findIndex(ev => ev.id === existing.id) : -1;
    const defaultTime = existing
      ? scheduleEventTime(existing)
      : Math.ceil(nowMinutes() / 15) * 15;

    openModal(`
      <button class="modal-close" id="modalClose">&times;</button>
      <h3>${isEdit ? 'Edit Timeline Event' : 'Add Timeline Event'}</h3>
      <p class="view-desc modal-desc">${isEdit
        ? 'Changes update the Timeline, Daily Arc, NEXT state, and Daily Brief references immediately.'
        : 'The new event will appear on the Timeline and Daily Arc and will be saved on this device.'}</p>
      <form id="scheduleEventForm">
        <div class="form-grid">
          <div class="field span2">
            <label for="scheduleTitle">Event name</label>
            <input type="text" id="scheduleTitle" maxlength="80" required value="${isEdit ? escapeHtml(existing.title) : ''}"/>
          </div>
          <div class="field">
            <label for="scheduleTime">Time</label>
            <input type="time" id="scheduleTime" required value="${minToHHMM(defaultTime)}"/>
            <span class="hint">Editing a time makes this event fixed at that clock time.</span>
          </div>
          <div class="field span2">
            <label for="scheduleBody">Details</label>
            <textarea id="scheduleBody" maxlength="500" placeholder="What happens at this checkpoint?">${isEdit ? escapeHtml(existing.body) : ''}</textarea>
          </div>
          <div class="field span2">
            <label for="scheduleWhy">Why / note</label>
            <textarea id="scheduleWhy" maxlength="400" placeholder="Optional context or reason">${isEdit ? escapeHtml(existing.why) : ''}</textarea>
          </div>
        </div>

        ${isEdit ? `
          <div class="schedule-order-controls" aria-label="Timeline order">
            <span>Timeline order</span>
            <button type="button" class="btn btn-ghost btn-sm" id="scheduleMoveUp" ${index <= 0 ? 'disabled' : ''}>Move up</button>
            <button type="button" class="btn btn-ghost btn-sm" id="scheduleMoveDown" ${index >= events.length - 1 ? 'disabled' : ''}>Move down</button>
          </div>` : ''}

        <div class="form-actions ${isEdit ? 'form-actions-between' : ''}">
          ${isEdit ? '<button type="button" class="btn btn-ghost btn-destructive" id="scheduleDelete">Delete Event</button>' : '<span></span>'}
          <span class="btn-group">
            <button type="button" class="btn btn-ghost" id="scheduleCancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Event'}</button>
          </span>
        </div>
      </form>
    `);

    const timeInput = document.getElementById('scheduleTime');
    mountTimePicker(timeInput);

    document.getElementById('scheduleCancel').addEventListener('click', closeModal);

    const moveUp = document.getElementById('scheduleMoveUp');
    if (moveUp) moveUp.addEventListener('click', () => {
      if (moveScheduleEvent(existing.id, -1)) {
        closeModal();
        render();
      }
    });

    const moveDown = document.getElementById('scheduleMoveDown');
    if (moveDown) moveDown.addEventListener('click', () => {
      if (moveScheduleEvent(existing.id, 1)) {
        closeModal();
        render();
      }
    });

    const deleteBtn = document.getElementById('scheduleDelete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      const ok = confirm(`Delete "${existing.title}" from your daily timeline?`);
      if (!ok) return;
      appState.timelineEvents = getScheduleEvents().filter(ev => ev.id !== existing.id);
      saveState();
      closeModal();
      render();
    });

    document.getElementById('scheduleEventForm').addEventListener('submit', e => {
      e.preventDefault();
      const title = document.getElementById('scheduleTitle').value.trim();
      const timeValue = document.getElementById('scheduleTime').value;
      const body = document.getElementById('scheduleBody').value.trim();
      const why = document.getElementById('scheduleWhy').value.trim();
      if (!title || !timeValue) return;

      const nextFields = {
        t: hhmmToMin(timeValue),
        timeMode: 'fixed',
        title: title.slice(0, 80),
        body: body.slice(0, 500),
        why: why.slice(0, 400),
      };

      if (isEdit) {
        const target = getScheduleEventById(existing.id);
        if (target) Object.assign(target, nextFields);
      } else {
        getScheduleEvents().push({
          id: makeScheduleId(title),
          ...nextFields,
        });
      }

      saveState();
      closeModal();
      render();
    });
  }

  function mergeScheduleWithPrayers() {
    const items = getScheduleEvents().map((ev, order) => ({
      type: 'event',
      event: ev,
      order,
      time: scheduleEventTime(ev),
    }));

    if (!prayerTimesToday) return items;

    const prayers = PRAYER_NAMES.map(name => ({
      type: 'prayer',
      name,
      time: parsePrayerTimeToMin(prayerTimesToday[name]),
    })).sort((a, b) => a.time - b.time);

    prayers.forEach(prayer => {
      const insertAt = items.findIndex(item => item.type === 'event' && item.time > prayer.time);
      if (insertAt === -1) items.push(prayer);
      else items.splice(insertAt, 0, prayer);
    });

    return items;
  }

  renderTimeline = function renderEditableTimeline() {
    const list = document.getElementById('timelineList');
    if (!list) return;

    const todayStatus = appState.timelineStatus[todayKeyStr()] || {};
    const prayerDone = (appState.prayerStatus && appState.prayerStatus[todayKeyStr()]) || {};
    const scheduleEvents = getScheduleEvents();
    const items = mergeScheduleWithPrayers();

    const toolbar = `
      <div class="schedule-toolbar">
        <div class="schedule-toolbar-copy">
          <span class="schedule-toolbar-title">Daily Timeline</span>
          <span class="schedule-toolbar-meta">${scheduleEvents.length} event${scheduleEvents.length === 1 ? '' : 's'} · editable</span>
        </div>
        <div class="schedule-toolbar-actions">
          <button type="button" class="schedule-reset-btn" id="scheduleResetBtn">Reset</button>
          <button type="button" class="btn btn-primary btn-sm" id="scheduleAddBtn">+ Event</button>
        </div>
      </div>`;

    const rows = items.map(item => {
      if (item.type === 'event') {
        const ev = item.event;
        const status = todayStatus[ev.id];
        return `
          <div class="tl-row ${status ? 'done' : ''}" data-type="event" data-event-id="${escapeHtml(ev.id)}" id="tl-event-${escapeHtml(ev.id)}">
            <div class="tl-time">${minToLabel12(item.time)}</div>
            <div class="schedule-event-copy">
              <p class="tl-title">${escapeHtml(ev.title)}</p>
              ${ev.body ? `<p class="tl-body">${escapeHtml(ev.body)}</p>` : ''}
              ${ev.why ? `<p class="tl-why">${escapeHtml(ev.why)}</p>` : ''}
            </div>
            <div class="schedule-row-actions">
              <button type="button" class="schedule-edit-btn" data-event-id="${escapeHtml(ev.id)}" aria-label="Edit ${escapeHtml(ev.title)}">Edit</button>
              <button class="btn btn-sm ${status ? 'btn-done' : 'btn-ghost'} done-btn schedule-done-btn" data-event-id="${escapeHtml(ev.id)}" title="Click to edit completion">
                ${status ? `&#10003; Done${status.mode === 'custom' ? ' · ' + escapeHtml(status.time) : ''}` : 'Done'}
              </button>
            </div>
          </div>`;
      }

      const pStatus = getPrayerStatus(item.name, prayerDone);
      const isDone = !!pStatus;
      return `
        <div class="tl-row prayer-tl-row ${isDone ? 'done' : ''}" data-type="prayer" data-name="${item.name}" id="tl-prayer-${item.name}">
          <div class="tl-time">${minToLabel12(item.time)}</div>
          <div>
            <p class="tl-title">${item.name} <span class="prayer-tag">Salah</span></p>
          </div>
          <button class="btn btn-sm ${isDone ? 'btn-done' : 'btn-ghost'} done-btn prayer-done-btn-tl" data-name="${item.name}" title="Click to edit">
            ${isDone ? `&#10003; Done${pStatus.mode === 'custom' ? ' · ' + escapeHtml(pStatus.time) : ''}` : 'Done'}
          </button>
        </div>`;
    }).join('');

    list.innerHTML = toolbar + rows;

    document.getElementById('scheduleAddBtn').addEventListener('click', () => openScheduleEventForm(null));
    document.getElementById('scheduleResetBtn').addEventListener('click', () => {
      const ok = confirm('Reset only the Daily Timeline events to their original schedule? Completion history for the original events will be kept.');
      if (ok) resetScheduleToDefaults();
    });

    list.querySelectorAll('.schedule-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openScheduleEventForm(btn.dataset.eventId));
    });
    list.querySelectorAll('.schedule-done-btn').forEach(btn => {
      btn.addEventListener('click', () => openDoneModal(btn.dataset.eventId));
    });
    list.querySelectorAll('.prayer-done-btn-tl').forEach(btn => {
      btn.addEventListener('click', () => openPrayerDoneModal(btn.dataset.name));
    });

    updateNextEventHighlight();
  };

  function resolveEventId(ref) {
    if (typeof ref === 'number' || /^\d+$/.test(String(ref || ''))) {
      const idx = Number(ref);
      return DEFAULT_EVENT_IDS[idx] || String(ref);
    }
    return String(ref || '');
  }

  markTimelineDone = function markScheduleEventDone(eventRef, mode, time) {
    const eventId = resolveEventId(eventRef);
    if (!eventId) return;
    const key = todayKeyStr();
    ensureTimelineHistorySnapshot(key, eventId);
    const bucket = timelineStatusBucket(key, true);
    bucket[eventId] = {
      done: true,
      mode,
      time: time || minToLabel12(nowMinutes()),
    };
    saveState();
    render();
  };

  clearTimelineDone = function clearScheduleEventDone(eventRef) {
    const eventId = resolveEventId(eventRef);
    const key = todayKeyStr();
    const bucket = timelineStatusBucket(key);
    if (bucket && Object.prototype.hasOwnProperty.call(bucket, eventId)) {
      ensureTimelineHistorySnapshot(key, eventId);
      delete bucket[eventId];
    }
    saveState();
    render();
  };

  openDoneModal = function openScheduleDoneModal(eventRef) {
    const eventId = resolveEventId(eventRef);
    const ev = getScheduleEventById(eventId);
    if (!ev) return;

    const key = todayKeyStr();
    const existing = (appState.timelineStatus[key] || {})[eventId];

    openModal(`
      <button class="modal-close" id="modalClose">&times;</button>
      <h3>${escapeHtml(ev.title)}</h3>
      <p class="view-desc modal-desc">${existing
        ? 'Update when you did this — this can be changed anytime.'
        : 'When did you do this?'}</p>
      <div class="form-actions form-actions-start">
        <button class="btn btn-primary" id="doneOnTimeBtn">Done on time</button>
        <button class="btn btn-ghost" id="doneOtherTimeBtn">Done at another time</button>
        ${existing ? '<button class="btn btn-ghost" id="clearDoneBtn">Mark not done</button>' : ''}
      </div>
      <div class="field span2 modal-time-field" id="customTimeField" style="display:${existing && existing.mode === 'custom' ? 'block' : 'none'}">
        <label>Time</label>
        <input type="time" id="doneTimeInput" value="${existing && existing.mode === 'custom' ? to24h(existing.time) : ''}"/>
        <div class="form-actions">
          <button class="btn btn-primary" id="confirmCustomTimeBtn">Confirm</button>
        </div>
      </div>
    `);

    document.getElementById('doneOnTimeBtn').addEventListener('click', () => {
      markTimelineDone(eventId, 'on-time');
      closeModal();
    });
    document.getElementById('doneOtherTimeBtn').addEventListener('click', () => {
      document.getElementById('customTimeField').style.display = 'block';
    });
    document.getElementById('confirmCustomTimeBtn').addEventListener('click', () => {
      const val = document.getElementById('doneTimeInput').value;
      if (!val) return;
      const [h, m] = val.split(':').map(Number);
      markTimelineDone(eventId, 'custom', minToLabel12(h * 60 + m));
      closeModal();
    });
    const clearBtn = document.getElementById('clearDoneBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      clearTimelineDone(eventId);
      closeModal();
    });

    mountTimePicker(document.getElementById('doneTimeInput'));
  };

  updateNextEventHighlight = function updateScheduleNextHighlight() {
    const t = nowMinutes();
    const rows = Array.from(document.querySelectorAll('#timelineList .tl-row'));
    let nextRow = null;
    let nextTime = Infinity;

    rows.forEach(row => {
      let rowTime = Infinity;
      if (row.dataset.type === 'prayer') {
        rowTime = prayerTimesToday ? parsePrayerTimeToMin(prayerTimesToday[row.dataset.name]) : Infinity;
      } else if (row.dataset.type === 'event') {
        rowTime = scheduleEventTime(getScheduleEventById(row.dataset.eventId));
      }
      if (rowTime > t && rowTime < nextTime) {
        nextTime = rowTime;
        nextRow = row;
      }
    });

    rows.forEach(row => {
      const isNext = row === nextRow;
      row.classList.toggle('next-event', isNext);
      const titleEl = row.querySelector('.tl-title');
      if (!titleEl) return;

      if (row.dataset.type === 'prayer') {
        titleEl.innerHTML = isNext
          ? `${row.dataset.name} <span class="prayer-tag">Salah</span> <span class="next-badge">NEXT</span>`
          : `${row.dataset.name} <span class="prayer-tag">Salah</span>`;
      } else {
        const ev = getScheduleEventById(row.dataset.eventId);
        if (!ev) return;
        titleEl.innerHTML = isNext
          ? `${escapeHtml(ev.title)} <span class="next-badge">NEXT</span>`
          : escapeHtml(ev.title);
      }
    });
  };

  recalcArcRange = function recalcEditableArcRange() {
    let minT = appState.settings.wakeMin;
    let maxT = appState.settings.sleepMin;

    getScheduleEvents().forEach(ev => {
      const t = scheduleEventTime(ev);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    });

    if (prayerTimesToday) {
      PRAYER_NAMES.forEach(name => {
        const t = parsePrayerTimeToMin(prayerTimesToday[name]);
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
      });
    }

    ARC_MINT = minT;
    ARC_MAXT = maxT;
  };

  renderArc = function renderEditableArc() {
    recalcArcRange();
    arcCurveFactor = computeCurveFactor(arcZoomDisp);
    const svg = document.getElementById('arcSvg');
    if (!svg) return;
    const dotScale = dotScaleFor(arcZoomDisp);

    let svgHtml = `<path id="arcPath" d="${computeArcPathD()}" fill="none" stroke="var(--line)" stroke-width="2"/>`;

    const markers = [];
    getScheduleEventsChronological().forEach(item => {
      markers.push({
        kind: 'event',
        event: item.ev,
        t: item.time,
        cx: arcX(item.time),
        above: item.order % 2 === 0,
      });
    });

    if (prayerTimesToday) {
      PRAYER_NAMES.forEach((name, i) => {
        const t = parsePrayerTimeToMin(prayerTimesToday[name]);
        markers.push({ kind: 'prayer', name, t, above: i % 2 !== 0, cx: arcX(t) });
      });
    }

    layoutArcMarkers(markers);

    markers.forEach(marker => {
      const cx = marker.cx;
      const cy = marker.cy;
      if (marker.kind === 'event') {
        const ev = marker.event;
        const fill = ev.id === 'wake' || ev.id === 'sleep' ? 'var(--rust)' : 'var(--amber)';
        svgHtml += `<g class="arc-dot arc-scale-dot" data-event-id="${escapeHtml(ev.id)}" data-t="${marker.t}" data-rung="0" data-above="${marker.above ? 1 : 0}" data-cx="${cx}" data-cy="${cy}" transform="${dotTransform(cx, cy, dotScale)}">
          <circle cx="${cx}" cy="${cy}" r="5" fill="${fill}"/>
        </g>`;
      } else {
        svgHtml += `<g class="arc-prayer-dot arc-scale-dot" data-name="${marker.name}" data-t="${marker.t}" data-rung="0" data-above="${marker.above ? 1 : 0}" data-cx="${cx}" data-cy="${cy}" transform="${dotTransform(cx, cy, dotScale)}">
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

    svg.querySelectorAll('.arc-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        scrollToRowThenPop(document.getElementById('tl-event-' + dot.dataset.eventId));
      });
    });
    svg.querySelectorAll('.arc-prayer-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        scrollToRowThenPop(document.getElementById('tl-prayer-' + dot.dataset.name));
      });
    });

    const desc = document.getElementById('arcDesc');
    if (desc) {
      desc.textContent = `Wake at ${minToLabel12(appState.settings.wakeMin)}, lights out at ${minToLabel12(appState.settings.sleepMin)} — ${getScheduleEvents().length} editable checkpoints mapped across the day.`;
    }
  };

  renderTodaySummary = function renderScheduleAwareTodaySummary() {
    const el = document.getElementById('todaySummary');
    if (!el) return;

    const plan = getTodayPlan();
    const lunchEvent = getScheduleEventById('lunch');
    const dinnerEvent = getScheduleEventById('dinner');
    const gymEvent = getScheduleEventById('gym');

    const lunchPrefix = lunchEvent ? `${minToLabel12(scheduleEventTime(lunchEvent))} · ` : '';
    const dinnerPrefix = dinnerEvent ? `${minToLabel12(scheduleEventTime(dinnerEvent))} · ` : '';
    const gymPrefix = gymEvent ? `${minToLabel12(scheduleEventTime(gymEvent))} · ` : '';

    let mealsText = 'No meal block scheduled today';
    if (plan.meals) {
      const lunch = plan.meals.lunch;
      const dinner = plan.meals.dinner;
      mealsText = `Lunch ${lunchPrefix}${lunch ? escapeHtml(lunch.name) : '—'} · Dinner ${dinnerPrefix}${dinner ? escapeHtml(dinner.name) : '—'} <span class="text-accent">(${escapeHtml(String(plan.meals.total))} kcal)</span>`;
    }

    let workoutText = 'No workout set';
    if (plan.workout && plan.workout.exercises && plan.workout.exercises.length) {
      workoutText = `${gymPrefix}${escapeHtml(plan.workout.name)} — ${escapeHtml(plan.workout.sub)}`;
    } else if (plan.workout) {
      workoutText = `${gymPrefix}${escapeHtml(plan.workout.name)} (rest / recovery)`;
    }

    el.innerHTML = `
      <div class="prep-item"><b>Meals</b>${mealsText}</div>
      <div class="prep-item"><b>Workout</b>${workoutText}</div>
      <div class="prep-item"><b>Calories Logged</b>${escapeHtml(String(plan.calorieTotal))} / ${escapeHtml(String(appState.settings.calorieTarget))} kcal</div>
    `;
  };

  window.ArcSchedule = {
    getEvents: () => getScheduleEvents().map(ev => ({ ...ev, effectiveTime: scheduleEventTime(ev) })),
    getNext: () => {
      const item = getNextScheduleEvent();
      return item ? { ...item.ev, effectiveTime: item.time } : null;
    },
  };

  window.ArcTimelineHistory = {
    getDay(dateKey_) {
      const history = timelineHistoryForDate(dateKey_);
      return { ...history, eventIds: [...history.eventIds] };
    },
  };
})();
