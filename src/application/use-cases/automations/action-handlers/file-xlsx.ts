/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { isSelfContainedSource, resolveSource, tempKey, uploadArtifact } from './file-support'
import { applyCellRange, parseCellRange, readXlsx, type XlsxCell } from './file-xlsx-parse'
import { buildXlsx, type XlsxSheetInput } from './file-xlsx-write'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `file/parseXlsx` and `file/generateXlsx` — the two halves of the `.xlsx`
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

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const failure = (message: string): ActionOutcome => ({ status: 'failure', error: message })

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined =>
  p[key] !== undefined && stringProp(p, key) !== '' ? stringProp(p, key) : undefined

// ---------------------------------------------------------------------------
// parseXlsx
// ---------------------------------------------------------------------------

type LoadedBytes =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string }

/**
 * Load workbook bytes from a `data:` URI, an `http(s)://` URL or a storage key.
 *
 * Plain keys go through `storage.download` rather than `resolveSource` for the
 * same reason `parseCsv` does: `resolveSource` degrades a missing key to empty
 * bytes, turning "file not found" into a silent empty parse.
 */
const loadWorkbookBytes = (ref: string): Effect.Effect<LoadedBytes, never, StorageService> =>
  Effect.gen(function* () {
    if (isSelfContainedSource(ref)) {
      const resolved = yield* Effect.result(resolveSource(ref))
      return resolved._tag === 'Failure'
        ? ({ ok: false, message: `invalid_outbound_url_${resolved.failure.reason}` } as const)
        : ({ ok: true, bytes: resolved.success.bytes } as const)
    }
    const storage = yield* StorageService
    const downloaded = yield* Effect.result(storage.download(ref, UNATTRIBUTED_BUCKET))
    return downloaded._tag === 'Failure'
      ? ({ ok: false, message: `file not found: ${ref}` } as const)
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

const intProp = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'string' ? Number(value) : value
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : fallback
}

const sheetSelector = (raw: unknown): string | number | undefined => {
  if (raw === undefined) return undefined
  return typeof raw === 'number' ? raw : String(raw)
}

export const handleFileParseXlsx: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const ref = optionalString(p, 'source') ?? optionalString(p, 'key')
    if (ref === undefined) return failure('file.parseXlsx requires a source (or key)')

    const loaded = yield* loadWorkbookBytes(ref)
    if (!loaded.ok) return failure(loaded.message)

    const read = readXlsx(loaded.bytes, sheetSelector(p['sheet']))
    if (!read.ok) return failure(read.message)

    const rawRange = optionalString(p, 'range')
    const range = rawRange === undefined ? undefined : parseCellRange(rawRange)
    if (rawRange !== undefined && range === undefined) {
      return failure(`file.parseXlsx received a malformed range: ${JSON.stringify(rawRange)}`)
    }

    // `range` selects the rectangle in SHEET coordinates, so it is applied to
    // the A1-anchored grid first; `skipRows` then drops rows off the top of
    // that rectangle, and only then is the header row lifted out.
    const ranged = range === undefined ? read.parsed.rows : applyCellRange(read.parsed.rows, range)
    const skipped = ranged.slice(intProp(p['skipRows'], 0))
    const { columns, data } = shapeRows(skipped, p['header'] === true)

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
  })

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

/** Mirrors `generateCsv`'s column resolution so the two exports agree. */
const columnsFor = (
  defs: ReadonlyArray<Record<string, unknown>> | undefined,
  firstRow: Readonly<Record<string, unknown>>
): ReadonlyArray<XlsxColumn> =>
  defs
    ? defs.map((c) => {
        const key = String(c['field'] ?? c['key'] ?? c['header'] ?? '')
        return { key, header: String(c['header'] ?? key) }
      })
    : Object.keys(firstRow).map((key) => ({ key, header: key }))

const columnDefsOf = (value: unknown): ReadonlyArray<Record<string, unknown>> | undefined =>
  Array.isArray(value) ? (value as ReadonlyArray<Record<string, unknown>>) : undefined

/**
 * Project rows into the writer's shape.
 *
 * An array row is positional and carries no keys, so it gets no header row;
 * object rows are projected through the resolved columns and DO.
 */
const toSheetInput = (
  name: string,
  rows: ReadonlyArray<unknown>,
  defs: ReadonlyArray<Record<string, unknown>> | undefined
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
 * Resolve props against the run context rather than trusting the run loop's
 * substitution: `resolveTriggerInValue` stringifies non-scalar leaves, so
 * `data: "{{trigger.data.items}}"` would arrive as `"[object Object]"`.
 * `generateCsv` resolves its own props for exactly this reason.
 */
const resolvedProps = (
  action: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): Readonly<Record<string, unknown>> =>
  runContext
    ? (resolveRunContextValue(
        rawActionProps(runContext),
        buildRunContextView(runContext)
      ) as Record<string, unknown>)
    : props(action)

/** The declared sheets: the multi-sheet `sheets` form, or the single `data` form. */
const sheetInputsFor = (p: Readonly<Record<string, unknown>>): ReadonlyArray<XlsxSheetInput> => {
  const declared = p['sheets']
  if (Array.isArray(declared)) {
    return declared.map((entry, index) => {
      const sheet = asRecord(entry)
      return toSheetInput(
        String(sheet['name'] ?? `Sheet${index + 1}`),
        asArray(sheet['data']),
        columnDefsOf(sheet['columns'])
      )
    })
  }
  return [
    toSheetInput(
      optionalString(p, 'sheetName') ?? 'Sheet1',
      asArray(p['data']),
      columnDefsOf(p['columns'])
    ),
  ]
}

export const handleFileGenerateXlsx: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    const p = resolvedProps(action, runContext)
    const built = buildXlsx(sheetInputsFor(p))
    if (!built.ok) return failure(built.message)

    const destination = optionalString(p, 'destination')
    const key = destination ?? tempKey('.xlsx')
    const storage = yield* StorageService
    const wrote = yield* uploadArtifact(storage, key, built.bytes, XLSX_CONTENT_TYPE)
    if (!wrote) return failure(`failed to write xlsx to ${key}`)

    const base = {
      key,
      filename: optionalString(p, 'filename') ?? 'export.xlsx',
      contentType: XLSX_CONTENT_TYPE,
      size: built.bytes.length,
    }
    return {
      status: 'success',
      output: destination ? { ...base, path: destination } : { ...base, temporary: true },
    } as const
  })
