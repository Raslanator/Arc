/**
 * timeline.js
 * Base timeline events for the Today arc.
 * Times are in minutes-since-midnight relative to the default
 * wake (5:00 AM = 300) / sleep (10:00 PM = 1320) window.
 * effectiveT() in utils.js scales these to the user's actual settings.
 */

const TIMELINE = [
  {
    t: 300,
    title: "Wake Up",
    body: "Drink 200\u2013300ml of water + light movement.",
    why: "Hydrates and primes the body immediately upon waking."
  },
  {
    t: 315,
    title: "Pre-Workout Fuel",
    body: "Banana + fast carb (rice cake or toast with honey) + coffee + creatine (5g).",
    why: "The extra carb provides the glycogen needed to push through the intense 2-hour session, especially the swimming."
  },
  {
    t: 330,
    title: "Gym",
    body: "Weights + cardio + swimming.",
    why: ""
  },
  {
    t: 465,
    title: "Breakfast \u2014 Post-Workout Recovery",
    body: "High protein, 600 kcal. Option A: Overnight Oats. Option B: 3 eggs, avocado & toast.",
    why: "Fits perfectly in your post-workout anabolic window."
  },
  {
    t: 690,
    title: "Mid-Morning Snack",
    body: "Half of your daily snack calories \u2014 Greek yogurt or a protein shake.",
    why: "Bridges the gap between breakfast and lunch to keep energy levels stable."
  },
  {
    t: 840,
    title: "Lunch",
    body: "Meal prep, calories depend on the day\u2019s plan.",
    why: ""
  },
  {
    t: 1050,
    title: "Afternoon Snack",
    body: "The remaining half of your daily snack calories \u2014 fruit + nuts or boiled eggs.",
    why: "No longer optional \u2014 keeps your metabolism steady before dinner."
  },
  {
    t: 1170,
    title: "Dinner",
    body: "Meal prep, calories depend on the day\u2019s plan.",
    why: ""
  },
  {
    t: 1260,
    title: "Wind Down",
    body: "No screens \u2014 relax and let the nervous system calm down.",
    why: ""
  },
  {
    t: 1320,
    title: "Sleep",
    body: "Lights out.",
    why: "Ensures solid recovery to support your heavy training schedule."
  },
];

/** Calorie value of the fixed daily breakfast (not swappable). */
const BREAKFAST_KCAL = 600;

/**
 * Default wake/sleep times in minutes-since-midnight.
 * These match the base offsets used in TIMELINE above.
 */
const BASE_WAKE  = 300;  // 5:00 AM
const BASE_SLEEP = 1320; // 10:00 PM
