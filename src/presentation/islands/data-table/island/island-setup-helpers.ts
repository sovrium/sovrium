/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'

/**
 * The `?groupBy=` value for one grid: every grouping level, outermost first.
 *
 * All levels ride ONE parameter. A nested group's count has no answer in a
 * response keyed by a single field, and asking once per level would let the
 * answers disagree about the view they describe. A one-level grid produces the
 * bare field name it always sent.
 */
export function buildGroupByParam(groupBy: ViewGroupBy | undefined): string | undefined {
  if (!groupBy) return undefined
  return [groupBy.field, ...(groupBy.thenBy ?? []).map((level) => level.field)].join(',')
}

/** The `(field, displayField)` pairs a grid's columns name, in column order. */
function columnDisplayFields(
  columns: readonly DataTableColumn[] | undefined
): readonly (readonly [string, string])[] {
  return (columns ?? []).flatMap((column) =>
    'field' in column && typeof column.displayField === 'string' && column.displayField !== ''
      ? [[column.field, column.displayField] as const]
      : []
  )
}

/**
 * The `?labels=` value for one grid: `field:relatedField` for every column that
 * names the field of the related table it shows.
 *
 * The server resolves each pair under the reader's permissions and adds the
 * label under `_display`, beside the stored key, which is what the relationship
 * cell already renders. Absent when no column names one, so such a grid sends
 * exactly the request it always sent.
 */
export function buildLabelsParam(
  columns: readonly DataTableColumn[] | undefined
): string | undefined {
  const pairs = columnDisplayFields(columns)
  return pairs.length === 0
    ? undefined
    : pairs.map(([field, label]) => `${field}:${label}`).join(',')
}

/**
 * `fieldMeta` with each column's `displayField` laid over the field's own.
 *
 * The picker searches and labels its candidates by `edit.displayField`; a
 * column that shows `channels.name` has to search on `name` too, or the reader
 * types the word the cell shows and the picker matches nothing. The table-level
 * value stays the default for every field no column overrides.
 */
export function withColumnDisplayFields(
  fieldMeta: FieldMetaMap | undefined,
  columns: readonly DataTableColumn[] | undefined
): FieldMetaMap | undefined {
  const pairs = columnDisplayFields(columns)
  if (fieldMeta === undefined || pairs.length === 0) return fieldMeta
  const overrides = pairs.flatMap(([field, displayField]) => {
    const meta = fieldMeta[field]
    return meta === undefined
      ? []
      : [[field, { ...meta, edit: { ...meta.edit, displayField } }] as const]
  })
  return { ...fieldMeta, ...Object.fromEntries(overrides) }
}

/**
 * Ordered list of editable field names from explicit column config.
 * Used by auto-save Tab navigation to find the next editable cell.
 *
 * It reads the SAME `editable` the column defs read, because the
 * permission-derived default is already resolved into `columnConfig` at the
 * island boundary. Re-deriving it here would let Tab navigation and
 * double-click disagree about which cells can be edited.
 */
export function resolveEditableFields(
  columnConfig: readonly DataTableColumn[] | undefined
): readonly string[] {
  if (!columnConfig) return []
  return columnConfig
    .filter((col): col is Extract<DataTableColumn, { field: string }> => 'field' in col)
    .filter((col) => col.editable === true)
    .map((col) => col.field)
}

/**
 * Resolved save-indicator settings for the data-table view.
 *
 * `show` defaults to true when `autoSave` is configured (saveMode auto/onBlur)
 * unless explicitly disabled; `position` defaults to `inline`.
 */
export interface SaveIndicatorSettings {
  readonly show: boolean
  readonly position: 'inline' | 'toast' | 'toolbar'
}

/**
 * Derive whether (and where) to show the save status indicator.
 *
 * Returns `undefined` when the component has no auto-save behavior, since the
 * indicator only ever reports on auto-save / onBlur persistence.
 */
export function resolveSaveIndicator(
  autoSaveConfig: AutoSaveConfig | undefined
): SaveIndicatorSettings | undefined {
  if (!autoSaveConfig) return undefined
  const mode = autoSaveConfig.saveMode ?? 'manual'
  if (mode === 'manual') return undefined
  // Default: indicator on for auto/onBlur unless explicitly disabled.
  const show = autoSaveConfig.showSaveIndicator !== false
  return { show, position: autoSaveConfig.saveIndicatorPosition ?? 'inline' }
}

/**
 * Whether this grid sorts its own rows instead of asking the server to.
 *
 * TWO conditions, and each excludes a different way a browser-side sort lies.
 *
 * 1. **A system source.** The records API honours `?sort=` on every DB-table
 *    grid, so those have a server that sorts and need nothing here — which is
 *    also what keeps this unable to reach them. A system read endpoint is the
 *    only binding where `?sort=` may be received and ignored, and the
 *    catalogue's own specimen endpoint is exactly that: it returns a
 *    compile-time fixture in authored order, whatever it is asked for.
 * 2. **The whole result set is loaded.** A page is not a view. Sorting the
 *    rows in hand and labelling the header `ascending` would tell the reader
 *    they are looking at the smallest values in the source when they are
 *    looking at the smallest values on their screen — a wrong answer delivered
 *    with the same confidence as a right one, which is worse than the inert
 *    header this replaces.
 *
 * An endpoint that DOES sort is unharmed: it keeps receiving `?sort=`, returns
 * its rows already in order, and the model re-sorts them by the same key to
 * the same order.
 */
export function resolveClientSorted(
  isSystemSource: boolean,
  loadedRows: number,
  totalRecords: number
): boolean {
  return isSystemSource && loadedRows >= totalRecords
}
