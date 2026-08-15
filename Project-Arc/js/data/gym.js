/**
 * gym.js
 * Base 7-day gym training split and recovery protocols.
 * User edits are stored in appState.gymOverrides and merged
 * at runtime by effectiveGymDays() in state.js.
 */

const BASE_GYM_DAYS = [
  {
    label: "Day 1", name: "Push", sub: "Chest, Shoulders, Triceps",
    exercises: [
      ["Bench Press",         "4\u00d76\u201310"],
      ["Incline DB Press",    "3\u00d78\u201312"],
      ["Shoulder Press",      "3\u00d78\u201312"],
      ["Lateral Raises",      "3\u00d712\u201315"],
      ["Triceps Pushdown",    "3\u00d710\u201315"],
    ],
    cardio: "45 min moderate cardio + 15 min swim"
  },
  {
    label: "Day 2", name: "Pull", sub: "Back, Biceps, Core",
    exercises: [
      ["Lat Pulldown",        "4\u00d76\u201310"],
      ["Barbell Row",         "3\u00d78\u201312"],
      ["Seated Row",          "3\u00d710\u201312"],
      ["Face Pulls",          "3\u00d712\u201315"],
      ["Biceps Curl",         "3\u00d710\u201315"],
      ["Cable Crunches",      "3\u00d712\u201315"],
    ],
    cardio: "45 min moderate cardio + 15 min swim"
  },
  {
    label: "Day 3", name: "Cardio / Swim", sub: "Conditioning day",
    exercises: [],
    cardio: "45 min higher-intensity intervals + 15 min swim"
  },
  {
    label: "Day 4", name: "Legs", sub: "Quads, Hamstrings, Calves",
    exercises: [
      ["Squats",                        "4\u00d76\u201310"],
      ["Romanian Deadlifts (RDLs)",     "3\u00d710\u201312"],
      ["Hamstring Curl",                "3\u00d710\u201315"],
      ["Leg Extension",                 "3\u00d712\u201315"],
      ["Calf Raises",                   "4\u00d712\u201320"],
    ],
    cardio: "Skip the 45 min cardio \u2014 only a 15 min light swim to save leg recovery"
  },
  {
    label: "Day 5", name: "Upper Light", sub: "Hypertrophy / Core",
    exercises: [
      ["Incline Press (light)",  "3\u00d710\u201312"],
      ["Rows (light)",           "3\u00d710\u201312"],
      ["Shoulders",              "3\u00d712\u201315"],
      ["Arms Superset",          "3\u00d712\u201315"],
      ["Hanging Leg Raises",     "3\u00d712\u201315"],
    ],
    cardio: "45 min moderate cardio + 15 min swim"
  },
  {
    label: "Day 6", name: "Active Rest", sub: "Recovery",
    exercises: [],
    cardio: "No gym cardio \u2014 light outdoor walk to stay active"
  },
  {
    label: "Day 7", name: "Active Rest", sub: "Recovery",
    exercises: [],
    cardio: "No gym cardio \u2014 light outdoor walk to stay active"
  },
];

const PROTOCOLS = [
  {
    title: "Sauna",
    body: "10\u201315 mins, 2\u20134x/week after workouts. Deep hydration required."
  },
  {
    title: "Steam Room",
    body: "10\u201315 mins, 1\u20132x/week."
  },
  {
    title: "Sleep",
    body: "Strict bedtime (set on the Goals tab) to hit 7+ hours of anabolic recovery."
  },
  {
    title: "Warning Signs",
    body: "Watch for strength drops, fatigue, or poor sleep. Reduce cardio volume and slightly increase carbs if present.",
    warn: true
  },
];
