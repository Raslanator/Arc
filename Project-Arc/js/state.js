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

const DEFAULT_APPSTATE = {
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

  timelineStatus: {},     // { "YYYY-MM-DD": { [eventIdx]: { done, mode, time } } }
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
  /** Read and JSON-parse a value. Returns null if missing or unparseable. */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  /** JSON-stringify and write a value. Silently ignores storage errors. */
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* storage unavailable — non-fatal */ }
  },

  /** Remove a single key. */
  remove(key) {
    localStorage.removeItem(key);
  },

  /** Return all current storage keys as an array. */
  keys() {
    return Object.keys(localStorage);
  },

  /** Remove all app data and reload. Used by the Reset App action. */
  clearAll() {
    localStorage.removeItem('appState');
    location.reload();
  },
};

/* ==========================================================================
   PERSISTENCE
   ========================================================================== */

/**
 * Persist appState via the Storage adapter.
 * weekPlan is a derived view — never persisted to avoid drift.
 */
function saveState() {
  const toSave = { ...appState };
  delete toSave.weekPlan;
  Storage.set('appState', toSave);
}

/** Normalize one persisted/view index without introducing full schema handling. */
function normalizeStateIndex(value, length, fallback = 0) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < length ? index : fallback;
}

/**
 * Load appState via the Storage adapter, backfilling any keys missing
 * from older saves (first run or new fields added since last save).
 */
function loadState() {
  const parsed = Storage.get('appState') || {};
  const hasActiveMealPlanWeek = Object.prototype.hasOwnProperty.call(parsed, 'activeMealPlanWeek');

  appState = { ...DEFAULT_APPSTATE, ...parsed };
  appState.settings   = { ...DEFAULT_SETTINGS, ...(appState.settings || {}) };
  appState.changeLog  = {
    plan:     (appState.changeLog && appState.changeLog.plan)     || [],
    calories: (appState.changeLog && appState.changeLog.calories) || [],
  };

  // Chunk 1 compatibility: legacy currentWeek/gymDay values remain valid as
  // navigation state. A legacy currentWeek also seeds the new active week once
  // so Today's meal plan does not unexpectedly change during the upgrade.
  appState.currentWeek = normalizeStateIndex(appState.currentWeek, BASE_WEEKS.length, 0);
  appState.activeMealPlanWeek = normalizeStateIndex(
    hasActiveMealPlanWeek ? parsed.activeMealPlanWeek : parsed.currentWeek,
    BASE_WEEKS.length,
    appState.currentWeek
  );
  appState.gymDay = normalizeStateIndex(appState.gymDay, BASE_GYM_DAYS.length, 0);

  refreshWeekPlan();
  pruneOldCalorieLogs();
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
