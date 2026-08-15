/**
 * weeks.js
 * Base 4-week meal rotation plan.
 * Each day entry references recipe IDs from BASE_RECIPES.
 * User swaps are stored in appState.weekOverrides and merged
 * at runtime by effectiveWeeks() in state.js.
 */

const BASE_WEEKS = [
  {
    title: "Week 1: Sweet & Sour, Shawarma, & Mushroom Chicken",
    days: [
      { label: "Sat & Sun", lunch: "sweet-sour",    dinner: "shawarma-bowl" },
      { label: "Mon & Tue", lunch: "sweet-sour",    dinner: "mushroom-chicken" },
      { label: "Wed & Thu", lunch: "shawarma-bowl", dinner: "mushroom-chicken" },
    ]
  },
  {
    title: "Week 2: Coconut Curry, Alfredo Pasta, & Burritos",
    days: [
      { label: "Sat & Sun", lunch: "coconut-curry", dinner: "alfredo-pasta" },
      { label: "Mon & Tue", lunch: "coconut-curry", dinner: "burritos" },
      { label: "Wed & Thu", lunch: "alfredo-pasta", dinner: "burritos" },
    ]
  },
  {
    title: "Week 3: Persian Chicken, Fettuccini, & Honey Soy Salmon",
    days: [
      { label: "Sat & Sun", lunch: "persian-chicken",  dinner: "cajun-fettuccini" },
      { label: "Mon & Tue", lunch: "honey-soy-salmon", dinner: "persian-chicken" },
      { label: "Wed & Thu", lunch: "honey-soy-salmon", dinner: "cajun-fettuccini" },
    ]
  },
  {
    title: "Week 4: Shawarma Bowl, Coconut Curry, & Burritos",
    days: [
      { label: "Sat & Sun", lunch: "shawarma-bowl", dinner: "coconut-curry" },
      { label: "Mon & Tue", lunch: "shawarma-bowl", dinner: "burritos" },
      { label: "Wed & Thu", lunch: "coconut-curry", dinner: "burritos" },
    ]
  },
];
