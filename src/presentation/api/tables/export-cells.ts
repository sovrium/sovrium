/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * One record as the records program lists it for the export: its readable
 * fields, the envelope the list answers beside them, and the `_display` labels
 * of its links.
 */
export interface ExportRecord {
  readonly id?: unknown
  readonly createdAt?: unknown
  readonly updatedAt?: unknown
  readonly fields: Record<string, unknown>
  readonly _display?: unknown
}

/**
 * The columns every record carries whatever the reader may read: the ones the
 * list answers for a row whose every field is hidden from her. An export names
 * them when asked to, and falls back on them when no field column is left, so
 * it never answers a header-less file of blank lines where the list answered
 * rows.
 */
export const SYSTEM_COLUMNS: readonly string[] = ['id', 'createdAt', 'updatedAt']

type ExportTable = ReturnType<NonNullable<App['tables']>['find']>

/** A system column that no field of the table shadows. */
const isSystemColumn = (column: string, tableColumns: readonly string[]): boolean =>
  SYSTEM_COLUMNS.includes(column) && !tableColumns.includes(column)

/**
 * The export's columns, in order. With `fields=`, the columns it names, in
 * the order it names them, each kept only if it is a column the reader may
 * read or a system column; without it, every readable column. Either way, a
 * selection left with no column falls back on the system columns.
 */
export function orderExportColumns(
  readable: readonly string[],
  tableColumns: readonly string[],
  named: readonly string[] | undefined
): readonly string[] {
  const chosen =
    named !== undefined && named.length > 0
      ? [...new Set(named)].filter(
          (column) => readable.includes(column) || isSystemColumn(column, tableColumns)
        )
      : readable
  return chosen.length > 0 ? chosen : SYSTEM_COLUMNS
}

/** Read a system column off the record envelope. */
export function systemValue(record: ExportRecord, column: string): unknown {
  if (column === 'id') return record.id
  if (column === 'createdAt') return record.createdAt
  return column === 'updatedAt' ? record.updatedAt : undefined
}

/** Names of the table's relationship columns, whose labels ride under `_display`. */
export function relationshipFieldNames(table: ExportTable): ReadonlySet<string> {
  return new Set((table?.fields ?? []).filter((f) => f.type === 'relationship').map((f) => f.name))
}

/**
 * The labels the records API resolved for a link to several records — the
 * names the grid shows — or `undefined` when it resolved none. A CSV is read
 * by a person, who needs the linked records' names where a program needs
 * their ids; the JSON export keeps the ids.
 */
export function toManyLinkLabels(
  record: ExportRecord,
  field: string
): readonly string[] | undefined {
  const display = record._display
  if (typeof display !== 'object' || display === null) return undefined
  const labels = (display as Readonly<Record<string, unknown>>)[field]
  return Array.isArray(labels) && labels.every((label) => typeof label === 'string')
    ? (labels as readonly string[])
    : undefined
}

// Extract raw value from formattedFieldValue (may be plain value or { value, displayValue })
function getRawValue(fv: unknown): unknown {
  if (fv !== null && typeof fv === 'object' && 'value' in (fv as object)) {
    return (fv as { value: unknown }).value
  }
  return fv
}

/**
 * Collapse an enriched attachment value back to the storage key(s) it wraps.
 *
 * An export is a flat data dump, not an API response: the transient signed-URL
 * capability minted on the read path has no business in a CSV cell (where the
 * object would stringify to `[object Object]`) nor in a downloaded JSON file
 * that outlives the token. Scoped to attachment columns so an unrelated `json`
 * column that happens to carry a `key` property is left alone.
 */
function unwrapAttachment(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(unwrapAttachment)
  if (value !== null && typeof value === 'object') {
    const { key } = value as { readonly key?: unknown }
    if (typeof key === 'string') return key
  }
  return value
}

/** Read one exportable cell: unwrap the display envelope, then any enrichment. */
function exportValue(
  fields: Record<string, unknown>,
  fieldName: string,
  attachments: ReadonlySet<string>
): unknown {
  const raw = getRawValue(fields[fieldName])
  return attachments.has(fieldName) ? unwrapAttachment(raw) : raw
}

/**
 * One CSV cell: a system column read off the envelope, a link to several
 * records written as their names, any other field as its export value.
 */
export function csvCellValue(
  record: ExportRecord,
  column: string,
  opts: { readonly attachments: ReadonlySet<string>; readonly links: ReadonlySet<string> }
): unknown {
  if (!(column in record.fields)) return systemValue(record, column)
  return (
    (opts.links.has(column) ? toManyLinkLabels(record, column) : undefined) ??
    exportValue(record.fields, column, opts.attachments)
  )
}

/**
 * One JSON export object: the record named by its id, then its readable
 * fields — those `visibleFields` names, in its order, when it is provided. A
 * link keeps its ids, for a program to follow.
 */
export function jsonExportRow(
  record: ExportRecord,
  opts: {
    readonly attachments: ReadonlySet<string>
    readonly visibleFields?: readonly string[]
    readonly withheld: ReadonlySet<string>
  }
): Record<string, unknown> {
  const { visibleFields } = opts
  const readable = Object.keys(record.fields).filter((k) => !opts.withheld.has(k))
  const keys =
    visibleFields && visibleFields.length > 0
      ? [...new Set(visibleFields)].filter(
          (k) => readable.includes(k) || isSystemColumn(k, Object.keys(record.fields))
        )
      : readable
  return Object.fromEntries([
    ['id', record.id],
    ...keys.map((k) => [
      k,
      k in record.fields ? exportValue(record.fields, k, opts.attachments) : systemValue(record, k),
    ]),
  ])
}
