/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CSV exports of tools that HAVE a schema but do not put it in the file:
 * a Zapier Tables download and a Webflow CMS collection export. Each is read
 * as a grid through the shared inference, with the tool's own id and system
 * columns taken out, and the report told what the file could not carry.
 *
 * ## Zapier Tables (pinned under `[internal ref]`)
 *
 * - The first three columns are `tables_record_id` (the record id),
 *   `tables_created_at` and `tables_updated_at` (facts c7): the id keys the
 *   records, the creation instant is kept, the edit instant is dropped.
 * - Dates are written in the field's DISPLAY format, a two-digit year
 *   (`10/01/26`, facts c6). A column whose every value is such a date is
 *   rewritten to ISO dates before inference: day first when any value's first
 *   part is past 12, month first otherwise (the captured default), and the
 *   report says which order was read.
 * - Booleans `True`/`False` and numbers `12.0` are read by the shared
 *   inference as they are.
 * - A linked record is written as its display text (facts c5, unverified), and
 *   the file holds one table only, so a link is kept as that text; hidden
 *   fields and filtered records are not in the download at all (facts c2).
 *
 * ## Webflow CMS collection CSV (pinned under `[internal ref]`)
 *
 * - `Item ID` keys the records (facts f2); `Collection ID` and `Locale ID` are
 *   dropped. The other system columns are kept as ordinary columns, because
 *   their names are not documented (facts f3).
 * - The file carries no field types (facts f6), references are written as
 *   text (f4), so every type is inferred and every reference stays text. The
 *   Data API fetch (`webflow:<siteId>`) is the typed path.
 */

import { adaptTabularGrid, type TableAdapterResult } from './tabular-adapter-service'
import type { ImportReport } from './import-report'
import type { RawCell } from './inferred-types-service'

type Grid = readonly (readonly RawCell[])[]
type Note = ImportReport['unmapped'][number]

/** The system columns a Zapier Tables download starts with. */
export const ZAPIER_TABLES_SYSTEM_HEADERS = [
  'tables_record_id',
  'tables_created_at',
  'tables_updated_at',
] as const

/** The column a Webflow collection export keys its items by. */
export const WEBFLOW_ITEM_ID_HEADER = 'Item ID'

/** Whether a header row is a Zapier Tables download's. */
export const isZapierTablesHeader = (header: readonly string[]): boolean =>
  ZAPIER_TABLES_SYSTEM_HEADERS.every((name, index) => header[index]?.trim() === name)

/** Whether a header row is a Webflow collection export's. */
export const isWebflowCollectionHeader = (header: readonly string[]): boolean =>
  header.some((name) => name.trim() === WEBFLOW_ITEM_ID_HEADER) &&
  header.some((name) => name.trim() === 'Collection ID')

const SHORT_DATE = /^(\d{2})\/(\d{2})\/(\d{2})$/

const text = (cell: RawCell): string => (typeof cell === 'string' ? cell.trim() : '')

/** The date order a column of short dates is read in, or `undefined` when it is not one. */
const shortDateOrder = (values: readonly string[]): 'month-first' | 'day-first' | undefined => {
  const present = values.filter((value) => value !== '')
  const parts = present.map((value) => SHORT_DATE.exec(value))
  if (present.length === 0 || parts.some((match) => match === null)) return undefined
  const firsts = parts.map((match) => Number(match?.[1]))
  const seconds = parts.map((match) => Number(match?.[2]))
  if (firsts.some((part) => part > 12))
    return seconds.every((part) => part <= 12) ? 'day-first' : undefined
  return seconds.every((part) => part <= 31) ? 'month-first' : undefined
}

/** A short display date as an ISO date (`YYYY-MM-DD`), in the given order. */
const isoOf = (value: string, order: 'month-first' | 'day-first'): string => {
  const match = SHORT_DATE.exec(value)
  if (match === null) return value
  const [, first = '', second = '', year = ''] = match
  const [month, day] = order === 'month-first' ? [first, second] : [second, first]
  return `20${year}-${month}-${day}`
}

/** The Zapier grid with its short-date columns rewritten, and the order each was read in. */
const withIsoDates = (
  grid: Grid
): { readonly grid: Grid; readonly dated: readonly (readonly [string, string])[] } => {
  const [header = [], ...rows] = grid
  const orders = header.map((_unused, index) => shortDateOrder(rows.map((row) => text(row[index]))))
  return {
    grid: [
      header,
      ...rows.map((row) =>
        row.map((cell, index) => {
          const order = orders[index]
          return order === undefined || text(cell) === '' ? cell : isoOf(text(cell), order)
        })
      ),
    ],
    dated: header.flatMap((name, index) => {
      const order = orders[index]
      return order === undefined ? [] : [[text(name), order] as const]
    }),
  }
}

const note = (source: string, reason: string, fallback?: string): Note => ({
  domain: 'tables',
  source,
  kind: 'other',
  reason,
  ...(fallback === undefined ? {} : { fallback }),
})

/** A Zapier Tables CSV download as one canonical table. */
export const adaptZapierTablesCsv = (name: string, grid: Grid): TableAdapterResult => {
  const converted = withIsoDates(grid)
  const read = adaptTabularGrid('zapier-tables', name, converted.grid, {
    idHeader: 'tables_record_id',
    createdAtHeader: 'tables_created_at',
    dropHeaders: ['tables_updated_at'],
  })
  return {
    ...read,
    notes: [
      note(
        `${name} (Zapier Tables download)`,
        'A Zapier Tables download holds no field types: each column was typed from its values.',
        'inferred types'
      ),
      note(
        `${name} linked records`,
        'Zapier Tables writes a linked record as its display text, and the download holds one table: a linked-record column is kept as that text, not as a link.',
        'display text'
      ),
      note(
        `${name} hidden fields and filtered records`,
        'A Zapier Tables download holds only the fields and records the table showed when it was downloaded; hidden fields and filtered-out records are not in it.'
      ),
      ...converted.dated.map(([column, order]) =>
        note(
          `${name}.${column}`,
          `Zapier Tables wrote this date in its display format with a two-digit year; it was read ${order === 'month-first' ? 'month first' : 'day first'}, in the 2000s.`,
          'date'
        )
      ),
    ],
  }
}

/** A Webflow CMS collection CSV export as one canonical table. */
export const adaptWebflowCollectionCsv = (name: string, grid: Grid): TableAdapterResult => {
  // Typed as a CSV: the file carries none of the types Webflow's own table maps.
  const read = adaptTabularGrid('csv', name, grid, {
    idHeader: WEBFLOW_ITEM_ID_HEADER,
    dropHeaders: ['Collection ID', 'Locale ID'],
  })
  return {
    ...read,
    notes: [
      note(
        `${name} (Webflow collection CSV)`,
        'A Webflow collection CSV holds no field types: each column was typed from its values. Fetch the site with `sovrium import fetch webflow:<siteId>` for the typed fields.',
        'inferred types'
      ),
      note(
        `${name} references`,
        'A Webflow collection CSV writes Reference and Multi-reference fields as text, so they are kept as text, not as links.',
        'text'
      ),
    ],
  }
}
