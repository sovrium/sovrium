/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import { coerceFieldValues, createRecord } from './create-record-data'
import { withColumnDisplayFields } from './island-setup-helpers'
import type { DataTableIslandProps } from './island-props'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { DataTableRowClickAction } from '../body'
import type {
  DataTableColumn,
  DataTableToolbar,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The data-table island's entry wiring: how its props map onto the setup and
 * paste-import hooks, which bindings may write, and the create-record flow.
 */

/**
 * Platform-default (English) control labels. The SSR host normally supplies the
 * language-resolved strings; these only cover a host that mounts the island
 * without them.
 */
export const DEFAULT_SAVE_LABEL = 'Save'
export const DEFAULT_CANCEL_LABEL = 'Cancel'

/**
 * A system-source data-table is read-only: its rows come from a named read
 * endpoint (`dataSource.system`), not a declared DB table. This single
 * derivation drives every DB-table-only feature gate (writes / realtime / CSV
 * import) so the read-only posture is decided in ONE place rather than
 * scattered across the wiring.
 */
function isSystemSourceBinding(props: DataTableIslandProps): boolean {
  return props.dataSource.system !== undefined
}

/**
 * Whether the grid may write at all. A system source has no table to write to,
 * and a grid its author declared `readOnly` is a reading for every reader.
 * A view-bound grid reads through a projection of a table, and its writes go
 * to that table's records — gated by the reader's grants, as on any grid.
 */
export function isReadOnlyBinding(props: DataTableIslandProps): boolean {
  return isSystemSourceBinding(props) || props.readOnly === true
}

/**
 * A view-bound grid's toolbar with export switched off. The export route is
 * the TABLE's, gated on the table's own read grant — which a visitor on a
 * public view does not hold — so the affordance would only ever answer 401.
 */
export function withViewBoundToolbar(props: DataTableIslandProps): DataTableToolbar | undefined {
  return props.isViewBound === true && props.toolbar?.export === true
    ? { ...props.toolbar, export: false }
    : props.toolbar
}

/**
 * Resolves the documented default of `ColumnSchema.editable` — "default: from
 * table permissions" — once, at the island boundary,
 * by stamping `editable: true` onto the columns entitled to it.
 *
 * Resolving here rather than at each point of use is what keeps double-click
 * editing and Tab navigation agreeing about which cells are editable: both read
 * the same `columnConfig`, so neither can derive a different answer.
 *
 * Only a column that declares NO `editable` is touched, which is the whole
 * resolution order:
 *
 *   1. explicit `false` — the author's opt-OUT, which survives a table granting
 *      `update`
 *   2. explicit `true`  — the author's opt-IN, which survives a table that does
 *      not
 *   3. otherwise the permission-derived default
 *   4. otherwise closed — every gate downstream tests `editable === true`, so an
 *      unresolved column cannot open an editor
 */
function withPermissionEditableDefault(
  columns: readonly DataTableColumn[] | undefined,
  permissionEditable: boolean
): readonly DataTableColumn[] | undefined {
  if (!columns || !permissionEditable) return columns
  return columns.map((col) =>
    'field' in col && col.editable === undefined ? { ...col, editable: true } : col
  )
}

/**
 * Whether this grid may take the permission-derived inline-edit default, and the
 * three states it deliberately falls closed on.
 *
 * A system source is read-only — there is no records table to write to —
 * mirroring the create affordance's own system-source gate.
 *
 * The other two mirror `rowIsClickable` in `data-row.tsx` verbatim
 * (`hasRowAction || selectionMode === 'single'`), because that is the exact
 * condition under which an editable cell STOPS a click from reaching its row
 * (rule R1). R1 is right for editability the author DECLARED: writing
 * `editable: true` beside `onRowClick` is knowingly accepting the trade. It is
 * wrong for editability merely DERIVED from a permission, where the author asked
 * for a clickable row and never asked for editing at all — swallowing that click
 * would break row-click navigation and single-row
 * selection on every grid whose table grants `update`.
 * A declared `editable` still wins either way; only the DEFAULT yields.
 */
function permissionEditableAllowed(props: DataTableIslandProps): boolean {
  return (
    props.canUpdate === true &&
    !isReadOnlyBinding(props) &&
    props.onRowClick === undefined &&
    props.selection?.mode !== 'single'
  )
}

/** Maps island props to the parameter bag {@link useDataTableIslandSetup} expects. */
export function toSetupParams(props: DataTableIslandProps) {
  return {
    dataSource: props.dataSource,
    columnConfig: withPermissionEditableDefault(props.columns, permissionEditableAllowed(props)),
    isViewBound: props.isViewBound === true,
    paginationConfig: props.pagination,
    searchConfig: props.search,
    selectionConfig: props.selection,
    toolbarConfig: withViewBoundToolbar(props),
    initialRowHeight: props.rowHeight ?? 'medium',
    searchSourceId: props.searchSourceId,
    tableFields: props.tableFields,
    fieldMeta: props.fieldMeta,
    groupByConfig: props.groupBy,
    summaryConfig: props.summary,
    showRowNumbers: props.showRowNumbers,
    bordered: props.bordered ?? false,
    autoSaveConfig: props.autoSave,
    saveLabel: props.saveLabel ?? DEFAULT_SAVE_LABEL,
    cancelLabel: props.cancelLabel ?? DEFAULT_CANCEL_LABEL,
  }
}

/** Maps island props to the parameter bag {@link usePasteImport} expects. */
export function toPasteParams(
  props: DataTableIslandProps,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onImported: () => void,
  readOnly: boolean
) {
  return {
    containerRef,
    // System-source grids have no DB table to write to — `table` is absent.
    tableName: props.dataSource.table ?? '',
    tableFields: props.tableFields ?? [],
    fieldMeta: props.fieldMeta,
    onImported,
    enabled: !readOnly,
  }
}

/**
 * Narrow the schema-level `onRowClick` (any action variant) down to the
 * shapes the data-table row-click handler consumes:
 *
 * - `navigate` — `{ type: 'navigate', path: <string>, openInNewTab? }`
 * - `openDrawer` — `{ action: 'openDrawer', component: <drawer-id> }`
 *   discriminated by `action` (not `type`) per the OpenDrawerActionSchema.
 *
 * Returns `undefined` for unknown / unsupported variants so the row-click
 * handler remains a no-op rather than crashing on a malformed payload.
 */
export function resolveRowClickAction(
  action: DataTableIslandProps['onRowClick']
): DataTableRowClickAction | undefined {
  if (!action) return undefined
  if (action.type === 'navigate' && typeof action.path === 'string') {
    return action.openInNewTab === true
      ? { type: 'navigate', path: action.path, openInNewTab: true }
      : { type: 'navigate', path: action.path }
  }
  if (action.action === 'openDrawer' && typeof action.component === 'string') {
    return { type: 'openDrawer', component: action.component }
  }
  return undefined
}

/**
 * Toolbar create-record flow: the `creating` modal
 * toggle plus the open / cancel / submit callbacks. On submit we POST only the
 * filled fields (untouched fields would 500 typed columns), coercing each value
 * to its column's JSON type (numeric columns as numbers, not `"42"`) via
 * `fieldMeta` so a typed column never 500s on create, and on success close the
 * modal + refresh the grid so the new row shows. Extracted from
 * `DataTableIsland` to keep that component under the complexity cap.
 */
export function useDataTableCreateFlow(
  tableName: string,
  refresh: () => void,
  fieldMeta: FieldMetaMap | undefined
) {
  const [creating, setCreating] = useState(false)
  const fieldTypes = useMemo(
    () =>
      new Map(Object.entries(fieldMeta ?? {}).map(([name, meta]) => [name, meta.type] as const)),
    [fieldMeta]
  )
  const onCreate = useCallback(() => setCreating(true), [])
  const onCancelCreate = useCallback(() => setCreating(false), [])
  const onSubmitCreate = useCallback(
    (values: Record<string, string>) => {
      setCreating(false)
      const filled = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value.trim().length > 0)
      )
      // Coerce each value to the JSON type its column expects (numeric columns as
      // numbers, booleans as booleans) so the POST body matches the records-API
      // contract — a typed column never 500s on an otherwise-valid create.
      const coerced = coerceFieldValues(filled, fieldTypes)
      void createRecord(tableName, coerced).then((ok) => {
        if (ok) refresh()
      })
    },
    [tableName, refresh, fieldTypes]
  )
  return { creating, onCreate, onCancelCreate, onSubmitCreate }
}

/**
 * The island's props with each column's `displayField` merged into `fieldMeta`.
 *
 * Done once, at the entry, so every consumer of `fieldMeta` — the picker, the
 * create dialog, paste-import, the cells — reads the same field meta. Merged
 * into one place rather than re-derived per consumer, which is how two of them
 * would come to search a relationship on different columns.
 */
export function useColumnDisplayFieldMeta(props: DataTableIslandProps): DataTableIslandProps {
  const { fieldMeta: declared, columns } = props
  const fieldMeta = useMemo(() => withColumnDisplayFields(declared, columns), [declared, columns])
  return useMemo(
    () => (fieldMeta === declared ? props : { ...props, fieldMeta }),
    [props, fieldMeta, declared]
  )
}
