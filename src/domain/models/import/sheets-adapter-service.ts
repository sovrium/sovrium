/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Google Sheets adapter: a Sheets snapshot in, a `CanonicalBase` out.
 *
 * It reads the files `sovrium import fetch sheets:<spreadsheetId>` wrote,
 * already parsed, by snapshot path:
 *
 * - `raw/spreadsheet.json`: the spreadsheet's sheets, their kind and size, and
 *   the tables (`tables[]`) a sheet declares;
 * - `raw/sheets/<sheetId>/rows-NNNN.json`: one sheet's cells, a block of rows
 *   per file, with their values, number formats and data validation.
 *
 * ONE table per grid sheet, or one per table a sheet declares. The first row
 * is the header and each column is typed by the shared inference
 * (`tabular-adapter-service`), told what the sheet states: a table column's
 * type, a dropdown's choices, a number format, a currency symbol. A stated
 * type is trusted only when every value fits it; a dropdown is always kept,
 * its stray values added as options. A sheet has no record id, so records are
 * keyed by row position unless a column headed `id` holds a distinct value on
 * every row, and the report says so.
 *
 * Named, never invented: a sheet holding a chart, a sheet connected to an
 * external data source, and the formulas whose last values were kept.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { sheetCellOf, type SheetCell } from './sheets-cells-service'
import {
  adaptTabularGrid,
  type DeclaredColumn,
  type TableAdapterResult,
} from './tabular-adapter-service'
import type { CanonicalBase } from './canonical-base'
import type { InferredKind } from './inferred-types-service'

/** The spreadsheet file of a Sheets snapshot. */
export const SHEETS_SPREADSHEET_PATH = 'raw/spreadsheet.json'

const ROWS_PAGE = /^raw\/sheets\/([^/]+)\/rows-\d+\.json$/

/** What the Sheets adapter reads. */
export interface SheetsSnapshot {
  readonly spreadsheetId: string
  /** Every `raw/` JSON file of the snapshot, parsed, by snapshot path. */
  readonly files: ReadonlyMap<string, unknown>
}

type Json = Readonly<Record<string, unknown>>
type Grid = readonly (readonly SheetCell[])[]
type NeverImportable = CanonicalBase['neverImportable'][number]

const objectsOf = (value: unknown): readonly Json[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

const intOf = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback

/** A table column type, as the inference names the kind. */
const COLUMN_TYPES: Readonly<Record<string, InferredKind>> = {
  DOUBLE: 'decimal',
  CURRENCY: 'currency',
  PERCENT: 'percent',
  DATE: 'date',
  TIME: 'time',
  DATE_TIME: 'datetime',
  TEXT: 'text',
  BOOLEAN: 'boolean',
  DROPDOWN: 'list-validation',
}

/** A number format or validation a cell states, as the inference names the kind. */
const CELL_KINDS: Readonly<Record<string, InferredKind>> = {
  DATE: 'date',
  DATE_TIME: 'datetime',
  TIME: 'time',
  PERCENT: 'percent',
  CURRENCY: 'currency',
  TEXT_IS_EMAIL: 'email',
  TEXT_IS_URL: 'url',
  DATE_IS_VALID: 'date',
  ONE_OF_LIST: 'list-validation',
  ONE_OF_RANGE: 'list-validation',
}

const propertiesOf = (sheet: Json): Json =>
  isRecord(sheet['properties']) ? sheet['properties'] : {}

/** One sheet's cells, from every rows file the fetch wrote for it, placed by position. */
const gridOf = (files: ReadonlyMap<string, unknown>, sheetId: string): Grid => {
  const placed = [...files.keys()]
    .filter((path) => ROWS_PAGE.exec(path)?.[1] === sheetId)
    .toSorted()
    .flatMap((path) => {
      const json = files.get(path)
      const sheets = objectsOf(isRecord(json) ? json['sheets'] : undefined)
      const sheet = sheets.find((one) => String(propertiesOf(one)['sheetId']) === sheetId)
      return objectsOf(sheet?.['data']).flatMap((block) =>
        objectsOf(block['rowData']).flatMap((row, rowIndex) =>
          (Array.isArray(row['values']) ? row['values'] : []).map((cell: unknown, column) => ({
            row: intOf(block['startRow'], 0) + rowIndex,
            column: intOf(block['startColumn'], 0) + column,
            cell: sheetCellOf(cell),
          }))
        )
      )
    })
  const cells = new Map(placed.map((one) => [`${String(one.row)}:${String(one.column)}`, one.cell]))
  const rows = Math.max(0, ...placed.map((one) => one.row + 1))
  const columns = Math.max(0, ...placed.map((one) => one.column + 1))
  return Array.from({ length: rows }, (_row, row) =>
    Array.from(
      { length: columns },
      (_column, column) =>
        cells.get(`${String(row)}:${String(column)}`) ?? { value: undefined, formula: false }
    )
  )
}

const choicesOption = (choices: readonly string[]) =>
  choices.length === 0 ? {} : { choices: choices.map((name) => ({ name })) }

/** What a column's body cells state: the first kind any cell states, its choices and symbol. */
const declaredByCells = (cells: readonly SheetCell[]): DeclaredColumn | undefined => {
  const kind = cells
    .map((cell) => CELL_KINDS[cell.validation ?? ''] ?? CELL_KINDS[cell.format ?? ''])
    .find((one) => one !== undefined)
  const choices = cells.find((cell) => cell.choices !== undefined)?.choices ?? []
  const symbol = cells.find((cell) => cell.symbol !== undefined)?.symbol
  const options = {
    ...(kind === 'list-validation' ? choicesOption(choices) : {}),
    ...(symbol === undefined ? {} : { symbol }),
  }
  if (kind === undefined && Object.keys(options).length === 0) return undefined
  return {
    ...(kind === undefined ? {} : { kind }),
    ...(Object.keys(options).length === 0 ? {} : { options }),
  }
}

/** What a declared table states about one column, by its index in the table. */
const declaredByTable = (table: Json): ReadonlyMap<number, DeclaredColumn> =>
  new Map(
    objectsOf(table['columnProperties']).flatMap((column) => {
      const kind = COLUMN_TYPES[String(column['columnType'])]
      if (kind === undefined) return []
      const rule = isRecord(column['dataValidationRule']) ? column['dataValidationRule'] : {}
      const condition = isRecord(rule['condition']) ? rule['condition'] : {}
      const choices = objectsOf(condition['values']).flatMap((value) =>
        typeof value['userEnteredValue'] === 'string' ? [value['userEnteredValue']] : []
      )
      const options = kind === 'list-validation' ? choicesOption(choices) : {}
      return [
        [
          intOf(column['columnIndex'], -1),
          Object.keys(options).length === 0 ? { kind } : { kind, options },
        ] as const,
      ]
    })
  )

interface Region {
  readonly name: string
  readonly grid: Grid
  readonly table?: Json
}

/** A sub-grid: the rows and columns a declared table's range covers. */
const regionOf = (grid: Grid, table: Json): Grid => {
  const range = isRecord(table['range']) ? table['range'] : {}
  const top = intOf(range['startRowIndex'], 0)
  const left = intOf(range['startColumnIndex'], 0)
  const bottom = intOf(range['endRowIndex'], grid.length)
  return grid
    .slice(top, bottom)
    .map((row) => row.slice(left, intOf(range['endColumnIndex'], row.length)))
}

/** The tables of one grid sheet: its declared tables, or the whole sheet. */
const regionsOf = (sheet: Json, grid: Grid): readonly Region[] => {
  const tables = objectsOf(sheet['tables'])
  const title = String(propertiesOf(sheet)['title'] ?? 'Sheet')
  if (tables.length === 0) return [{ name: title, grid }]
  return tables.map((table) => ({
    name: typeof table['name'] === 'string' && table['name'] !== '' ? table['name'] : title,
    grid: regionOf(grid, table),
    table,
  }))
}

const adaptRegion = (region: Region): TableAdapterResult => {
  const [header = [], ...body] = region.grid
  const byTable: ReadonlyMap<number, DeclaredColumn> =
    region.table === undefined ? new Map() : declaredByTable(region.table)
  const declared = header.map(
    (_cell, index) =>
      byTable.get(index) ??
      declaredByCells(body.map((row) => row[index] ?? { value: undefined, formula: false }))
  )
  return adaptTabularGrid(
    'google-sheets',
    region.name,
    region.grid.map((row) => row.map((cell) => cell.value)),
    { declared }
  )
}

/** The formula columns of a region, named once in the report. */
const formulasOf = (region: Region): readonly NeverImportable[] => {
  const [header = [], ...body] = region.grid
  const columns = header.flatMap((cell, index) =>
    body.some((row) => row[index]?.formula === true) ? [String(cell.value ?? '')] : []
  )
  return columns.length === 0
    ? []
    : [
        {
          what: `Formulas in ${region.name}: ${columns.map((name) => `"${name}"`).join(', ')}`,
          reason:
            'Google Sheets formulas are not translated into Sovrium formulas; each cell keeps the value the sheet last computed.',
        },
      ]
}

const isGrid = (sheet: Json): boolean => (propertiesOf(sheet)['sheetType'] ?? 'GRID') === 'GRID'

const NOT_GRID: Readonly<Record<string, string>> = {
  OBJECT: 'This sheet holds a chart or an image, not rows.',
  DATA_SOURCE:
    'This sheet is connected to an external data source; its rows live there, not in the spreadsheet.',
}

/** Read a Google Sheets snapshot into the canonical base: one table per sheet or declared table. */
export const adaptSheetsSnapshot = (snapshot: SheetsSnapshot): TableAdapterResult => {
  const spreadsheet = snapshot.files.get(SHEETS_SPREADSHEET_PATH)
  const json = isRecord(spreadsheet) ? spreadsheet : {}
  const sheets = objectsOf(json['sheets'])
  const regions = sheets
    .filter(isGrid)
    .flatMap((sheet) =>
      regionsOf(sheet, gridOf(snapshot.files, String(propertiesOf(sheet)['sheetId'])))
    )
    .filter((region) => region.grid.length > 0)
  const read = regions.map(adaptRegion)
  const skipped = sheets
    .filter((sheet) => !isGrid(sheet))
    .map((sheet) => ({
      what: `Sheet "${String(propertiesOf(sheet)['title'] ?? '')}"`,
      reason: NOT_GRID[String(propertiesOf(sheet)['sheetType'])] ?? 'This sheet holds no rows.',
    }))
  const title = isRecord(json['properties']) ? json['properties']['title'] : undefined
  return {
    base: {
      tool: 'google-sheets',
      sourceId: snapshot.spreadsheetId,
      name: typeof title === 'string' && title !== '' ? title : snapshot.spreadsheetId,
      tables: read.flatMap((one) => one.base.tables),
      users: [],
      neverImportable: [...skipped, ...regions.flatMap(formulasOf)],
    },
    identities: Object.fromEntries(read.flatMap((one) => Object.entries(one.identities))),
  }
}
