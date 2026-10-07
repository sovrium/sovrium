/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optBool } from '../../../shared-schemas'

/**
 * Toolbar control visibility flags.
 *
 * ─── WHAT A TOOLBAR MAY OFFER ──────────────────────────────────────────────
 *
 * Only controls whose effect is TRANSIENT: search, the filter builder and the
 * sort builder narrow what this reader sees until the page is left, and are
 * stored nowhere — not on the server, not in the browser. Export and refresh act
 * on what is on screen.
 *
 * Nothing a reader could SAVE lives here — no saved-views menu (`views`),
 * view-type switcher (`viewSwitcher`), column-visibility panel
 * (`columnToggle`), density toggle (`density`) or runtime group-by picker
 * (`groupBy`). A lasting way of looking at a table is
 * configuration, declared once as one of the table's `views[]` and bound by
 * `dataSource.view`; a board, a calendar and a grid of the same records are
 * three components. Each of those keys is refused at load with a message naming
 * that replacement.
 *
 * @example
 * ```yaml
 * toolbar:
 *   search: true
 *   filters: true
 *   export: true
 * ```
 */
export const DataTableToolbarSchema = Schema.Struct({
  /** Show global search input */
  search: optBool(
    'Show a search box. What the reader types narrows the rows until they leave the page and is stored nowhere.'
  ),
  /** Show filter builder UI */
  filters: optBool(
    'Show the filter builder. Filters the reader adds narrow the rows until they leave the page and are stored nowhere.'
  ),
  /** Show sort builder UI */
  sort: optBool(
    'Show the sort builder. A sort the reader picks orders the rows until they leave the page and is stored nowhere.'
  ),
  /** Show CSV/JSON export button */
  export: optBool('Show export button'),
  /** Show manual refresh button */
  refresh: optBool('Show refresh button'),
}).annotate({
  title: 'Data Table Toolbar',
  description:
    'Toolbar controls. Search, filters and sort narrow the rows for the current visit only and are never saved; a lasting filter, sort, grouping or field selection is one of the table’s views, bound with dataSource.view.',
})

export type DataTableToolbar = Schema.Schema.Type<typeof DataTableToolbarSchema>
