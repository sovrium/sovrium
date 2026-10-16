/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sort control of a sortable column header — the button wrapping the
 * column's label and the direction glyph inside it.
 *
 * A sibling of `table-shell-default-classes.ts`, which draws the `<th>` this
 * control sits in; `table-default-classes.ts` republishes both.
 */

// ──────────────────────────────────────────────────────────────────────────────
// SORT GLYPH — the ↑ / ↓ inside a sorted header
// ──────────────────────────────────────────────────────────────────────────────

const TABLE_SORT_GLYPH = 'ml-1 inline-flex items-center'

/**
 * Compute the default className for the sort-direction indicator.
 *
 * `active: false` is the `↕` a sortable header offers while it is not sorted,
 * drawn while the header is pointed at or focused. It wears the muted
 * foreground, not the disabled tone: it says the column sorts, which is
 * content, and so it reads at 4.5:1 on the header like any other glyph the
 * grid paints.
 *
 * The `sort-asc` / `sort-desc` class tokens and both `aria-label`s stay on the
 * element: spec locators resolve the indicator by class, and the labels are
 * what keep a sorted column announced while `aria-hidden` holds the
 * columnheader's accessible name stable.
 */
export const computeTableSortGlyphClasses = ({ active }: { readonly active: boolean }): string =>
  [TABLE_SORT_GLYPH, active ? `text-foreground` : TABLE_SORT_GLYPH_AT_REST].join(' ')

/**
 * The resting `↕` is an OFFER, so it is drawn only where it is being considered:
 * while its header is pointed at or its sort button has focus. Drawn on every
 * column of every grid it was noise, and the sorted column's arrow is the only
 * mark that carries state. `invisible` rather than `hidden` keeps its box, so
 * the label does not shift when it appears; the header carries `group/th`.
 */
const TABLE_SORT_GLYPH_AT_REST =
  'text-muted-foreground invisible group-hover/th:visible group-focus-within/th:visible'

/**
 * The sort control of a sortable header: a button wrapping the column's label
 * and its glyph, as shadcn/ui's data table draws it. It takes the header's own
 * type and ink, so the header reads as before; it adds only the focus ring.
 */
export const computeTableSortButtonClasses = (): string =>
  'inline-flex cursor-pointer items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
