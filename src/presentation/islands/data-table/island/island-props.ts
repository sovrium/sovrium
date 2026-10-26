/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { GridStrings } from './grid-strings'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { SharedFilterPublisherConfig } from '../../hooks/use-shared-filter-publisher'
import type { InlineExpandConfig } from '../inline-expand/inline-expand-context'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableBulkAction,
  DataTableColumn,
  DataTableLayout,
  DataTablePagination,
  DataTableSelection,
  DataTableSystemSource,
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
    /** The language its translatable fields read in, stamped by the server (`grid-record-language.ts`). */
    readonly lang?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    /** How many rows the grid shows in all: its page size and pager total stay under it. */
    readonly limit?: number
    /** The binding's page size: read when the grid's own `pagination` names none. */
    readonly pagination?: { readonly pageSize?: number }
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
  readonly selection?: DataTableSelection
  readonly bulkActions?: readonly DataTableBulkAction[]
  /** The channel the grid publishes the reader's selected records on. */
  readonly publishes?: SharedFilterPublisherConfig
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
   * What an empty grid bound to a table says when its author wrote no
   * `emptyMessage`: `<Plural> has no records yet`, resolved server-side. Not
   * used while a search is active — a search that matched nothing has not
   * shown the table is empty.
   */
  readonly tableEmptyMessage?: string
  /**
   * What a failed read of a table-bound grid says, naming the table: any
   * failure, and a 404 (the reader may not read it, or it is gone). Resolved
   * server-side; absent on a system source.
   */
  readonly tableReadFailure?: { readonly loadFailed: string; readonly notFound: string }
  /**
   * Message shown when a client-side search/filter reduces a NON-empty dataset
   * to zero rows — the no-match state, distinct from `emptyMessage` (the
   * zero-record empty state). Rendered in an `aria-live` `role="status"` region;
   * a `{query}` token is substituted with the active search string so the
   * message echoes what was searched. Falls back to `emptyMessage` when omitted.
   */
  readonly noMatchMessage?: string
  /**
   * The author's note on what the grid lists: drawn in the bottom bar after the
   * range or the count, and given to the table as its accessible description.
   */
  readonly caption?: string
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
  /** Where Group by, Hide fields and Row height sit (`toolbar`: one View menu above the grid). */
  readonly viewOptions?: 'bottom-bar' | 'toolbar'
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
   * + the table's `create` permission. When true the grid offers its trailing
   * add-row line; false → the line is ABSENT (anti-enumeration), undefined →
   * offered (no-auth full-access model).
   */
  readonly canCreate?: boolean
  /**
   * Whether the current role may delete records in the bound table, computed
   * server-side like {@link canCreate}. When true the selection in the bottom
   * bar offers Delete; false → no Delete at all, undefined → offered (no-auth
   * full-access model).
   */
  readonly canDelete?: boolean
  /**
   * The bound table declares `views[]`: the grid draws its view switcher, whose
   * first entry reads `allLabel` (`All <plural>`, resolved server-side).
   * Absent on a table with no views and on a system source. `defaultView` is the
   * default view the reader may open (`null`: none), resolved server-side from
   * the views the table API lists her; absent when the server could not tell.
   */
  readonly viewSwitcher?: { readonly allLabel: string; readonly defaultView?: string | null }
  /**
   * `rowExpand.placement: inline`: the record each row opens under itself,
   * resolved server-side for this reader. Absent on every other grid.
   */
  readonly rowExpandInline?: InlineExpandConfig
  /**
   * The `onRowClick` is the one `rowExpand` synthesizes to open its panel, not
   * one the author wrote: on a phone it does not justify dropping the action
   * columns. Absent on every other grid.
   */
  readonly rowExpandPanel?: true
  /**
   * Interpreter-provided commit / dismiss labels, resolved server-side the same
   * way. They label the inline select-editor's commit + cancel pair (an `editSelect.saveLabel` still wins
   * for that one button). Default to the English strings when absent.
   */
  readonly saveLabel?: string
  readonly cancelLabel?: string
  /** How the action column draws its actions; `inline` when absent. */
  readonly rowActions?: { readonly display?: 'inline' | 'menu' }
  /**
   * The grid's other interface strings (pager, selection bar,
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
   * - `{ action: 'openSheet', component }` — dispatches a
   *   `sovrium:open-drawer` CustomEvent so the named drawer island opens.
   *   Note: discriminated by `action` (not `type`) per the schema.
   * - `{ type: 'seek', target, time, play? }` — moves a player on the page to
   *   the moment the row names (`time` supports `$record.<field>`).
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
        readonly target?: string
        readonly time?: number | string
        readonly play?: boolean
      }
    | undefined
}
