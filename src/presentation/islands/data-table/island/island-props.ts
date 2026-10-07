/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { GridStrings } from './grid-strings'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableLayout,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSystemSource,
  DataTableToolbar,
  DataTableSummaryItem,
  RowHeight,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'

/** The props the data-table island is mounted with, as the SSR host serialises them. */
export interface DataTableIslandProps {
  /**
   * Accessible name for the grid.
   * Rendered as `aria-label` on the `role="grid"` table so
   * `getByRole('grid', { name })` resolves. Optional — absent for grids that
   * derive their name from surrounding context.
   */
  readonly ariaLabel?: string
  readonly dataSource: {
    /**
     * Bound DB table name. Present for the DB-table binding; ABSENT for a
     * system-source binding (`dataSource.system`), where rows come from a read
     * endpoint instead of a declared table.
     */
    readonly table?: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    /** How many rows the grid shows in all: its page size and pager total stay under it. */
    readonly limit?: number
    /** Data refresh strategy (`'poll'` enables interval re-fetch). */
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    /** Poll interval in milliseconds (used when `refreshMode` is `'poll'`). */
    readonly pollIntervalMs?: number
    /**
     * Cross-component shared-filter binding, DB-table case: `bindTo` references a sibling publisher whose value is merged
     * into the records request as the `sharedFilter.params` when both are present.
     */
    readonly bindTo?: string
    readonly sharedFilter?: { readonly params?: readonly string[] }
    /**
     * System read-endpoint binding:
     * feed the grid from a named read endpoint instead of a DB table. When
     * present, DB-table-only features (record writes, realtime/SSE, CSV
     * import) are gated OFF — sort / filter / search / pagination stay ON
     * (read-only, endpoint/client-side).
     */
    readonly system?: DataTableSystemSource
  }
  readonly columns?: readonly DataTableColumn[]
  readonly pagination?: DataTablePagination
  readonly search?: ComponentSearch
  readonly selection?: DataTableSelection
  readonly toolbar?: DataTableToolbar
  readonly bulkActions?: readonly DataTableBulkAction[]
  readonly striped?: boolean
  /**
   * Field whose declared option colours fill each row — the grid's spelling of
   * the record views' `colorField`.
   */
  readonly rowColorField?: string
  /**
   * `optionValue → #RRGGBB` for the field `rowColorField` names, resolved
   * server-side from `app.tables` (the island only ever sees records).
   */
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  readonly bordered?: boolean
  readonly emptyMessage?: string
  /**
   * Message shown when a client-side search/filter reduces a NON-empty dataset
   * to zero rows — the no-match state, distinct from `emptyMessage` (the
   * zero-record empty state). Rendered in an `aria-live` `role="status"` region;
   * a `{query}` token is substituted with the active search string so the
   * message echoes what was searched. Falls back to `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  readonly showRowNumbers?: boolean
  readonly rowHeight?: RowHeight
  /**
   * How the grid occupies its parent. Omitted (or `flow`) is the natural height
   * the page scrolls past — every grid written before this key existed. `fill`
   * takes the bounded parent's leftover height and, with it, the scroll: the
   * rows move inside the grid, the column heads stay pinned to that movement,
   * and the pager stays at the bottom edge. One value for four consequences,
   * because a grid that gets three of them is broken rather than half dressed.
   */
  readonly layout?: DataTableLayout
  /** `rows` draws each row as a two-line item below the `sm` breakpoint. */
  readonly phoneLayout?: 'scroll' | 'rows'
  /**
   * The grid reads through one of its table's views (`dataSource.view`): the
   * view decides its rows, order, columns and grouping. Writes still go to the
   * table's records, gated by `canCreate` / `canUpdate` exactly as on a
   * table-bound grid; export and live refresh stay off — both are keyed on the
   * TABLE, past the view's columns.
   */
  readonly isViewBound?: boolean
  /**
   * The author declared the grid `readOnly`: no create, no import, no add-row
   * line, no paste and no editor, for every reader. Presentation only.
   */
  readonly readOnly?: boolean
  readonly searchSourceId?: string
  readonly tableFields?: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  /**
   * The bound table's declared `permissions` block, forwarded verbatim.
   *
   * DESCRIPTIVE ONLY — it gates nothing, and must not. A permission answer needs
   * the acting role, which the island never receives; the gate is `canUpdate`
   * below, decided server-side. The type was `{ update?: readonly string[] }`,
   * which could not even represent `update: 'all'`.
   */
  readonly tablePermissions?: Readonly<Record<string, unknown>>
  /**
   * Whether inline editing should be OFFERED by default on this grid
   * — the permission-derived default behind a
   * column's `editable`, computed server-side from the session role and the
   * table's declared `update` grant.
   *
   * Only an explicit `true` enables anything: absent (auth not configured, a
   * system-source binding, or a table declaring no `update` grant) leaves every
   * grid read-only, exactly as today. A column's own `editable` still wins in
   * both directions.
   */
  readonly canUpdate?: boolean
  /**
   * Whether the current role may create records in the bound table
   *. Computed server-side from the session role
   * + the table's `create` permission. When true the toolbar offers the primary
   * "Nouvel enregistrement" create affordance (a modal with one labelled textbox
   * per field that POSTs to `/api/tables/:t/records` and refreshes the grid);
   * when false (or undefined, e.g. auth not configured) the affordance defaults
   * are: false → button ABSENT (anti-enumeration), undefined → button offered
   * (no-auth full-access model).
   */
  readonly canCreate?: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side
   * against the active page language ("New record" default, "Nouvel
   * enregistrement" for French, or an author override). Labels the toolbar
   * create button and the create modal's title/aria-label so they localize.
   * Defaults to the English string when absent.
   */
  readonly newRecordLabel?: string
  /**
   * Interpreter-provided commit / dismiss labels, resolved server-side the same
   * way. They label the create dialog's footer pair and the inline
   * select-editor's commit + cancel pair (an `editSelect.saveLabel` still wins
   * for that one button). Default to the English strings when absent.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
  /**
   * The grid's other interface strings (toolbar, pager, search default,
   * add-row), resolved server-side and sent only where they differ from the
   * English each control is written in — absent on an English page.
   */
  readonly uiStrings?: GridStrings
  /** The bound view's grouping — a grid groups only through a view. */
  readonly groupBy?: ViewGroupBy
  readonly summary?: readonly DataTableSummaryItem[]
  readonly autoSave?: AutoSaveConfig
  /**
   * Row-click action surfaced from the schema's `onRowClick`. The foundation
   * tier consumes two variants:
   *
   * - `{ type: 'navigate', path }` — the path may contain `$record.<field>`
   *   tokens substituted at click time against the clicked row's data.
   * - `{ action: 'openDrawer', component }` — dispatches a
   *   `sovrium:open-drawer` CustomEvent so the named drawer island opens.
   *   Note: discriminated by `action` (not `type`) per the schema.
   *
   * Non-supported variants pass through unchanged but are ignored by the
   * row-click handler.
   */
  readonly onRowClick?:
    | {
        readonly type?: string
        readonly action?: string
        readonly path?: string
        readonly component?: string
        readonly openInNewTab?: boolean
      }
    | undefined
}
