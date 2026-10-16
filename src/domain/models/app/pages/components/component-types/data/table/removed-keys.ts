/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { removedSearchMessage } from '../../modules/removed-keys'

/**
 * The `table` page-component keys that no longer exist, and what replaces each.
 *
 * ## The decision these messages carry
 *
 * A way of looking at a table is configuration declared ON THE TABLE — one of
 * its `views[]` — never a feature of a page component, and never data a reader
 * saves. Every data component binds either to a view (`dataSource.view`) or
 * directly to the table. So the grid lost everything that let it switch, save
 * or reshape what it shows: the view-type switcher, its labels, the board and
 * calendar mappings that only served the switcher, and its own grouping.
 *
 * Then it lost its controls altogether: the `toolbar` and the `search`
 * box. A control is a page component publishing on a shared-filter channel the
 * grid subscribes to, so one set of controls narrows every data component on
 * the channel. A reader may still regroup, hide a column or change the row
 * height for the visit — grid session state, never saved — but nothing in the
 * config asks for it.
 *
 * ## Why a table of messages rather than an alias
 *
 * The keys are deleted, not aliased: two ways to say one thing is how a config
 * corpus drifts. The trade only pays if the author is told the destination, so
 * each removed key earns a sentence naming it. This is the sibling of
 * `design/removed-keys.ts`, consumed by the same excess-property reporter, and
 * it reaches every decode seam (boot, `sovrium validate`, the `--watch` reload
 * loop) by riding that one shared boundary.
 *
 * ## What a message has to do
 *
 * Name the replacement a reader can write today, in the config they hold open.
 * The test beside this file pins that every message names its destination.
 */

/**
 * What replaced the grid's own toolbar. ONE sentence for the whole key: once
 * `toolbar` is unknown the reporter refuses it as a whole and never reaches a
 * sub-key, so this message also names where every sub-key went — the 0.39
 * controls (search, filters, sort, facets, export, refresh) and the 0.31 ones
 * (view switcher, saved views, column toggle, density, group-by picker).
 */
const TOOLBAR_MESSAGE =
  '`toolbar` has been removed: a grid no longer draws its own controls. Compose them on the page — the library block `block/data-table-toolbar` gives the usual search box, facet, filter bar, Export and New — and subscribe the grid to their channel with `dataSource.bindTo` and `sharedFilter: {}`. A refresh button becomes `dataSource.refreshMode`. The older toolbar keys moved too: a board, a calendar or a gallery is a `kanban`, `event-calendar` or `gallery` component beside the grid; a saved view is one of the table’s `views[]`, bound with `dataSource.view`; the fields shown are the grid’s `columns`; the row height is the grid’s `rowHeight`; a lasting grouping is `groupBy` on one of the table’s `views[]`. A reader may still regroup the grid, hide a column or change the row height for the visit, from the grid itself: that is the grid’s session state, never saved.'

/** Keys removed from a `type: table` component itself. */
const REMOVED_ON_TABLE: ReadonlyMap<string, string> = new Map([
  [
    'views',
    '`views` has been removed: a table component no longer switches between a grid, a board, a calendar and a gallery. Each is its own component — add a `kanban`, `event-calendar` or `gallery` beside the grid, each with its own `dataSource`. A lasting filter, sort, grouping or field selection is one of the table’s `views[]`, bound with `dataSource.view`.',
  ],
  [
    'viewLabels',
    '`viewLabels` has been removed with the view switcher it labelled. A board, a calendar and a gallery are now separate components; give each its own heading.',
  ],
  [
    'kanbanGroupBy',
    '`kanbanGroupBy` has been removed from `table`: it only served the switched-in board. Declare a `kanban` component bound to the same table (or view) and set `kanbanGroupBy` there.',
  ],
  [
    'dateField',
    '`dateField` has been removed from `table`: it only served the switched-in calendar. Declare an `event-calendar` component bound to the same table (or view) and set `dateField` there.',
  ],
  [
    'groupBy',
    '`groupBy` has been removed from `table`. A lasting grouping is configuration on the table: declare `groupBy` on one of its `views[]` (it takes `thenBy` and `collapsed` too) and bind the grid to it with `dataSource.view`. A reader may still regroup the grid for the visit; that grouping is the grid’s session state and is never saved.',
  ],
  ['toolbar', TOOLBAR_MESSAGE],
  ['search', removedSearchMessage('table')],
])

/**
 * The migration message for a removed table key, or `undefined` when this
 * module has nothing to say about it.
 *
 * @param discriminant - The node's `type` literal when it has one (`table`).
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedTableKey = (
  discriminant: string | undefined,
  key: string
): string | undefined => (discriminant === 'table' ? REMOVED_ON_TABLE.get(key) : undefined)

/** Every removed key, for the test that pins each message names a destination. @internal */
export const REMOVED_TABLE_KEYS: readonly string[] = [...REMOVED_ON_TABLE.keys()]
