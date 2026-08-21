/**
 * state.js
 * Application state: defaults, persistence (localStorage), derived views,
 * recipe accessors, week/gym overrides, change log, and calorie log pruning.
 */

/* ==========================================================================
   DEFAULTS
   ========================================================================== */

const DEFAULT_SETTINGS = {
  calorieTarget: 2200,
  wakeMin: 300,   // 5:00 AM
  sleepMin: 1320, // 10:00 PM
};

const APP_STATE_SCHEMA_VERSION = 1;

const DEFAULT_APPSTATE = {
  schemaVersion: APP_STATE_SCHEMA_VERSION,
  settings: { ...DEFAULT_SETTINGS },

  customRecipes: [],      // user-added recipes
  recipeOverrides: {},    // { [recipeId]: {...edited fields} } — applied over BASE_RECIPES/customRecipes
  deletedRecipes: [],     // ids permanently removed (base or custom)
  archivedRecipes: [],    // ids hidden from pickers/library but not deleted
  recipeShowArchived: false,

  weekOverrides: {},      // { "w{week}-{day}-lunch": recipeId, ... }
  gymOverrides: {},       // { 0: { sub, exercises, cardio }, ... }

  grocery: {},            // grocery checklist state
  calories: {},           // { "YYYY-MM-DD": [{ id, label, kcal }, ...] }
  gymTracker: {},         // weekly cardio/swim/sauna/steam tracker

  currentWeek: 0,         // Meal Plan view state only; browsing must not change Today
  activeMealPlanWeek: 0,  // domain state consumed by Today
  grocWeek: 0,            // selected week on Grocery tab
  gymDay: 0,              // Gym view state only; Today derives workout from the calendar day
  qaWeekIdx: 0,           // Quick Add week selector (Calories tab)
  qaDayIdx: 0,            // Quick Add day selector (Calories tab)

  activeTab: 'today',     // restored on refresh
  theme: 'light',         // 'light' | 'dark'

  timelineStatus: {},     // { "YYYY-MM-DD": { __history: { eventIds: [] }, [eventId]: { done, mode, time } } }
  prayerStatus: {},       // { "YYYY-MM-DD": { Fajr: true, ... } }

  changeLog: { plan: [], calories: [] },
};

/* ==========================================================================
   LIVE STATE
   ========================================================================== */

/** Single mutable application state object. */
let appState = {};

/* ==========================================================================
   STORAGE ADAPTER
   Single boundary between the application and its storage mechanism.
   All reads and writes to persistent storage go through this object.

   To migrate to a backend/API later, replace only the implementations
   of get(), set(), remove(), and keys() here — nothing else in the
   codebase needs to change.
   ========================================================================== */

const Storage = {
  /** Read and parse a value while preserving failure details for callers. */
  read(key) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (error) {
      return { ok: false, error, stage: 'read', found: false, raw: null };
    }

    if (raw === null) return { ok: true, found: false, value: null, raw: null };

    try {
      return { ok: true, found: true, value: JSON.parse(raw), raw };
    } catch (error) {
      return { ok: false, error, stage: 'parse', found: true, raw };
    }
  },

  /** Compatibility value reader used by non-appState caches. */
  get(key) {
    const result = this.read(key);
    return result.ok && result.found ? result.value : null;
  },

  /** JSON-stringify and write a value with an explicit success result. */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  },

  /** Remove a single key with an explicit success result. */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  },

  /** Return all current storage keys as an array. */
  keys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      return [];
    }
  },

  /** Remove all app data and reload. Used by the Reset App action. */
  clearAll() {
    const result = this.remove('appState');
    if (result.ok) location.reload();
    return result;
  },
};

/* ==========================================================================
   PERSISTENCE
   ========================================================================== */

let activePersistenceFailure = null;
let persistenceWriteBlock = null;
let lastStateLoadResult = null;

function syncPersistenceWarning() {
  const warning = document.getElementById('persistenceWarning');
  if (!warning) return;
  warning.hidden = !activePersistenceFailure;
}

function applyPersistenceResult(result) {
  activePersistenceFailure = result && !result.ok ? result : null;
  syncPersistenceWarning();
  return result;
}

/**
 * Persist appState via the Storage adapter.
 * weekPlan is a derived view — never persisted to avoid drift.
 */
function saveState() {
  if (persistenceWriteBlock) {
    return applyPersistenceResult({
      ok: false,
      blocked: true,
      reason: persistenceWriteBlock.reason,
      error: persistenceWriteBlock.error,
    });
  }

  const toSave = { ...appState, schemaVersion: APP_STATE_SCHEMA_VERSION };
  delete toSave.weekPlan;
  return applyPersistenceResult(Storage.set('appState', toSave));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSafeMapKey(key) {
  return key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
}

function safeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeFiniteInteger(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function uniqueStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && item.trim()))];
}

function stringList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function normalizeStringMap(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([key, item]) => {
    if (isSafeMapKey(key) && typeof item === 'string') result[key] = item;
  });
  return result;
}

function normalizeBooleanMap(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([key, item]) => {
    if (isSafeMapKey(key) && typeof item === 'boolean') result[key] = item;
  });
  return result;
}

function normalizeSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const wakeMin = safeFiniteInteger(source.wakeMin, 0, 1439, DEFAULT_SETTINGS.wakeMin);
  let sleepMin = safeFiniteInteger(source.sleepMin, 0, 2879, DEFAULT_SETTINGS.sleepMin);
  if (sleepMin <= wakeMin) sleepMin += 1440;
  return {
    ...source,
    calorieTarget: safeFiniteInteger(source.calorieTarget, 1000, 6000, DEFAULT_SETTINGS.calorieTarget),
    wakeMin,
    sleepMin,
  };
}

function normalizeRecipeRecord(value) {
  if (!isPlainObject(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
  const result = {
    ...value,
    id: value.id,
    name: safeString(value.name, 'Untitled recipe'),
    kcalNum: Number.isFinite(value.kcalNum) && value.kcalNum >= 0 ? value.kcalNum : 0,
    kcalUnit: safeString(value.kcalUnit, 'portion'),
    portions: safeString(value.portions, '\u2014'),
    macros: safeString(value.macros, '\u2014'),
    time: safeString(value.time, '\u2014'),
    cost: safeString(value.cost, '\u2014'),
    ingredients: stringList(value.ingredients),
    steps: stringList(value.steps),
    storage: safeString(value.storage, '\u2014'),
    isCustom: value.isCustom !== false,
  };
  if (typeof value.youtubeLink !== 'string') delete result.youtubeLink;
  return result;
}

const RECIPE_OVERRIDE_STRING_FIELDS = [
  'name', 'kcalUnit', 'portions', 'macros', 'time', 'cost', 'storage', 'youtubeLink',
];

function normalizeRecipeOverride(value) {
  if (!isPlainObject(value)) return null;
  const result = { ...value };
  RECIPE_OVERRIDE_STRING_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(result, field) && typeof result[field] !== 'string') {
      delete result[field];
    }
  });
  if (Object.prototype.hasOwnProperty.call(result, 'kcalNum') &&
      (!Number.isFinite(result.kcalNum) || result.kcalNum < 0)) {
    delete result.kcalNum;
  }
  ['ingredients', 'steps'].forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(result, field)) return;
    if (Array.isArray(result[field])) result[field] = stringList(result[field]);
    else delete result[field];
  });
  return result;
}

function normalizeRecipeOverrides(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([id, override]) => {
    const normalized = normalizeRecipeOverride(override);
    if (isSafeMapKey(id) && normalized) result[id] = normalized;
  });
  return result;
}

function normalizeExerciseList(value) {
  if (!Array.isArray(value)) return null;
  return value
    .filter(item => Array.isArray(item) && typeof item[0] === 'string')
    .map(item => [item[0], safeString(item[1])]);
}

function normalizeGymOverrides(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([key, override]) => {
    const dayIndex = Number(key);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= BASE_GYM_DAYS.length || !isPlainObject(override)) return;
    const normalized = { ...override };
    ['sub', 'cardio'].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(normalized, field) && typeof normalized[field] !== 'string') {
        delete normalized[field];
      }
    });
    if (Object.prototype.hasOwnProperty.call(normalized, 'exercises')) {
      const exercises = normalizeExerciseList(normalized.exercises);
      if (exercises) normalized.exercises = exercises;
      else delete normalized.exercises;
    }
    result[dayIndex] = normalized;
  });
  return result;
}

function normalizeCalories(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([dateKey_, entries]) => {
    if (!isSafeMapKey(dateKey_) || !Array.isArray(entries)) return;
    result[dateKey_] = entries.flatMap((entry, index) => {
      if (!isPlainObject(entry) || typeof entry.label !== 'string' ||
          !Number.isFinite(entry.kcal) || entry.kcal < 0) return [];
      return [{
        ...entry,
        id: typeof entry.id === 'string' && entry.id ? entry.id : `legacy-${dateKey_}-${index}`,
        label: entry.label,
        kcal: entry.kcal,
      }];
    });
  });
  return result;
}

function normalizeTracker(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([weekKey, week]) => {
    if (!isSafeMapKey(weekKey) || !isPlainObject(week)) return;
    const days = {};
    const sourceDays = isPlainObject(week.days) || Array.isArray(week.days) ? week.days : {};
    for (let index = 0; index < BASE_GYM_DAYS.length; index++) {
      const day = sourceDays[index];
      if (!isPlainObject(day)) continue;
      days[index] = { cardio: day.cardio === true, swim: day.swim === true };
    }
    const counter = item => Number.isFinite(item) && item >= 0 ? Math.round(item) : 0;
    result[weekKey] = { ...week, days, sauna: counter(week.sauna), steam: counter(week.steam) };
  });
  return result;
}

function normalizeTimelineEvents(value) {
  if (!Array.isArray(value)) return null;
  return value.flatMap(event => {
    if (!isPlainObject(event) || typeof event.id !== 'string' || !event.id.trim()) return [];
    return [{
      ...event,
      id: event.id,
      t: Number.isFinite(event.t) ? Math.max(0, Math.min(2879, Math.round(event.t))) : 0,
      timeMode: event.timeMode === 'scaled' ? 'scaled' : 'fixed',
      title: safeString(event.title, 'Untitled Event'),
      body: safeString(event.body),
      why: safeString(event.why),
    }];
  });
}

function normalizeStatusRecord(value) {
  if (value === true) return true;
  if (!isPlainObject(value)) return null;
  const result = { ...value };
  if (Object.prototype.hasOwnProperty.call(result, 'done') && typeof result.done !== 'boolean') {
    result.done = true;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'mode') && typeof result.mode !== 'string') {
    delete result.mode;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'time') && typeof result.time !== 'string') {
    delete result.time;
  }
  return result;
}

function normalizeTimelineStatus(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([dateKey_, bucket]) => {
    if (!isSafeMapKey(dateKey_) || !isPlainObject(bucket)) return;
    const normalizedBucket = {};
    Object.entries(bucket).forEach(([eventId, status]) => {
      if (!isSafeMapKey(eventId)) return;
      if (eventId === '__history') {
        if (isPlainObject(status) && Array.isArray(status.eventIds)) {
          normalizedBucket.__history = { eventIds: uniqueStringList(status.eventIds) };
        }
        return;
      }
      const normalizedStatus = normalizeStatusRecord(status);
      if (normalizedStatus !== null) normalizedBucket[eventId] = normalizedStatus;
    });
    result[dateKey_] = normalizedBucket;
  });
  return result;
}

function normalizePrayerStatus(value) {
  const result = {};
  if (!isPlainObject(value)) return result;
  Object.entries(value).forEach(([dateKey_, bucket]) => {
    if (!isSafeMapKey(dateKey_) || !isPlainObject(bucket)) return;
    const normalizedBucket = {};
    Object.entries(bucket).forEach(([name, status]) => {
      const normalizedStatus = normalizeStatusRecord(status);
      if (isSafeMapKey(name) && normalizedStatus !== null) normalizedBucket[name] = normalizedStatus;
    });
    result[dateKey_] = normalizedBucket;
  });
  return result;
}

function normalizeChangeLogSection(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map(entry => ({
    ...entry,
    id: safeString(entry.id),
    text: safeString(entry.text),
    ts: safeString(entry.ts),
    revert: entry.revert === null || isPlainObject(entry.revert) ? entry.revert : null,
  })).slice(0, 30);
}

function normalizeChangeLog(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    ...source,
    plan: normalizeChangeLogSection(source.plan),
    calories: normalizeChangeLogSection(source.calories),
  };
}

function normalizePersistedState(value) {
  const source = isPlainObject(value) ? value : {};
  const currentWeek = normalizeStateIndex(source.currentWeek, BASE_WEEKS.length, 0);
  const normalized = {
    ...source,
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    settings: normalizeSettings(source.settings),
    customRecipes: Array.isArray(source.customRecipes)
      ? source.customRecipes.map(normalizeRecipeRecord).filter(Boolean)
      : [],
    recipeOverrides: normalizeRecipeOverrides(source.recipeOverrides),
    deletedRecipes: uniqueStringList(source.deletedRecipes),
    archivedRecipes: uniqueStringList(source.archivedRecipes),
    recipeShowArchived: source.recipeShowArchived === true,
    weekOverrides: normalizeStringMap(source.weekOverrides),
    gymOverrides: normalizeGymOverrides(source.gymOverrides),
    grocery: normalizeBooleanMap(source.grocery),
    calories: normalizeCalories(source.calories),
    gymTracker: normalizeTracker(source.gymTracker),
    currentWeek,
    activeMealPlanWeek: normalizeStateIndex(
      Object.prototype.hasOwnProperty.call(source, 'activeMealPlanWeek')
        ? source.activeMealPlanWeek
        : source.currentWeek,
      BASE_WEEKS.length,
      currentWeek
    ),
    grocWeek: normalizeStateIndex(source.grocWeek, BASE_WEEKS.length, 0),
    gymDay: normalizeStateIndex(source.gymDay, BASE_GYM_DAYS.length, 0),
    qaWeekIdx: normalizeStateIndex(source.qaWeekIdx, BASE_WEEKS.length, 0),
    qaDayIdx: normalizeStateIndex(source.qaDayIdx, 3, 0),
    activeTab: ['today', 'calories', 'plan', 'recipes', 'grocery', 'progress', 'gym', 'goals']
      .includes(source.activeTab) ? source.activeTab : 'today',
    theme: source.theme === 'dark' ? 'dark' : 'light',
    timelineStatus: normalizeTimelineStatus(source.timelineStatus),
    prayerStatus: normalizePrayerStatus(source.prayerStatus),
    changeLog: normalizeChangeLog(source.changeLog),
  };

  const timelineEvents = normalizeTimelineEvents(source.timelineEvents);
  if (timelineEvents !== null) normalized.timelineEvents = timelineEvents;
  else delete normalized.timelineEvents;
  delete normalized.weekPlan;
  return normalized;
}

function persistedSchemaVersion(value) {
  return isPlainObject(value) && Number.isInteger(value.schemaVersion) && value.schemaVersion >= 0
    ? value.schemaVersion
    : 0;
}

function migrateV0ToV1(value) {
  const source = isPlainObject(value) ? value : {};
  const migrated = { ...source, schemaVersion: 1 };
  if (!Object.prototype.hasOwnProperty.call(source, 'activeMealPlanWeek')) {
    migrated.activeMealPlanWeek = source.currentWeek;
  }
  return migrated;
}

const APP_STATE_MIGRATIONS = {
  0: migrateV0ToV1,
};

function migratePersistedState(value, fromVersion) {
  let version = fromVersion;
  let migrated = isPlainObject(value) ? { ...value } : {};
  while (version < APP_STATE_SCHEMA_VERSION) {
    const migrate = APP_STATE_MIGRATIONS[version];
    if (typeof migrate !== 'function') throw new Error(`Missing appState migration from schema ${version}`);
    migrated = migrate(migrated);
    version++;
  }
  return migrated;
}

/** Normalize one persisted/view index. */
function normalizeStateIndex(value, length, fallback = 0) {
  return Number.isInteger(value) && value >= 0 && value < length ? value : fallback;
}

/** Make one Meal Plan week authoritative for Today without changing view state. */
function activateMealPlanWeek(weekIdx) {
  const nextWeek = normalizeStateIndex(
    weekIdx,
    BASE_WEEKS.length,
    appState.activeMealPlanWeek
  );
  if (nextWeek === appState.activeMealPlanWeek) return false;

  appState.activeMealPlanWeek = nextWeek;
  saveState();
  render();
  return true;
}

/**
 * Load appState through the versioned migration and validation lifecycle.
 */
function loadState() {
  persistenceWriteBlock = null;
  const readResult = Storage.read('appState');
  let source = {};
  let recoveredFromMalformedJson = false;

  if (!readResult.ok && readResult.stage === 'read') {
    persistenceWriteBlock = {
      reason: 'storage-read-failed',
      error: readResult.error,
    };
    appState = normalizePersistedState(DEFAULT_APPSTATE);
    refreshWeekPlan();
    lastStateLoadResult = {
      ok: false,
      recovered: true,
      writeBlocked: true,
      reason: persistenceWriteBlock.reason,
      error: readResult.error,
    };
    return lastStateLoadResult;
  }

  if (!readResult.ok && readResult.stage === 'parse') {
    recoveredFromMalformedJson = true;
  } else if (readResult.ok && readResult.found) {
    source = readResult.value;
  }

  const sourceVersion = persistedSchemaVersion(source);
  if (sourceVersion > APP_STATE_SCHEMA_VERSION) {
    persistenceWriteBlock = {
      reason: 'future-schema',
      error: new Error(`Stored schema ${sourceVersion} is newer than supported schema ${APP_STATE_SCHEMA_VERSION}`),
    };
    appState = normalizePersistedState(DEFAULT_APPSTATE);
    refreshWeekPlan();
    lastStateLoadResult = {
      ok: false,
      recovered: true,
      writeBlocked: true,
      reason: persistenceWriteBlock.reason,
      sourceVersion,
      error: persistenceWriteBlock.error,
    };
    return lastStateLoadResult;
  }

  let migrated;
  try {
    migrated = migratePersistedState(source, sourceVersion);
  } catch (error) {
    migrated = migrateV0ToV1({});
    recoveredFromMalformedJson = true;
  }

  appState = normalizePersistedState(migrated);
  refreshWeekPlan();
  pruneOldCalorieLogs();
  lastStateLoadResult = {
    ok: true,
    found: !!(readResult.ok && readResult.found),
    sourceVersion,
    schemaVersion: APP_STATE_SCHEMA_VERSION,
    migrated: sourceVersion < APP_STATE_SCHEMA_VERSION,
    recoveredFromMalformedJson,
  };
  return lastStateLoadResult;
}

/* ==========================================================================
   DERIVED VIEWS
   ========================================================================== */

/**
 * Recompute appState.weekPlan from BASE_WEEKS + weekOverrides.
 * Called after every state mutation that could affect the meal plan.
 */
function refreshWeekPlan() {
  appState.weekPlan = effectiveWeeks();
}

/** Apply weekOverrides on top of BASE_WEEKS. */
function effectiveWeeks() {
  return BASE_WEEKS.map((w, wi) => ({
    title: w.title,
    days: w.days.map((d, di) => ({
      label:  d.label,
      lunch:  appState.weekOverrides[`w${wi}-${di}-lunch`]  || d.lunch,
      dinner: appState.weekOverrides[`w${wi}-${di}-dinner`] || d.dinner,
    }))
  }));
}

/** Apply gymOverrides on top of BASE_GYM_DAYS. */
function effectiveGymDays() {
  return BASE_GYM_DAYS.map((d, i) =>
    appState.gymOverrides[i] ? { ...d, ...appState.gymOverrides[i] } : d
  );
}

/**
 * Map a calendar date onto the existing Monday-Sunday seven-day gym cycle.
 * This mirrors the weekly recovery tracker's Monday-based day indexing.
 */
function gymDayIndexForDate(date) {
  return (date.getDay() + 6) % 7;
}

/** Return the workout assigned to a calendar date, independent of Gym browsing. */
function getWorkoutForDate(date) {
  return effectiveGymDays()[gymDayIndexForDate(date)] || null;
}

/**
 * Compute calorie totals for a single day block.
 * @param {{ lunch: string, dinner: string }} day
 */
function dayTotals(day) {
  const lunch  = getRecipe(day.lunch);
  const dinner = getRecipe(day.dinner);
  const lunchK  = lunch  ? lunch.kcalNum  : 0;
  const dinnerK = dinner ? dinner.kcalNum : 0;
  const total   = BREAKFAST_KCAL + lunchK + dinnerK;
  const snack   = Math.max(0, appState.settings.calorieTarget - total);
  return { lunch, dinner, lunchK, dinnerK, total, snack };
}

/* ==========================================================================
   RECIPE ACCESSORS
   ========================================================================== */

/** All recipes (base + custom), with overrides applied, excluding deleted. */
function allRecipes() {
  return [...BASE_RECIPES, ...appState.customRecipes]
    .filter(r => !(appState.deletedRecipes || []).includes(r.id))
    .map(r =>
      appState.recipeOverrides && appState.recipeOverrides[r.id]
        ? { ...r, ...appState.recipeOverrides[r.id] }
        : r
    );
}

/** Active (non-archived) recipes. */
function activeRecipes() {
  return allRecipes().filter(r => !isArchived(r.id));
}

/** Look up a single recipe by id. */
function getRecipe(id) {
  return allRecipes().find(r => r.id === id);
}

/** Whether a recipe id is currently archived. */
function isArchived(id) {
  return (appState.archivedRecipes || []).includes(id);
}

/* ==========================================================================
   TODAY ENGINE
   ========================================================================== */

/**
 * Real calendar weekdays mapped to the 3-day meal-plan block index.
 * Friday has no dedicated block in the current plan (null = no plan).
 */
const WEEKDAY_TO_MEAL_BLOCK = {
  Saturday: 0, Sunday: 0,
  Monday: 1,   Tuesday: 1,
  Wednesday: 2, Thursday: 2,
  Friday: null,
};

/** Return the current weekday name (e.g. "Monday"). */
function getTodayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Aggregate today's plan data: meals, workout, calorie total.
 * Returns a plain object consumed by renderTodaySummary() and renderTimeline().
 */
function getTodayPlan() {
  if (!appState.weekPlan) refreshWeekPlan();

  const dayName  = getTodayName();
  const blockIdx = WEEKDAY_TO_MEAL_BLOCK[dayName];
  const week     = appState.weekPlan[appState.activeMealPlanWeek] || null;
  const dayBlock = (week && blockIdx !== null) ? week.days[blockIdx] : null;
  const meals    = dayBlock ? dayTotals(dayBlock) : null;

  const workout = getWorkoutForDate(new Date());

  const dateKey_  = todayKeyStr();
  const kcalEntries  = (appState.calories && appState.calories[dateKey_]) || [];
  const calorieTotal = kcalEntries.reduce((sum, e) => sum + (e.kcal || 0), 0);

  return {
    dayName,
    dateKey: dateKey_,
    meals,
    workout,
    calorieTotal,
    hasPlan: !!(meals || (workout && workout.exercises && workout.exercises.length)),
  };
}

/* ==========================================================================
   CHANGE LOG
   ========================================================================== */

/**
 * Append an entry to the change log for a given section ('plan' | 'calories').
 * Keeps the log trimmed to 30 entries.
 *
 * @param {'plan'|'calories'} section
 * @param {string} text   - Human-readable description
 * @param {object} revert - Revert descriptor (optional)
 */
function logChange(section, text, revert) {
  if (!appState.changeLog[section]) appState.changeLog[section] = [];
  appState.changeLog[section].unshift({
    id:     Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    text,
    ts:     new Date().toISOString(),
    revert: revert || null,
  });
  appState.changeLog[section] = appState.changeLog[section].slice(0, 30);
}

/** Apply a stored revert descriptor to roll back a change. */
function applyRevert(revert) {
  if (!revert) return;
  if (revert.type === 'weekOverride') {
    if (revert.prevValue === null || revert.prevValue === undefined) {
      delete appState.weekOverrides[revert.key];
    } else {
      appState.weekOverrides[revert.key] = revert.prevValue;
    }
  } else if (revert.type === 'calAdd') {
    const arr = appState.calories[revert.dateKey];
    if (arr) appState.calories[revert.dateKey] = arr.filter(e => e.id !== revert.entryId);
  } else if (revert.type === 'calRemove') {
    if (!appState.calories[revert.dateKey]) appState.calories[revert.dateKey] = [];
    if (!appState.calories[revert.dateKey].some(e => e.id === revert.entry.id)) {
      appState.calories[revert.dateKey].push(revert.entry);
    }
  }
}

/**
 * Remove a change log entry by id, applying its revert if present.
 * Triggers a full re-render.
 */
function removeChangeEntry(section, id) {
  const entry = (appState.changeLog[section] || []).find(e => e.id === id);
  if (entry) applyRevert(entry.revert);
  appState.changeLog[section] = (appState.changeLog[section] || []).filter(e => e.id !== id);
  saveState();
  render();
}

/* ==========================================================================
   CALORIE LOG
   ========================================================================== */

/**
 * Drop calorie log entries older than today + yesterday.
 * Prevents unbounded localStorage growth.
 */
function pruneOldCalorieLogs() {
  const keep = new Set(getRecentDateKeys(2));
  Object.keys(appState.calories || {}).forEach(key => {
    if (!keep.has(key)) delete appState.calories[key];
  });
}

/** Add a calorie entry for today and log the change. */
function addCalEntry(label, kcal) {
  const key = todayKeyStr();
  if (!appState.calories[key]) appState.calories[key] = [];
  const entry = {
    id:    Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    label,
    kcal,
  };
  appState.calories[key].push(entry);
  logChange('calories', `Logged "${label}" \u2014 +${kcal} kcal`, {
    type: 'calAdd', dateKey: key, entryId: entry.id,
  });
  saveState();
  render();
}

/** Remove a calorie entry by id and log the change. */
function removeCalEntry(key, id) {
  if (!appState.calories[key]) return;
  const entry = appState.calories[key].find(e => e.id === id);
  appState.calories[key] = appState.calories[key].filter(e => e.id !== id);
  if (entry) {
    logChange('calories', `Removed "${entry.label}" \u2014 -${entry.kcal} kcal`, {
      type: 'calRemove', dateKey: key, entry: { ...entry },
    });
  }
  saveState();
  render();
}

/* ==========================================================================
   GYM TRACKER
   ========================================================================== */

/** Key for the current week's tracker data (Monday's date key). */
function currentTrackerWeekKey() {
  return getWeekDateKeys()[0];
}

/** Return a blank tracker week structure. */
function blankTrackerWeek() {
  const days = {};
  BASE_GYM_DAYS.forEach((_, i) => { days[i] = { cardio: false, swim: false }; });
  return { days, sauna: 0, steam: 0 };
}

/** Get (or initialise) the tracker data for the current week. */
function getTrackerWeek() {
  const key = currentTrackerWeekKey();
  if (!appState.gymTracker[key]) appState.gymTracker[key] = blankTrackerWeek();
  return appState.gymTracker[key];
}

/* ==========================================================================
   RECIPE MANAGEMENT
   ========================================================================== */

/** Archive a recipe by id. */
function archiveRecipe(id) {
  if (!appState.archivedRecipes.includes(id)) appState.archivedRecipes.push(id);
  saveState();
  render();
}

/** Unarchive a recipe by id. */
function unarchiveRecipe(id) {
  appState.archivedRecipes = appState.archivedRecipes.filter(x => x !== id);
  saveState();
  render();
}

/** Permanently delete a recipe by id. */
function deleteRecipeNow(id) {
  appState.deletedRecipes = appState.deletedRecipes || [];
  if (!appState.deletedRecipes.includes(id)) appState.deletedRecipes.push(id);
  delete appState.recipeOverrides[id];
  appState.customRecipes  = appState.customRecipes.filter(r => r.id !== id);
  appState.archivedRecipes = appState.archivedRecipes.filter(x => x !== id);
  saveState();
  render();
}

/**
 * Find all week/day/slot usages of a recipe id in the effective week plan.
 * Returns an array of { wi, di, slot, weekTitle, dayLabel } objects.
 */
function findRecipeUsages(id) {
  const usages = [];
  effectiveWeeks().forEach((w, wi) => {
    w.days.forEach((d, di) => {
      ['lunch', 'dinner'].forEach(slot => {
        if (d[slot] === id) usages.push({ wi, di, slot, weekTitle: w.title, dayLabel: d.label });
      });
    });
  });
  return usages;
}

/**
 * Return the week recipe ids used in a given week index (deduped).
 * Used by the grocery list to know which ingredients to show.
 */
function weekRecipeIds(weekIdx) {
  const w = effectiveWeeks()[weekIdx];
  const ids = [];
  w.days.forEach(d => {
    [d.lunch, d.dinner].forEach(id => {
      if (id && !ids.includes(id)) ids.push(id);
    });
  });
  return ids;
}
