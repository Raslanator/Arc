# Pass 11 — Chunk 0 Runtime Baseline

Branch: `edit/ARC.05`
Behavioral baseline commit: `a98d632c02207297cd903490186622e1de079b38`
Scope: observation/documentation only. No application behavior changes.

## 1. Static JavaScript load order

`index.html` loads these classic scripts synchronously in this order:

1. `js/data/timeline.js`
2. `js/data/recipes.js`
3. `js/data/weeks.js`
4. `js/data/gym.js`
5. `js/utils.js`
6. `js/icons.js`
7. `js/state.js`
8. `js/ui.js`
9. `js/prayer.js`
10. `js/arc.js`
11. `js/nav.js`
12. `js/modals.js`
13. `js/render.js`
14. `js/schedule.js`
15. `js/schedule-lifecycle.js`
16. `js/recipes-pass4.js`
17. `js/meal-plan-pass5.js`
18. `js/meal-plan-pass5-refine.js`
19. `js/gym-settings-pass6.js`
20. `js/progress-pass7.js`
21. `js/progress-pass7-daily.js`
22. `js/progress-pass7-visual-fix.js`
23. `js/main.js`

The Pass 9 JS files are not listed statically in `index.html`; they are injected dynamically by `recipes-pass4.js` and are therefore part of runtime behavior through a hidden asynchronous load path.

## 2. Runtime override / replacement map

Important global functions do not always execute the implementation in their original file. The final runtime composition is:

| Global/function | Base definition | Later replacement/wrapper chain | Final pre-Pass-9 runtime |
| --- | --- | --- | --- |
| `loadState` | `state.js` | `schedule.js` -> `schedule-lifecycle.js` -> `progress-pass7-daily.js` | Progress daily wrapper around lifecycle wrapper around schedule wrapper around base state loader |
| `saveState` | `state.js` | `progress-pass7-daily.js` | Progress daily wrapper prunes Progress history before calling base storage persistence |
| `pruneOldCalorieLogs` | `state.js` | `schedule-lifecycle.js` | Replaced with preservation function; the original 2-day pruning body is not the final runtime behavior |
| `render` | `render.js` | `progress-pass7.js` -> `progress-pass7-daily.js` -> `progress-pass7-visual-fix.js` | Visual-fix wrapper -> daily wrapper -> Progress wrapper -> base render |
| `renderTimeline` | `render.js` | `schedule.js` -> `schedule-lifecycle.js` | Lifecycle master-edit wrapper around editable-schedule renderer |
| `renderTodaySummary` | `render.js` | `schedule.js` -> `schedule-lifecycle.js` | Contextual/carousel-preserving lifecycle implementation before dynamic Pass 9 wrapping |
| `updateNextEventHighlight` | `render.js` | `schedule.js` -> `schedule-lifecycle.js` | Schedule-aware implementation wrapped to refresh Daily Brief Up Next |
| `renderArc` | `arc.js` | `schedule.js` | Editable-schedule Arc renderer |
| `recalcArcRange` | `arc.js` | `schedule.js` | Schedule/prayer-aware range calculation |
| `markTimelineDone` | `render.js` | `schedule.js` | ID-based schedule completion implementation |
| `clearTimelineDone` | `render.js` | `schedule.js` | ID-based schedule completion implementation |
| `openDoneModal` | `modals.js` | `schedule.js` | Schedule-event-ID modal implementation |
| `activateTab` | `nav.js` | Pass 8 wrapper inside `nav.js` | Base activation + mobile-nav sync + desktop tab visibility |
| `effectiveWeeks` | `state.js` | `meal-plan-pass5.js` | Base plan + reserved removed-meal translation |
| `weekRecipeIds` | `state.js` | `meal-plan-pass5.js` | Pass 5 filtered current-week recipe IDs |
| `applyRevert` | `state.js` | `meal-plan-pass5.js` | Pass 5 batch-revert-aware wrapper |
| `openSwapPicker` | `modals.js` | `meal-plan-pass5.js` | Pass 5 add/swap implementation |
| `renderWeekDetail` | `render.js` | `meal-plan-pass5.js` -> `meal-plan-pass5-refine.js` | Refine wrapper around Pass 5 renderer |
| `renderGrocery` | `render.js` | `meal-plan-pass5.js` | Pass 5 cleanup/progress wrapper around base Grocery renderer |
| `renderRecipes` | `render.js` | `recipes-pass4.js` | Pass 4 renderer before dynamic Pass 9 media wrapper |
| `renderGymSelect` | `render.js` | `gym-settings-pass6.js` | Pass 6 renderer |
| `renderGymDetail` | `render.js` | `gym-settings-pass6.js` | Pass 6 renderer before dynamic Pass 9 media wrapper |
| `renderProtocols` | `render.js` | `gym-settings-pass6.js` | Pass 6 renderer |
| `renderTracker` | `render.js` | `gym-settings-pass6.js` | Pass 6 renderer |
| `openGymEdit` | `modals.js` | `gym-settings-pass6.js` | Pass 6 editor |
| `clampArcPan` | `arc.js` | `main.js` | Main Pass 2 horizontal-only pan behavior |
| `renderArcViewBox` | `arc.js` | `main.js` wrapper | Main wrapper recalculating vertical centering before base viewbox rendering |
| `updateArcShape` | `arc.js` | `main.js` wrapper | Main wrapper adding larger invisible SVG hit targets after base shape update |

### Final `loadState()` chain at startup

When `main.js` calls `loadState()`, the effective call stack is:

`progress-pass7-daily load wrapper`
-> `schedule-lifecycle empty-schedule wrapper`
-> `schedule schedule-state wrapper`
-> `state.js base loader`

Important side effect: `schedule.js` calls `saveState()` during its load wrapper. By the time startup occurs, global `saveState` has already been replaced by the Progress daily wrapper, so that startup save can invoke Progress pruning.

### Final `render()` chain before dynamic Pass 9 initialization

`progress-pass7-visual-fix render wrapper`
-> `progress-pass7-daily render wrapper`
-> `progress-pass7 render wrapper`
-> `render.js base render`

The base render itself calls several functions that have already been replaced by Schedule, Pass 4, Pass 5 and Pass 6 implementations.

## 3. Pass 9 dynamic-load sequence

Actual runtime sequence:

1. `recipes-pass4.js` executes as static script #16.
2. At its end, `loadPass9MediaScaffold()` looks for `script[data-arc-media-pass9]`.
3. If absent, it creates and appends a classic script with `src="js/media-pass9.js"` and `data-arc-media-pass9="true"`.
4. Because this is a dynamically inserted external script and `async=false` is not explicitly set, its network execution timing is not represented by the static script list.
5. The parser continues through Pass 5, Pass 6, Progress and `main.js` independently of the Pass 9 network fetch.
6. When `media-pass9.js` executes, it does **not** necessarily install its wrappers immediately. If `document.readyState === "loading"`, it waits for `DOMContentLoaded`; otherwise it initializes immediately.
7. `media-pass9.js` then wraps the implementations that exist at initialization time:
   - `renderTodaySummary`
   - `renderRecipes`
   - `openRecipe`
   - `renderWeekDetail`
   - `renderGrocery`
   - `renderGymDetail`
8. It exposes `window.ArcMedia` and enhances the already-rendered DOM once, specifically because `main.js` may already have rendered before Pass 9 initializes.
9. The `load` event for `media-pass9.js` triggers creation of `js/daily-brief-media-pass9.js`.
10. `daily-brief-media-pass9.js` installs Daily Brief DOM observers/timers and performs sync on DOM ready/current task/animation frame. It does not replace a global render function.

The Pass 9 CSS files are already static links in `index.html`, so their `ensureStylesheet()` checks normally find the existing link and do not add duplicates.

### Pass 9 baseline conclusion

Pass 9 is **not dormant** in `edit/ARC.05`. It is intentionally dynamically loaded. The architectural concern is hidden/asynchronous resource loading and function-wrapping order, not missing activation.

## 4. Representative state snapshot set

The companion `chunk-0-state-snapshots.json` file contains synthetic fixtures based on the current `DEFAULT_APPSTATE`/runtime structures. They are not copied from a user's browser.

Fixtures:

- `freshStorage`: no ARC keys present.
- `representativeExisting`: valid current-style state with navigation selections, timeline status, prayer status, calories and a custom schedule.
- `intentionalEmptySchedule`: valid state with `timelineEvents: []` to protect the known empty-schedule behavior.
- `historicalScheduleMismatch`: older completion bucket whose event set differs from the current active schedule, reproducing ARC-14/ARC-15 risk.
- `malformedButValidJson`: syntactically valid JSON with invalid ARC field types, reproducing ARC-05.
- `prayerCacheValid` / `prayerCacheMalformed`: external-cache trust-boundary fixtures.

## 5. Baseline regression / reproduction results

These are source/runtime-path baseline results against the unmodified `a98d632...` application tree. The environment available for Chunk 0 can verify source composition and deployment status, but it does not provide a browser automation runner; browser-only visual/CSP-console assertions remain pending for the later test-enabled chunk.

| Check | Baseline | Evidence/result |
| --- | --- | --- |
| Vercel build for behavioral baseline | PASS | GitHub combined status reports Vercel `success` for `a98d632...` |
| Empty schedule survives reload path | PASS by final runtime trace | `schedule-lifecycle.js` pre-reads stored state and restores an intentionally empty `timelineEvents` after the schedule loader seeds defaults |
| Gym browsing is isolated from Today | FAIL | `getTodayPlan()` reads `appState.gymDay`; Gym navigation writes `appState.gymDay` |
| Meal Plan browsing is isolated from Today | FAIL | `getTodayPlan()` reads `appState.currentWeek`; Meal Plan week navigation writes `appState.currentWeek` |
| Storage write failure is surfaced | FAIL | `Storage.set()` catches and ignores write errors; `saveState()` returns no result |
| Persisted state schema validation exists | FAIL | load path shallow-merges parsed JSON and only reconstructs a small subset of nested defaults |
| Historical Timeline denominator is stable after schedule edits | FAIL | Progress derives event IDs from the current `ArcSchedule.getEvents()` for historical days |
| Deleting current event preserves historical completion | FAIL | schedule deletion calls `cleanupDeletedEventStatus()` across every historical date bucket |
| Generic `saveState()` is persistence-only | FAIL | Progress daily wraps `saveState()` and calls `pruneProgressHistory()` first |
| 30-day display and storage retention are explicitly separated | FAIL / unresolved product semantics | current Progress daily layer prunes stored calories/timeline/prayer/gym history outside its 30-day window |
| Prayer cache/API validation boundary | FAIL | cache accepts any truthy parsed object; fetched prayer fields are copied without strict time validation |
| Prayer request timeout/cancellation | FAIL | request uses plain `fetch(url)` with no AbortController/timeout |
| Post-Isha countdown uses tomorrow's actual Fajr | FAIL | after Isha renderer selects today's Fajr entry and adds 1440 minutes |
| Reset clears all ARC-owned storage | FAIL | `clearAll()` removes only `appState`; prayer cache uses separate `prayerTimes_*` keys |
| New recipe IDs are guaranteed unique | FAIL | `slugify()` uses normalized title + truncated timestamp; no guaranteed UUID/collision check |
| CSP policy and runtime styling are fully compatible | FAIL by source trace | CSP omits inline styles while HTML and JS still use `style=""`, `.style.*` and dynamic inline style strings |
| Pass 9 JS is part of runtime | PASS | `recipes-pass4.js` dynamically injects `media-pass9.js`, whose load callback injects `daily-brief-media-pass9.js` |
| Existing recipe URL scheme restriction remains present | PASS by source trace | recipe opening paths call `sanitizeUrl()` before `window.open` |
| Existing user-editable recipe/schedule HTML escaping remains present | PASS by source trace | relevant generated markup uses `escapeHtml()` around editable strings; no security behavior was changed in Chunk 0 |

## 6. Discrepancies: remediation documents vs actual `edit/ARC.05`

### Discrepancy A — ARC-03

The addendum is correct. The original ARC-03 is a false positive at final runtime. `schedule-lifecycle.js` explicitly preserves a stored empty `timelineEvents: []`. Keep ARC-03 cancelled; retain only a regression check.

### Discrepancy B — ARC-13

The addendum says Pass 9 JS exists but is not loaded. That is **incorrect for the current branch**.

`recipes-pass4.js` explicitly creates a script for `js/media-pass9.js`; on load it creates a script for `js/daily-brief-media-pass9.js`. Both are intended to run. Therefore ARC-13 must be reframed from:

`Pass 9 JavaScript exists but is not loaded`

to:

`Pass 9 is loaded through a hidden asynchronous injection chain, making resource order and final wrapper composition less explicit.`

This remains relevant to ARC-10 architecture stabilization, but there is no "enable Pass 9" action to perform.

### Discrepancy C — calorie retention observation

The original report's false-positive warning about the short retention logic in `state.js` is correct: `schedule-lifecycle.js` replaces `pruneOldCalorieLogs()` so the base two-day prune is not final runtime behavior.

However the addendum's ARC-16 is also correct: `progress-pass7-daily.js` later installs a different 30-day prune and wraps `saveState()` with it. Therefore the actual behavior is:

- base 2-day calorie prune: effectively disabled;
- later 30-day multi-domain Progress prune: active;
- generic save calls can trigger that later prune.

### Discrepancy D — CSP scope

The addendum's expanded ARC-01 is supported. The issue is broader than static `index.html` attributes. Current JS uses dynamic style mutation in navigation, Daily Brief sizing/spotlights and generated Progress markup. The existing Progress visual-fix layer already migrated some percentage graphics to SVG, but it does not eliminate the whole-application CSP mismatch.

## 7. Chunk 0 gate

No application behavior was changed in Chunk 0.

Before Chunk 1 starts, the remediation backlog should use the corrected facts above:

- ARC-03: cancelled, regression-only.
- ARC-13: reclassify as Pass 9 dynamic-load / wrapper-order architecture debt; do not "enable" it.
- ARC-16: active and distinct from the obsolete base two-day prune.
- All other retained findings remain candidates, subject to issue-by-issue runtime tracing before implementation.
