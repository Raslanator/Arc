/**
 * progress-pass7-test-cleanup.js
 * One-time migration that removes data created by temporary Progress test seeds.
 * It is inert for browsers that were never seeded.
 */

(function initProgressPass7TestCleanup() {
  const TEST_MARKERS = [
    'arc-progress-daily-test-seed-v1',
    'arc-progress-daily-test-seed-v2',
    'arc-progress-daily-test-seed-v3',
  ];

  function hasSeedMarker() {
    try {
      return TEST_MARKERS.some(marker => localStorage.getItem(marker) === '1');
    } catch (e) {
      return false;
    }
  }

  function removeSeedMarkers() {
    try {
      TEST_MARKERS.forEach(marker => localStorage.removeItem(marker));
    } catch (e) {
      // Non-fatal: app state cleanup still succeeds in memory.
    }
  }

  const baseLoadState = loadState;
  loadState = function loadStateWithProgressTestCleanup() {
    baseLoadState();
    if (!hasSeedMarker()) return;

    // The temporary seed replaced these retained-history buckets with
    // deterministic fake data, so clear those seeded buckets as one unit.
    appState.calories = {};
    appState.timelineStatus = {};
    appState.prayerStatus = {};
    appState.gymTracker = {};

    removeSeedMarkers();
    saveState();
  };
})();
