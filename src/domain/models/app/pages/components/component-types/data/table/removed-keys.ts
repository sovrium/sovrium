/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
 * calendar mappings that only served the switcher, its own grouping, and the
 * toolbar's saved-views menu, density toggle, column toggle and group-by
 * picker. What a reader does from the toolbar — search, filter, sort — narrows
 * the rows for one visit and is stored nowhere.
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

/** Keys removed from a `type: table` component itself. */
const REMOVED_ON_TABLE: ReadonlyMap<string, string> = new Map([
  [
    'views',
    '`views` has been removed: a table component no longer switches between a grid, a board, a calendar and a gallery. Each is its own component — add a `kanban`, `calendar` or `gallery` beside the grid, each with its own `dataSource`. A lasting filter, sort, grouping or field selection is one of the table’s `views[]`, bound with `dataSource.view`.',
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
    '`dateField` has been removed from `table`: it only served the switched-in calendar. Declare a `calendar` component bound to the same table (or view) and set `dateField` there.',
  ],
  [
    'groupBy',
    '`groupBy` has been removed from `table`. Grouping is configuration on the table: declare `groupBy` on one of its `views[]` (it takes `thenBy` and `collapsed` too) and bind the grid to it with `dataSource.view`.',
  ],
])

/** Keys removed from a `table` component's `toolbar`. */
const REMOVED_ON_TOOLBAR: ReadonlyMap<string, string> = new Map([
  [
    'viewSwitcher',
    '`toolbar.viewSwitcher` has been removed: a board, a calendar and a gallery are separate components. Add a `kanban`, `calendar` or `gallery` beside the grid, each with its own `dataSource`.',
  ],
  [
    'views',
    '`toolbar.views` has been removed: readers no longer save views. A lasting way of looking at the table is one of its `views[]`, declared in the config and bound with `dataSource.view`.',
  ],
  [
    'columnToggle',
    '`toolbar.columnToggle` has been removed. The fields a grid shows are its `columns`, or the `fields` of the view it binds with `dataSource.view`.',
  ],
  [
    'density',
    '`toolbar.density` has been removed. Set the row height once with the grid’s `rowHeight`.',
  ],
  [
    'groupBy',
    '`toolbar.groupBy` has been removed: readers no longer regroup a grid. Declare `groupBy` on one of the table’s `views[]` and bind the grid to it with `dataSource.view`.',
  ],
])

/**
 * The migration message for a removed table key, or `undefined` when this
 * module has nothing to say about it.
 *
 * @param path - Dotted path of the NODE holding the key, e.g.
 *   `pages[0].components[2]` or `pages[0].components[2].toolbar`.
 * @param discriminant - The node's `type` literal when it has one (`table`).
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedTableKey = (
  path: string,
  discriminant: string | undefined,
  key: string
): string | undefined => {
  if (discriminant === 'table') return REMOVED_ON_TABLE.get(key)
  if (discriminant === undefined && /components\[\d+\]\.toolbar$/.test(path)) {
    return REMOVED_ON_TOOLBAR.get(key)
  }
  return undefined
}

/** Every removed key, for the test that pins each message names a destination. @internal */
export const REMOVED_TABLE_KEYS = {
  table: [...REMOVED_ON_TABLE.keys()],
  toolbar: [...REMOVED_ON_TOOLBAR.keys()],
} as const
