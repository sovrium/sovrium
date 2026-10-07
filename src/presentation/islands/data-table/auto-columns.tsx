/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveDisplayLabel } from '@/presentation/design/field-display'
import { readDisplayLabel } from '../runtime/record-display-label'
import { FIELD_TYPE_TO_CELL_RENDERER } from './cell-renderer-registry'
import { buildCellFieldOptions, buildButtonCellRenderer } from './formatting'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { DataTableCellContext, DataTableColumnDef } from './island/table-features'
import type { TableRecord } from '../runtime/types'

/**
 * Columns the grid generates when the author declares none: one per field of
 * the bound table, or per key of the first row, each with the renderer its
 * field type asks for.
 */

/**
 * Builds a read-only cell renderer for an auto-generated column when the
 * field-type has a dedicated chrome (user pill, status pill, JSON preview,
 * …). Returns undefined when the field-type falls through to TanStack
 * Table's `String(value)` default — caller omits the `cell` key.
 */
function buildAutoCellRenderer(
  field: string,
  options: AutoColumnOptions
): ((ctx: DataTableCellContext) => React.ReactNode) | undefined {
  const { fieldMeta } = options
  // A button field is an action, not a readout — it takes precedence over the
  // value-rendering path below, which would render its (always absent) value.
  const buttonRenderer = buildButtonCellRenderer(field, options)
  if (buttonRenderer) return buttonRenderer

  const fieldType = fieldMeta?.[field]?.type
  if (!fieldType) return undefined
  const renderer = FIELD_TYPE_TO_CELL_RENDERER[fieldType]
  if (!renderer) return undefined
  const fieldOptions = buildCellFieldOptions(fieldMeta?.[field], options.locale)
  return ({ getValue, row }: DataTableCellContext) =>
    renderer({ value: readDisplayLabel(row.original, field) ?? getValue(), fieldOptions })
}

/**
 * Shared options for the two auto-column generators. Bundled rather than
 * passed positionally because the pair already sat at the four-parameter cap.
 *
 * `tableName` is what lets an automation button in an auto-generated column
 * address its own invoke endpoint.
 */
export interface AutoColumnOptions {
  /**
   * The active page locale (`<html lang>` ← `meta.lang`), so a generated
   * column's dates read like a declared column's on the same page.
   */
  readonly locale: string
  /**
   * Opts every generated column into inline double-click editing — used by
   * `refreshMode: 'realtime'` data tables, which are inline-editable by
   * default so optimistic updates can be exercised.
   */
  readonly editable?: boolean
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  /** Re-reads the rows after a button run that may have written to one. */
  readonly onButtonInvoked?: () => void
}

/** The column def shared by both auto-generation paths. */
function buildAutoColumn(field: string, options: AutoColumnOptions): DataTableColumnDef {
  const cellRenderer = buildAutoCellRenderer(field, options)
  // A button column's header is the button's own label — `ship_button` is a
  // config identifier, not something to show a reader. Otherwise the field's
  // declared `label`, then the RAW name verbatim (never humanized: that would
  // restyle every heading in every already-shipped app with no config edit).
  const meta = options.fieldMeta?.[field]
  const header = meta?.button?.label ?? resolveDisplayLabel(undefined, meta?.label, field)
  return {
    accessorKey: field,
    header,
    enableSorting: true,
    meta: {
      field,
      ...(options.editable === true && meta?.readOnly !== true && { editable: true }),
    },
    ...(cellRenderer && { cell: cellRenderer }),
  } satisfies DataTableColumnDef
}

/**
 * Auto-generates column defs from record keys when no explicit columns provided
 */
export function autoGenerateColumns(
  records: readonly TableRecord[],
  options: AutoColumnOptions
): readonly DataTableColumnDef[] {
  const firstRecord = records[0]
  if (!firstRecord) return []
  // Record keys come from the database, and a button field has no column
  // there — so append the table's button fields, which would otherwise never
  // reach this path at all.
  const buttonFields = Object.keys(options.fieldMeta ?? {}).filter(
    (name) => options.fieldMeta?.[name]?.button && !(name in firstRecord)
  )
  return [...Object.keys(firstRecord), ...buttonFields].map((key) => buildAutoColumn(key, options))
}

/**
 * Auto-generates column defs from table field names when no records are available.
 * Used as a fallback when the table is empty and no explicit columns are configured.
 */
export function autoGenerateColumnsFromFields(
  fields: readonly string[],
  options: AutoColumnOptions
): readonly DataTableColumnDef[] {
  return fields.map((field) => buildAutoColumn(field, options))
}
