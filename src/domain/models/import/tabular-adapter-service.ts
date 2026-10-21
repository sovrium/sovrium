/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The adapter of the schemaless sources whose input is a grid of cells: a CSV
 * file, a workbook sheet. It turns the grid into one `CanonicalBase` table.
 *
 * - The first row is the header: each column becomes a field named as the
 *   header says, its `sourceType` the kind {@link inferColumnKind} infers.
 * - **Identity.** A column headed `id` whose every row holds a distinct value
 *   is the source's own record id: it keys the records and is not a field of
 *   its own (it becomes `source_id`). Without one, a record is keyed by its row
 *   position (`row-1`, `row-2`, …), which a re-import can only match if the
 *   rows stay in the same order — the report says so.
 * - Every cell is read through {@link stripFormulaGuard} first.
 */

import {
  columnFits,
  convertCell,
  inferColumnKind,
  isEmptyCell,
  stripFormulaGuard,
  type InferredKind,
  type RawCell,
} from './inferred-types-service'
import type { CanonicalBase, CanonicalRecord, CanonicalTable } from './canonical-base'
import type { ImportReport } from './import-report'
import type { ImportSourceTool } from './import-source'

/** How the records of a table are matched on a re-import. */
export type RecordIdentity = 'source-id' | 'row-position'

/** A table-source adapter's result: the base, and how each table's records are keyed. */
export interface TableAdapterResult {
  readonly base: CanonicalBase
  /** Record identity, by table source id. */
  readonly identities: Readonly<Record<string, RecordIdentity>>
  /** What the source's export loses on the way, for the report's `unmapped` list. */
  readonly notes?: ImportReport['unmapped']
}

/** How a tool's export lays out its grid, beyond the header row. */
export interface GridLayout {
  /** The header of the column holding the source's record id (default `id`). */
  readonly idHeader?: string
  /** The header of a column holding when the record was created, read as `createdAt`. */
  readonly createdAtHeader?: string
  /** System columns the tool adds that are not the operator's fields. */
  readonly dropHeaders?: readonly string[]
  /** What the source states about each column, by column index (a Sheets format, a dropdown). */
  readonly declared?: readonly (DeclaredColumn | undefined)[]
}

/**
 * What a source states about one column beyond its values: a kind it declares
 * (a Sheets number format or table column type), and the options its field
 * keeps (a dropdown's choices, a currency symbol).
 */
export interface DeclaredColumn {
  readonly kind?: InferredKind
  readonly options?: Readonly<Record<string, unknown>>
}

/** The header of the id column, compared case-insensitively. */
const ID_HEADER = 'id'

const cellText = (cell: RawCell): string => (isEmptyCell(cell) ? '' : String(cell).trim())

const guarded = (cell: RawCell): RawCell =>
  typeof cell === 'string' ? stripFormulaGuard(cell) : cell

/** The index of the id column, when it holds a distinct value on every row. */
const idColumnOf = (
  header: readonly string[],
  rows: readonly (readonly RawCell[])[],
  idHeader: string
): number | undefined => {
  const index = header.findIndex((name) => name.trim().toLowerCase() === idHeader.toLowerCase())
  if (index === -1 || rows.length === 0) return undefined
  const ids = rows.map((row) => cellText(row[index]))
  return ids.every((id) => id !== '') && new Set(ids).size === ids.length ? index : undefined
}

/**
 * The kind of one column: a declared dropdown as it is (its values may stray
 * from the list), another declared kind when every value fits it, and the
 * inferred kind otherwise.
 */
const kindOf = (declared: DeclaredColumn | undefined, values: readonly RawCell[]): InferredKind => {
  const kind = declared?.kind
  if (kind === 'list-validation') return kind
  return kind !== undefined && columnFits(kind, values) ? kind : inferColumnKind(values)
}

/**
 * A grid as one canonical table.
 *
 * @param tool - `csv` or `xlsx`, recorded on the base.
 * @param name - the table's source name: the file name without its extension, or the sheet name.
 * @param grid - the rows, header first. Rows shorter than the header are padded with empty cells.
 * @param layout - the tool's id and system columns, and what the source states about each
 *   column by index, for an export that is not a plain grid.
 */
export const adaptTabularGrid = (
  tool: Extract<ImportSourceTool, 'csv' | 'xlsx' | 'google-sheets' | 'zapier-tables'>,
  name: string,
  grid: readonly (readonly RawCell[])[],
  layout: GridLayout = {}
): TableAdapterResult => {
  const [headerRow = [], ...body] = grid
  const header = headerRow.map((cell, index) => cellText(cell) || `Column ${String(index + 1)}`)
  const rows = body
    .map((row) => header.map((_unused, index) => guarded(row[index])))
    .filter((row) => row.some((cell) => !isEmptyCell(cell)))
  const idColumn = idColumnOf(header, rows, layout.idHeader ?? ID_HEADER)
  const createdColumn =
    layout.createdAtHeader === undefined ? -1 : header.indexOf(layout.createdAtHeader)
  const dropped = new Set(layout.dropHeaders ?? [])
  const columns = header
    .map((label, index) => ({ label, index }))
    .filter(
      (column) =>
        column.index !== idColumn && column.index !== createdColumn && !dropped.has(column.label)
    )
  const declared = layout.declared ?? []
  const kinds = columns.map((column) =>
    kindOf(
      declared[column.index],
      rows.map((row) => row[column.index])
    )
  )
  const fields = columns.map((column, position) => {
    const options = declared[column.index]?.options
    return {
      sourceId: `col${String(column.index + 1)}`,
      name: column.label,
      sourceType: kinds[position] ?? 'text',
      ...(options === undefined ? {} : { options }),
    }
  })
  const records: readonly CanonicalRecord[] = rows.map((row, rowIndex) => {
    const sourceId =
      idColumn === undefined ? `row-${String(rowIndex + 1)}` : cellText(row[idColumn])
    const values = Object.fromEntries(
      columns.flatMap((column, position) => {
        const value = convertCell(kinds[position] ?? 'text', row[column.index])
        return value === undefined ? [] : [[`col${String(column.index + 1)}`, value] as const]
      })
    )
    const createdAt = createdColumn === -1 ? '' : cellText(row[createdColumn])
    return { sourceId, values, ...(createdAt === '' ? {} : { createdAt }) }
  })
  const table: CanonicalTable = { sourceId: name, name, fields, views: [], records }
  return {
    base: { tool, sourceId: name, name, tables: [table], users: [], neverImportable: [] },
    identities: { [name]: idColumn === undefined ? 'row-position' : 'source-id' },
  }
}
