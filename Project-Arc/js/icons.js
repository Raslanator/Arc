/**
 * icons.js
 * Minimal SVG icon system.
 *
 * All icons are stroke-based, use currentColor, rounded caps/joins,
 * and a consistent 1.5px stroke weight at a 24x24 viewBox.
 *
 * Usage:
 *   icon('edit')          → SVG string for inline use
 *   icon('edit', 'Edit')  → SVG with aria-label (for icon-only buttons)
 *
 * When an icon is accompanied by visible text, the caller should add
 * aria-hidden="true" to the SVG element. This helper does that by default
 * when no label is provided.
 *
 * Navigation icons (today, calories, plan, gym, more) are defined here
 * for use in the future mobile bottom navigation pass.
 */

const ICONS = {
  /* ---- UI icons ---- */

  /** Pencil — edit action */
  edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`,

  /** Trash — archive / delete action */
  trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`,

  /** Unarchive — restore from archive */
  unarchive: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
  </svg>`,

  /** Play triangle — watch video */
  play: `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"
    stroke="none"
    aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`,

  /* ---- Navigation icons (prepared for mobile bottom nav — Pass 3) ---- */

  /** Today — arc / clock concept */
  today: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 2"/>
  </svg>`,

  /** Calories — flame */
  calories: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M12 2c0 0-5 5-5 10a5 5 0 0 0 10 0c0-3-2-6-2-6s-1 2-3 2c0-2 0-6 0-6z"/>
  </svg>`,

  /** Meal Plan — fork and knife */
  plan: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6h3.5"/>
    <path d="M19.5 13V22"/>
  </svg>`,

  /** Gym — dumbbell */
  gym: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M6 4v16"/>
    <path d="M18 4v16"/>
    <path d="M3 8v8"/>
    <path d="M21 8v8"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>`,

  /** More — grid of dots (overflow) */
  more: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"
    stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <circle cx="5"  cy="5"  r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="5"  r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="5"  r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="5"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="5"  cy="19" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none"/>
  </svg>`,
};

/**
 * Return an SVG icon string by name.
 *
 * @param {string} name     - Icon name (key of ICONS)
 * @param {string} [label]  - If provided, adds role="img" and aria-label.
 *                            If omitted, the SVG is aria-hidden (decorative).
 * @returns {string} SVG markup string
 */
function icon(name, label) {
  const svg = ICONS[name];
  if (!svg) return '';
  if (label) {
    // Accessible icon: remove aria-hidden, add role + label
    return svg
      .replace('aria-hidden="true"', `role="img" aria-label="${escapeHtml(label)}"`)
      .trim();
  }
  return svg.trim();
}
