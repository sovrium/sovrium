/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * How a `table` occupies the space its parent gives it.
 *
 * ─── WHY THIS IS ONE KEY AND NOT FOUR ──────────────────────────────────────
 *
 * "The table owns the scroll" is a single behaviour with four inseparable
 * consequences, and a config author who gets three of them has a broken grid
 * rather than a grid that is merely half dressed:
 *
 * 1. the component fills the remaining height of its parent instead of taking
 *    its natural height;
 * 2. the ROWS scroll, inside the component, rather than the page scrolling;
 * 3. the header row stays pinned at the top of that scroll, because a column
 *    head that scrolls away turns every row below the fold into unlabelled
 *    values;
 * 4. the pagination bar is pinned to the bottom edge of the component, because
 *    a pager reachable only by scrolling past every row is a pager nobody uses
 *    on the page that has enough rows to need one.
 *
 * Splitting these into one flag per consequence — one flag to pin the header,
 * another to pin the pager, and a height option beside them — would let an
 * author pin a header on a component that owns no scroll container, where it
 * pins to nothing and silently does nothing. One key means the four move
 * together or not at all.
 *
 * ─── WHAT `fill` REQUIRES OF THE PAGE ──────────────────────────────────────
 *
 * `fill` is a contract about how the table behaves INSIDE a bounded parent; it
 * does not create the bound. A page that wants a filling grid gives it an
 * ancestor with a resolved height laid out as a flex column that hides its own
 * overflow, and every flex child between that ancestor and the table must be
 * allowed to shrink below its content. Today that is an ordinary `container`
 * carrying those utility classes; the class names themselves are deliberately
 * not spelled here, because class-shaped text in a `src/` comment is harvested
 * into the CSS candidate corpus and would ship a rule for a selector no page
 * uses. In an unbounded, ordinary flowing document `fill` degrades to the
 * natural height rather than collapsing to zero, so a misconfigured page loses
 * the pinning, not the data.
 *
 * ─── THE DEFAULT IS THE OLD BEHAVIOUR, DELIBERATELY ────────────────────────
 *
 * Omitted means `flow`, which is what every config written before this key
 * existed already renders: the table takes its natural height, the rows extend
 * the page, and the page scrolls. `fill` is opt-in per component — a grid is
 * the right shape for a console surface whose whole job is one dataset, and the
 * wrong shape for a marketing page that stacks a short table between two text
 * blocks.
 */
export const DataTableLayoutSchema = Schema.Literals(['flow', 'fill']).annotate({
  title: 'Table Layout',
  description:
    "How the table occupies its parent. 'flow' (default) takes the table's natural height and lets the page scroll. 'fill' makes the table fill the remaining height of a bounded parent and own its own scroll: the rows scroll inside the component, the header row stays pinned to the top of that scroll, and the pagination bar is pinned to the bottom edge. 'fill' needs an ancestor with a resolved height; in an ordinary flowing document it degrades to the natural height.",
  examples: ['fill'],
})

/** The decoded value of {@link DataTableLayoutSchema}. */
export type DataTableLayout = Schema.Schema.Type<typeof DataTableLayoutSchema>
