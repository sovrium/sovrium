/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { writeGeneratedFile } from '../document/output'
import { runDocumentAction, typedOwnProp } from '../document/run'
import { generateXlsxFromTemplate } from '../document/xlsx-template'
import { actionAttributes } from '../shared'
import { DocumentGenerateXlsxSettings, FileParseXlsxSettings } from './settings'
import {
  isSelfContainedSource,
  readStoredSource,
  resolveSource,
  sourceRefusalMessage,
  storedReadMessage,
} from './support'
import { applyCellRange, parseCellRange, readXlsx, type XlsxCell } from './xlsx-parse'
import { buildXlsx, type XlsxSheetInput } from './xlsx-write'
import type { ActionOutcome, ActionRunContext } from '../shared'
import type { OutboundHttp } from '@/application/ports/services/outbound-http'
import type { StorageService } from '@/application/ports/services/storage-service'

/**
 * `file/parseXlsx` and `document/generateXlsx` — the two halves of the `.xlsx`
 * codec. The format work itself is pure and lives in the sibling modules
 * `file-zip-read.ts`, `file-xlsx-xml.ts`, `file-xlsx-parse.ts` and
 * `file-xlsx-write.ts`; this file is storage-port glue.
 *
 * ## Why these fail HARD where `parseCsv` fails soft
 *
 * The sibling `file:*` handlers report most problems as `{ status: 'success',
 * output: { error } }`, leaving the run to continue. `parseXlsx` does not: an
 * unreadable container, an out-of-subset feature or a missing sheet ends the
 * step with `status: 'failure'`. The whole reason the subset is closed is that
 * a workbook Sovrium cannot fully understand must not read downstream as "the
 * sheet had no rows" — and a soft error does exactly that whenever the caller
 * looks at `data` before `error`.
 */

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const failure = (message: string): ActionOutcome => ({ status: 'failure', error: message })

/** A text setting, or `undefined` when it is absent or empty. */
const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value

// ---------------------------------------------------------------------------
// parseXlsx
// ---------------------------------------------------------------------------

type LoadedBytes =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string }

/**
 * Load workbook bytes from a `data:` URI, an `http(s)://` URL or a storage key.
 *
 * Plain keys go through `readStoredSource` rather than `resolveSource` for the
 * same reason `parseCsv` does: `resolveSource` degrades a missing key to empty
 * bytes, turning "file not found" into a silent empty parse.
 */
const loadWorkbookBytes = (
  ref: string
): Effect.Effect<LoadedBytes, never, StorageService | OutboundHttp> =>
  Effect.gen(function* () {
    if (isSelfContainedSource(ref)) {
      const resolved = yield* Effect.result(resolveSource(ref))
      return resolved._tag === 'Failure'
        ? ({ ok: false, message: sourceRefusalMessage(resolved.failure) } as const)
        : ({ ok: true, bytes: resolved.success.bytes } as const)
    }
    const downloaded = yield* Effect.result(readStoredSource(ref))
    return downloaded._tag === 'Failure'
      ? ({ ok: false, message: storedReadMessage(downloaded.failure) } as const)
      : ({ ok: true, bytes: downloaded.success } as const)
  })

interface ShapedRows {
  readonly columns: ReadonlyArray<string>
  readonly data: ReadonlyArray<ReadonlyArray<XlsxCell>>
}

/** Lift the header row out of the grid when `header` is set. */
const shapeRows = (rows: ReadonlyArray<ReadonlyArray<XlsxCell>>, header: boolean): ShapedRows =>
  header
    ? { columns: (rows[0] ?? []).map((cell) => String(cell ?? '')), data: rows.slice(1) }
    : { columns: [], data: rows }

export const handleFileParseXlsx = decodedHandler(FileParseXlsxSettings, (action) =>
  Effect.gen(function* () {
    const p = action.props
    const ref = nonEmpty(p.source) ?? nonEmpty(p.key)
    if (ref === undefined) return failure('file.parseXlsx requires a source (or key)')

    const loaded = yield* loadWorkbookBytes(ref)
    if (!loaded.ok) return failure(loaded.message)

    const read = readXlsx(loaded.bytes, p.sheet)
    if (!read.ok) return failure(read.message)

    const rawRange = nonEmpty(p.range)
    const range = rawRange === undefined ? undefined : parseCellRange(rawRange)
    if (rawRange !== undefined && range === undefined) {
      return failure(`file.parseXlsx received a malformed range: ${JSON.stringify(rawRange)}`)
    }

    // `range` selects the rectangle in SHEET coordinates, so it is applied to
    // the A1-anchored grid first; `skipRows` then drops rows off the top of
    // that rectangle, and only then is the header row lifted out.
    const ranged = range === undefined ? read.parsed.rows : applyCellRange(read.parsed.rows, range)
    const skipped = ranged.slice(p.skipRows ?? 0)
    const { columns, data } = shapeRows(skipped, p.header === true)

    return {
      status: 'success',
      output: {
        data,
        columns,
        rowCount: data.length,
        sheetName: read.parsed.sheetName,
        sheetNames: read.parsed.sheetNames,
      },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-parse-xlsx', { attributes: actionAttributes(action) })
  )
)

// ---------------------------------------------------------------------------
// generateXlsx
// ---------------------------------------------------------------------------

interface XlsxColumn {
  readonly key: string
  readonly header: string
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

type GenerateXlsxProps = DecodedAction<typeof DocumentGenerateXlsxSettings>['props']

type XlsxColumnDefs = GenerateXlsxProps['columns']

/** Mirrors `generateCsv`'s column resolution so the two exports agree. */
const columnsFor = (
  defs: XlsxColumnDefs,
  firstRow: Readonly<Record<string, unknown>>
): ReadonlyArray<XlsxColumn> =>
  defs
    ? defs.map((c) => {
        const key = c.field ?? c.key ?? c.header ?? ''
        return { key, header: c.header ?? key }
      })
    : Object.keys(firstRow).map((key) => ({ key, header: key }))

/**
 * Project rows into the writer's shape.
 *
 * An array row is positional and carries no keys, so it gets no header row;
 * object rows are projected through the resolved columns and DO.
 */
const toSheetInput = (
  name: string,
  rows: ReadonlyArray<unknown>,
  defs: XlsxColumnDefs
): XlsxSheetInput => {
  if (Array.isArray(rows[0])) {
    return { name, rows: rows.map((row) => asArray(row)) }
  }
  const columns = columnsFor(defs, asRecord(rows[0]))
  return {
    name,
    header: columns.map((column) => column.header),
    rows: rows.map((row) => columns.map((column) => asRecord(row)[column.key])),
  }
}

/**
 * The declared sheets: the multi-sheet `sheets` form, or the single `data`
 * form. Their rows are the lists the templates name, read with their types
 * kept (`typedOwnProp`): the run's generic pass writes a list out as text.
 */
const sheetInputsFor = (
  p: GenerateXlsxProps,
  runContext: ActionRunContext | undefined
): ReadonlyArray<XlsxSheetInput> => {
  if (p.sheets !== undefined) {
    const typed = asArray(typedOwnProp(p, 'sheets', runContext))
    return p.sheets.map((sheet, index) =>
      toSheetInput(
        sheet.name === '' ? `Sheet${index + 1}` : sheet.name,
        asArray(asRecord(typed[index])['data']),
        sheet.columns
      )
    )
  }
  return [
    toSheetInput(
      nonEmpty(p.sheetName) ?? 'Sheet1',
      asArray(typedOwnProp(p, 'data', runContext)),
      p.columns
    ),
  ]
}

export const handleDocumentGenerateXlsx = decodedHandler(
  DocumentGenerateXlsxSettings,
  (action, app, automation, runContext) =>
    Effect.gen(function* () {
      const p = action.props
      if (p.template !== undefined) {
        return yield* generateXlsxFromTemplate(
          { ...p, template: p.template },
          app,
          automation,
          runContext
        )
      }
      const built = buildXlsx(sheetInputsFor(p, runContext))
      if (!built.ok) return failure(built.message)
      return yield* runDocumentAction(
        'document.generateXlsx',
        writeGeneratedFile({
          output: p.output,
          file: { bytes: built.bytes, contentType: XLSX_CONTENT_TYPE },
          app,
          automation,
          runContext,
        })
      )
    }).pipe(
      Effect.withSpan('automations.handle-document-generate-xlsx', {
        attributes: actionAttributes(action),
      })
    )
)
