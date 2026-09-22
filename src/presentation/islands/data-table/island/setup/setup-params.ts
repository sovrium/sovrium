/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldMetaMap } from '../../../hooks/use-inline-editing'
import type { SavedViewConfigPayload } from '../../../hooks/use-saved-views'
import type { useDataTableUiState } from '../use-ui-state'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type {
  DataTableColumn,
  DataTableGroupBy,
  DataTablePagination,
  ComponentSearch,
  DataTableSelection,
  DataTableSummaryItem,
  DataTableSystemSource,
  DataTableToolbar,
  RowHeight,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { QueryClient } from '@tanstack/react-query'

export interface IslandSetupParams {
  readonly dataSource: {
    /** Bound DB table name — ABSENT for a system-source binding. */
    readonly table?: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    /** Data refresh strategy (`'poll'` enables interval re-fetch). */
    readonly refreshMode?: 'none' | 'poll' | 'realtime'
    /** Poll interval in milliseconds (used when `refreshMode` is `'poll'`). */
    readonly pollIntervalMs?: number
    /**
     * Cross-component shared-filter binding ([internal ref],
     * DB-table case). `bindTo` references a sibling publisher; when `sharedFilter`
     * is also present, the publisher's value is merged into the records request as
     * the named param(s). Inert without both.
     */
    readonly bindTo?: string
    readonly sharedFilter?: { readonly params?: readonly string[] }
    /**
     * System read-endpoint binding.
     * When present the grid is read-only: rows come from the endpoint, and
     * DB-table-only features (preferences, saved views, realtime, inline edit,
     * crud-success refresh) are skipped. The system source carries its own
     * `bindTo` + `sharedFilter` (the dynamic counterpart to the static `query`).
     */
    readonly system?: DataTableSystemSource
  }
  readonly columnConfig?: readonly DataTableColumn[]
  readonly paginationConfig?: DataTablePagination
  readonly searchConfig?: ComponentSearch
  readonly selectionConfig?: DataTableSelection
  readonly toolbarConfig?: DataTableToolbar
  readonly initialRowHeight: RowHeight
  readonly searchSourceId: string | undefined
  readonly tableFields: readonly string[] | undefined
  readonly fieldMeta: FieldMetaMap | undefined
  readonly groupByConfig: DataTableGroupBy | undefined
  /**
   * Declared footer summary. Drives the whole-view `?aggregate=` request that
   * rides the records fetch — the footer used to reduce over the CURRENT PAGE's
   * records, so every aggregate reported the page rather than the view.
   */
  readonly summaryConfig: readonly DataTableSummaryItem[] | undefined
  /**
   * Whether the grid draws a leading row-number column. Inert until now:
   * declared on the schema, copied by the props builder, copied again into the
   * island's prop type, and then never read.
   */
  readonly showRowNumbers: boolean | undefined
  readonly bordered: boolean
  readonly autoSaveConfig: AutoSaveConfig | undefined
  /**
   * Developer-configured views surfaced from `app.tables[i].views[]` (PG-03 /
   * [internal ref]). These are READ-ONLY: the user can fork them
   * via `Save as new` but cannot overwrite or delete them. The schema's view
   * id is a numeric, but we normalise to string here so the cross-source
   * Views menu can key uniformly.
   */
  readonly tableViews?: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly filters?: SavedViewConfigPayload['filters']
    readonly sorts?: SavedViewConfigPayload['sorts']
    readonly groupBy?: string | null
  }>
  /**
   * Interpreter-provided commit / dismiss labels, resolved server-side against
   * the app language. Reach the action column's inline select-editor and its
   * confirm gate (an `editSelect.saveLabel` still wins for the commit button).
   */
  readonly saveLabel: string
  readonly cancelLabel: string
}

/**
 * What every setup sub-hook needs before it can do anything: the island's own
 * parameters, the shared UI state, the query client, and the two values that
 * decide whether this grid is backed by a DB table at all.
 *
 * Passing one context rather than a widening parameter list is what keeps each
 * sub-hook inside the four-parameter limit, and keeps `isSystemSource` computed
 * once instead of re-derived at every site that branches on it.
 */
export interface SetupContext {
  readonly params: IslandSetupParams
  readonly ui: ReturnType<typeof useDataTableUiState>
  readonly queryClient: QueryClient
  /**
   * A system-source grid reads from an endpoint, not a DB table, so it is
   * read-only: preferences, saved views, realtime, crud-refresh and inline
   * editing are all skipped for it.
   */
  readonly isSystemSource: boolean
  /**
   * The bound DB table, or the empty string for a system source. The prefs and
   * saved-views hooks short-circuit their network reads on an empty key, so no
   * `/api/tables//*` request is ever issued.
   */
  readonly tableKey: string
}
