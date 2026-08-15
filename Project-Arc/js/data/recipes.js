/**
 * recipes.js
 * Base recipe library.
 * Custom recipes added by the user are stored in appState.customRecipes
 * and merged at runtime by allRecipes() in state.js.
 */

const BASE_RECIPES = [
  {
    id: "burritos",
    name: "High Protein Chipotle Chili Burritos",
    kcalNum: 380, kcalUnit: "burrito",
    portions: "Makes 7 burritos",
    macros: "45g P \u00b7 25g C \u00b7 12g F",
    time: "25 min",
    cost: "~400\u2013500 EGP total (~65 EGP/burrito)",
    ingredients: [
      "1.36kg chicken breast",
      "Garlic powder, paprika, chili powder, cumin, black pepper",
      "5-calorie cooking spray",
      "Lettuce, 200g tomatoes",
      "90g light mayo, sriracha sauce, 1-2 limes",
      "225g reduced-fat cheese",
      "7 large tortillas"
    ],
    steps: [
      "Cut chicken and coat with dry spices.",
      "Spray pan and cook chicken 8-10 mins per side until charred, then mash.",
      "Chop lettuce and dice tomatoes.",
      "Mix mayo, sriracha, chili powder, and lime juice.",
      "Combine chicken, tomatoes, lettuce, sauce, and cheese.",
      "Divide into the 7 tortillas, roll tight, and toast in a pan."
    ],
    storage: "Store in the fridge and consume by the end of the week."
  },
  {
    id: "sweet-sour",
    name: "Sweet and Sour Chicken",
    kcalNum: 820, kcalUnit: "portion",
    portions: "Makes 5 portions",
    macros: "65g P \u00b7 80g C \u00b7 25g F",
    time: "45 min",
    cost: "~600\u2013700 EGP total (~130 EGP/portion)",
    ingredients: [
      "300g basmati rice + 600ml water",
      "3 bell peppers, 1 brown onion, 4 cloves garlic, 15g ginger",
      "1.4kg chicken breast",
      "125ml light soy sauce, 80ml pineapple juice, 80g honey",
      "40ml Worcestershire sauce, 40ml apple cider vinegar, 40ml tomato sauce",
      "12g corn flour, 50ml grapeseed oil, salt, sesame seeds"
    ],
    steps: [
      "Boil rice with 600ml water and salt for 14 mins, rest 4 mins.",
      "Chop peppers and onions; microplane garlic and ginger; chunk chicken.",
      "Whisk liquid ingredients and corn flour for the sauce.",
      "Saut\u00e9 veggies for 4 mins, then remove.",
      "Sear chicken for 6 mins, add garlic/ginger paste for 45 secs.",
      "Add veggies back in, pour the sauce, and boil 2 mins until thick. Garnish with sesame seeds."
    ],
    storage: "4 days in the fridge, or up to 4 months in the freezer."
  },
  {
    id: "cajun-fettuccini",
    name: "Scrumptious Cajun Shrimp Fettuccini",
    kcalNum: 500, kcalUnit: "portion",
    portions: "Makes 4 portions",
    macros: "45g P \u00b7 50g C \u00b7 12g F",
    time: "30 min",
    cost: "~350\u2013450 EGP total (~100 EGP/portion)",
    ingredients: [
      "500g thawed frozen shrimp",
      "Cajun spice mix (smoked paprika, cayenne, garlic/onion powder, thyme, salt, pepper)",
      "5L water, 50g salt, 250g fettuccini pasta",
      "250ml skim milk, 250g cottage cheese",
      "Low-cal canola oil spray",
      "60g parmesan cheese, 100g baby spinach, 1/2 lemon"
    ],
    steps: [
      "Coat shrimp in Cajun spice.",
      "Boil pasta for 7 mins (save 250ml pasta water) and drain.",
      "Blend pasta water, skim milk, cottage cheese, garlic powder, and onion powder until smooth.",
      "Sear shrimp on high heat for 1 min.",
      "Lower heat, pour in cream sauce, and simmer 2 mins.",
      "Add parmesan, wilt the spinach, squeeze lemon, and mix in pasta."
    ],
    storage: "3 to 4 days in the fridge. Reheat in the microwave for 2 minutes."
  },
  {
    id: "honey-soy-salmon",
    name: "Honey Soy Salmon",
    kcalNum: 650, kcalUnit: "portion",
    portions: "Makes 2 portions",
    macros: "40g P \u00b7 85g C \u00b7 25g F",
    time: "30 min",
    cost: "~450\u2013550 EGP total (~250 EGP/portion)",
    ingredients: [
      "200g jasmine rice + 300ml water",
      "Broccolini, spring onion, 1-2 lemons for wedges",
      "2 cloves garlic, 5g ginger",
      "1 tbsp soy sauce (plus extra for veg), 1 tbsp honey",
      "2 tsp rice wine vinegar, 1 tsp sesame oil, 1/2 tsp chili flakes, white pepper",
      "450g skin-on salmon fillets",
      "1 tbsp neutral oil, 1 tsp sesame seeds"
    ],
    steps: [
      "Cook rice in 300ml water.",
      "Grate garlic and ginger, then mix with soy sauce, honey, vinegar, sesame oil, chili flakes, and pepper.",
      "Blanch broccolini for 2 mins, then shock in ice water.",
      "Sear salmon skin-side down for 4-5 mins, flip for 2 mins.",
      "Pour glaze over salmon and baste.",
      "Remove salmon, toss broccolini in the sticky pan with extra soy sauce and sesame seeds."
    ],
    storage: "3 to 4 days in the fridge."
  },
  {
    id: "shawarma-bowl",
    name: "Chicken Shawarma Bowl",
    kcalNum: 600, kcalUnit: "portion",
    portions: "Makes 5 portions",
    macros: "50g P \u00b7 55g C \u00b7 18g F",
    time: "40 min (excl. marination)",
    cost: "~300\u2013400 EGP total (~70 EGP/portion)",
    ingredients: [
      "1kg boneless/skinless chicken thigh",
      "1 tbsp olive oil, 2 tsp smoked paprika, 1 tsp cumin, 1 tsp coriander, 1/2 tsp turmeric",
      "4 cloves garlic, 2-3 whole lemons",
      "230g high-protein Greek yogurt",
      "Salt, pepper",
      "120g iceberg lettuce, 1/2 cucumber, 200g cherry tomatoes, 5g parsley",
      "300g jasmine rice, 550ml stock or water"
    ],
    steps: [
      "Marinate chicken with oil, spices, 3 cloves minced garlic, 1.5 tbsp lemon juice, and 2 tbsp yogurt.",
      "Mix 200g yogurt with 1 clove garlic, 1 tbsp lemon juice, salt, and pepper for sauce.",
      "Chop veggies for a side salad.",
      "Cook rice, then mix with lemon zest, lemon juice, garlic, and chopped parsley.",
      "Sear chicken for 5-6 mins.",
      "Portion rice, chicken, salad, and sauce into containers."
    ],
    storage: "4 days in the fridge (keep sauce and salad separate from the hot food)."
  },
  {
    id: "coconut-curry",
    name: "High Protein Coconut Chicken Curry",
    kcalNum: 608, kcalUnit: "portion",
    portions: "Makes 5 portions",
    macros: "56g P \u00b7 50g C \u00b7 20g F",
    time: "50 min",
    cost: "~450\u2013550 EGP total (~100 EGP/portion)",
    ingredients: [
      "1 large onion, 1 red bell pepper, 5 cloves garlic, 10g ginger",
      "1kg boneless/skinless chicken thigh",
      "1 tbsp coconut oil, 3 tbsp ground cumin, 1.5 tbsp sweet paprika, 1 tsp red chili powder",
      "180ml stock (for deglazing), 800g crushed tomatoes, 400ml coconut milk",
      "300g jasmine rice, 500ml chicken stock (for rice)",
      "120g baby spinach, salt"
    ],
    steps: [
      "Saut\u00e9 chopped onion and pepper in coconut oil for 5-6 mins.",
      "Add minced garlic, ginger, and dry spices.",
      "Deglaze pan with 180ml stock, then add tomatoes, coconut milk, and raw diced chicken.",
      "Simmer for 30-35 mins.",
      "Cook rice in 500ml stock.",
      "Stir spinach into the curry to wilt, then serve with rice."
    ],
    storage: "4 days in the fridge, or 4 months in the freezer."
  },
  {
    id: "persian-chicken",
    name: "Persian Saffron Chicken",
    kcalNum: 750, kcalUnit: "portion",
    portions: "Makes ~4 portions",
    macros: "45g P \u00b7 80g C \u00b7 25g F",
    time: "40 min active (+ 24hr marination)",
    cost: "~500\u2013700 EGP total",
    ingredients: [
      "1kg chicken thighs",
      "1 onion, 1-2 lemons, turmeric, olive oil, yogurt, ground saffron, garlic, ghee",
      "Spice mix (cinnamon, turmeric, cardamom, cloves, salt, pepper)",
      "300g rice, water for boiling, stock",
      "Cucumber, tomato, lettuce, spring onions, mint, pomegranate molasses",
      "Flatbread, chili"
    ],
    steps: [
      "Marinate chicken in onion, lemon, turmeric, olive oil, yogurt, and saffron for 24 hours.",
      "Grill chicken on high heat.",
      "Fry onions and garlic in ghee, add the spice mix, rice, water, and stock; bring to a boil.",
      "Make a chopped side salad with pomegranate molasses dressing and a yogurt mint dip.",
      "Top flatbread with chili/tomato/oil and grill until brown."
    ],
    storage: "3 to 4 days in the fridge."
  },
  {
    id: "mushroom-chicken",
    name: "One Pot Creamy Mushroom Chicken",
    kcalNum: 550, kcalUnit: "portion",
    portions: "Makes 4 portions",
    macros: "45g P \u00b7 10g C \u00b7 40g F",
    time: "40 min",
    cost: "~500\u2013600 EGP total (~135 EGP/portion)",
    ingredients: [
      "2 shallots, 300g Swiss brown mushrooms, 6 cloves garlic",
      "3g parsley, 1g tarragon",
      "1kg boneless/skinless chicken thighs",
      "Olive oil, onion/garlic powder, dried thyme/oregano, salt, pepper",
      "20g unsalted butter, 100ml white wine (or stock), 300ml thickened cream",
      "50g parmesan cheese"
    ],
    steps: [
      "Season chicken thighs and sear for 6 mins per side; set aside.",
      "Melt butter and cook chopped shallots (1 min), then sliced mushrooms (5-6 mins).",
      "Add garlic, then deglaze with wine/stock.",
      "Pour in cream and simmer 6 mins to reduce.",
      "Stir in parmesan and herbs.",
      "Return chicken to the pan for 1 minute to heat through."
    ],
    storage: "3 to 4 days in the fridge."
  },
  {
    id: "caesar-wraps",
    name: "Grab & Go Chicken Caesar Wraps",
    kcalNum: 650, kcalUnit: "wrap",
    portions: "Makes 5 wraps",
    macros: "60g P \u00b7 40g C \u00b7 30g F",
    time: "35 min",
    cost: "~550\u2013650 EGP total (~120 EGP/wrap)",
    ingredients: [
      "1kg chicken breasts, onion/garlic powder, sweet paprika, salt, pepper",
      "300g bacon, olive oil",
      "Dressing: 180g low-fat mayo, 1 clove garlic, 20g parmesan, 6 anchovy fillets, 1 tsp dijon, 1 tsp Worcestershire, 1 tbsp lemon juice",
      "1 baby cos/romaine lettuce",
      "5 large low-fat tortillas"
    ],
    steps: [
      "Season chicken.",
      "Sear chicken for 3.5 mins per side, then finish in a 200\u00b0C oven for 14 mins alongside the bacon.",
      "Whisk mayo, garlic, parmesan, mashed anchovies, mustard, Worcestershire, and lemon juice.",
      "Shred lettuce, and chop the cooked chicken and bacon.",
      "Toss filling with 2/3 of the dressing.",
      "Spread remaining dressing on wraps, add filling, and wrap tightly."
    ],
    storage: "Wrap tightly, fridge 3\u20134 days. Do not freeze \u2014 eat cold."
  },
  {
    id: "alfredo-pasta",
    name: "Grilled Chicken Alfredo Pasta",
    kcalNum: 595, kcalUnit: "portion",
    portions: "Makes ~4 portions",
    macros: "59g P \u00b7 50g C \u00b7 16g F",
    time: "25 min",
    cost: "~450\u2013550 EGP total (~100 EGP/portion)",
    ingredients: [
      "800g chicken breast",
      "Salt, Italian herbs, parsley, chili flakes, garlic powder, paprika",
      "Olive oil, light butter",
      "Chopped garlic, chopped onion, 150g tomato sauce",
      "300ml evaporated milk, 130g light cream cheese, 30g parmesan cheese",
      "520g cooked pasta"
    ],
    steps: [
      "Cube chicken and season with spices and oil.",
      "Cook in light butter for 6-8 mins till golden, then set aside.",
      "Saut\u00e9 garlic and onion for 5 mins in the same pan.",
      "Add tomato sauce and cook until thick.",
      "Stir in evaporated milk, cream cheese, and parmesan until a creamy sauce forms.",
      "Toss cooked pasta in the sauce and top with the grilled chicken."
    ],
    storage: "3 to 4 days in the fridge."
  },
];
