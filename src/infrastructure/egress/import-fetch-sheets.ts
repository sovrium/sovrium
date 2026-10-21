/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Google Sheets fetcher: one spreadsheet, read through the Sheets API v4
 * (pinned under `[internal ref]`).
 *
 * - `GET /v4/spreadsheets/{id}` with a field mask on the sheets' kind, size
 *   and declared tables (`raw/spreadsheet.json`).
 * - The same endpoint with `ranges` and a field mask on the cells, a block of
 *   {@link ROWS_PER_REQUEST} rows of one sheet at a time, which keeps each
 *   answer under the 2 MB Google recommends
 *   (`raw/sheets/<sheetId>/rows-NNNN.json`). A cell carries its computed
 *   value, its number format, its data validation and its chips: a sheet has
 *   no schema, so these ARE its column types, and the cells are read even
 *   when only the tables are imported.
 *
 * Only `GET` is sent, with an OAuth access token holding the
 * `spreadsheets.readonly` scope. The API pages nothing: a block is returned
 * whole. A `429` names no wait, so the client waits a minute, which is when
 * Google refills the per-minute read quota.
 */

import { Effect } from 'effect'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { fetchSourceJson, type ImportFetchError } from './import-fetch-client'
import { heldOrFetched, type FetchContext, type FetchSummary } from './import-fetch-sink'

/** How Google Sheets is reached, given the operator's OAuth access token. */
export const sheetsTarget = (token: string) => ({
  tool: 'google-sheets',
  realBaseUrl: 'https://sheets.googleapis.com',
  headers: { authorization: `Bearer ${token}` },
  lockoutSeconds: 60,
})

const SPREADSHEET_ID = /^[A-Za-z0-9_-]{20,}$/

/** Why a `sheets:` source is not one the fetcher reads, or `undefined`. */
export const refuseSheetsSource = (id: string): string | undefined =>
  SPREADSHEET_ID.test(id)
    ? undefined
    : `"sheets:${id}" does not name a spreadsheet. Write it sheets:<spreadsheetId>, the id in the sheet's link (docs.google.com/spreadsheets/d/<spreadsheetId>/edit).`

/** Rows per request. */
export const ROWS_PER_REQUEST = 1000

/** The spreadsheet's sheets: their id, title, kind and size, and their declared tables. */
const SPREADSHEET_FIELDS =
  'spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)),tables)'

/** What one block of cells is read with: the value, the format, the validation, the chips. */
const ROWS_FIELDS =
  'sheets(properties(sheetId),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue,effectiveFormat(numberFormat),dataValidation,chipRuns))))'

const SPREADSHEET_PATH = 'raw/spreadsheet.json'

/** One grid sheet: its id, its title and how many rows it has. */
interface GridSheet {
  readonly id: string
  readonly title: string
  readonly rows: number
}

/** The sheets of a spreadsheet that hold rows. */
export const gridSheetsOf = (spreadsheet: unknown): readonly GridSheet[] =>
  (isRecord(spreadsheet) && Array.isArray(spreadsheet['sheets']) ? spreadsheet['sheets'] : [])
    .filter(isRecord)
    .map((sheet) => (isRecord(sheet['properties']) ? sheet['properties'] : {}))
    .filter((properties) => (properties['sheetType'] ?? 'GRID') === 'GRID')
    .map((properties) => {
      const grid = isRecord(properties['gridProperties']) ? properties['gridProperties'] : {}
      const rows = grid['rowCount']
      return {
        id: String(properties['sheetId']),
        title: String(properties['title'] ?? ''),
        rows: typeof rows === 'number' && Number.isInteger(rows) && rows > 0 ? rows : 0,
      }
    })

/** The A1 range of a block of rows, the sheet name quoted (`'Q1 ''24'!1:1000`). */
export const rowsRange = (title: string, first: number, last: number): string =>
  `'${title.replaceAll("'", "''")}'!${String(first)}:${String(last)}`

/** Every block of one sheet's rows, from where a previous run stopped. */
const fetchSheetRows = (
  context: FetchContext,
  spreadsheetId: string,
  sheet: GridSheet
): Effect.Effect<void, ImportFetchError> => {
  const resource = `sheets/${sheet.id}/rows`
  const previous = context.sink.cursorOf(resource)
  if (previous?.complete === true || sheet.rows === 0) return Effect.void
  const step = (pages: number, first: number): Effect.Effect<void, ImportFetchError> => {
    const last = Math.min(first + ROWS_PER_REQUEST - 1, sheet.rows)
    return fetchSourceJson(context.target, context.base, {
      method: 'GET',
      path: `/v4/spreadsheets/${spreadsheetId}`,
      query: { ranges: rowsRange(sheet.title, first, last), fields: ROWS_FIELDS },
    }).pipe(
      Effect.tap((response) =>
        context.sink.writeRaw(
          `raw/sheets/${sheet.id}/rows-${String(pages + 1).padStart(4, '0')}.json`,
          response.bytes
        )
      ),
      Effect.flatMap(() => {
        const complete = last >= sheet.rows
        return context.sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete,
            ...(complete ? {} : { cursor: String(last + 1) }),
          })
          .pipe(Effect.flatMap(() => (complete ? Effect.void : step(pages + 1, last + 1))))
      })
    )
  }
  return step(previous?.pages ?? 0, Number(previous?.cursor ?? 1))
}

/** The spreadsheet's sheets: re-read from the snapshot on a resumed run, fetched otherwise. */
const fetchSpreadsheet = (
  context: FetchContext,
  spreadsheetId: string
): Effect.Effect<unknown, ImportFetchError> =>
  heldOrFetched(context, SPREADSHEET_PATH, `/v4/spreadsheets/${spreadsheetId}`, {
    fields: SPREADSHEET_FIELDS,
  })

/** Fetch one Google spreadsheet into the snapshot. */
export const fetchSpreadsheetSheets = (
  context: FetchContext,
  spreadsheetId: string
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const spreadsheet = yield* fetchSpreadsheet(context, spreadsheetId)
    const sheets = gridSheetsOf(spreadsheet)
    yield* Effect.forEach(sheets, (sheet) => fetchSheetRows(context, spreadsheetId, sheet), {
      discard: true,
    })
    return { ids: [spreadsheetId, ...sheets.map((sheet) => sheet.id)], apiVersion: 'v4' }
  }).pipe(Effect.withSpan('import.fetch-google-sheets'))
