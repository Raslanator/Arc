# Arc image assets

Pass 9 reserves image space before real photography is added.

Planned folders:

- `recipes/` — primary recipe-card and recipe-detail photos
- `meal-plan/` — optional meal-plan-specific crops; falls back to the recipe photo
- `grocery/` — optional grocery-specific crops; falls back to the recipe photo
- `gym/` — training-day / exercise photography

Preferred format: optimized WebP, normal image files (never base64), with explicit width/height metadata in the media registry.

Recommended naming:

- `recipes/<recipe-id>.webp`
- `meal-plan/<recipe-id>.webp`
- `grocery/<recipe-id>.webp`
- `gym/day-<index>.webp`

The runtime registry is exposed as `window.ArcMedia`. Each asset entry may include:

- `src`
- `alt`
- `width`
- `height`
- `photographer`
- `sourceUrl`
- `pexelsId`

Meal Plan and Grocery automatically reuse a registered recipe image when no section-specific crop exists.
