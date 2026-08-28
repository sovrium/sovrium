/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  autoDelimiter,
  csvCell,
  decodeCsvBytes,
  dropLeadingLines,
  extOf,
  isSelfContainedSource,
  mimeByExt,
  parseCsvDocument,
  resolveSource,
  tempKey,
  uploadArtifact,
} from './file-support'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `file:*` action handlers — read/write bucket files via the StorageService
 * port. Binary data flows between steps via storage keys (small ones under
 * `tmp/automations/`), not in-memory buffers, mirroring the `FileActionResult`
 * contract: a `download` step writes the bytes to a fresh temp key that a
 * later `upload` (or `code`) step references as `source`.
 *
 * Pure source resolution / MIME inference / CSV codec live in `file-support.ts`.
 */

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined =>
  p[key] !== undefined ? stringProp(p, key) : undefined

const errorOutcome = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------

export const handleFileUpload: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const p = props(action)
    const source = stringProp(p, 'source')
    const path = optionalString(p, 'path')
    const explicitContentType = optionalString(p, 'contentType')
    if (!source) return { status: 'failure', error: 'file.upload requires a source' } as const

    // Consume `resolveSource`'s SSRF block: a private/loopback/link-local
    // `http(s)://` source fails BEFORE any fetch with `OutboundUrlBlockedError`.
    // Surface it as an explicit `error` outcome (mirroring the `http.ts` /
    // `webhook.ts` `invalid_outbound_url_${reason}` shape) and DO NOT proceed
    // to store — the bytes were never fetched.
    const resolved = yield* Effect.result(resolveSource(source))
    if (resolved._tag === 'Failure') {
      return errorOutcome(`invalid_outbound_url_${resolved.failure.reason}`)
    }
    const { bytes, detectedMime } = resolved.success
    const mime =
      explicitContentType || detectedMime || mimeByExt(path) || 'application/octet-stream'
    const hasPath = path !== undefined && path.trim() !== ''
    const key = hasPath ? (path as string) : tempKey('')

    const storage = yield* StorageService
    const wrote = yield* uploadArtifact(storage, key, bytes, mime)
    if (!wrote) return errorOutcome(`failed to upload to ${key}`)

    const base = { key, contentType: mime, size: bytes.length }
    return {
      status: 'success',
      output: hasPath ? { ...base, path } : { ...base, temporary: true },
    } as const
  })

// ---------------------------------------------------------------------------
// download
// ---------------------------------------------------------------------------

export const handleFileDownload: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return errorOutcome('file.download requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.result(storage.download(key))
    if (downloaded._tag === 'Failure') return errorOutcome(`file not found: ${key}`)

    const bytes = downloaded.success
    const mime = mimeByExt(key) ?? 'application/octet-stream'
    const target = tempKey(extOf(key))
    const wrote = yield* uploadArtifact(storage, target, bytes, mime)
    if (!wrote) return errorOutcome(`failed to stage download for ${key}`)

    return {
      status: 'success',
      output: { contentType: mime, tempKey: target, size: bytes.length },
    } as const
  })

// ---------------------------------------------------------------------------
// generateCsv
// ---------------------------------------------------------------------------

interface CsvColumn {
  readonly key: string
  readonly header: string
}

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

const columnsFor = (
  defs: ReadonlyArray<Record<string, unknown>> | undefined,
  firstRow: Readonly<Record<string, unknown>>
): ReadonlyArray<CsvColumn> =>
  defs
    ? defs.map((c) => {
        const k = String(c['field'] ?? c['key'] ?? c['header'] ?? '')
        return { key: k, header: String(c['header'] ?? k) }
      })
    : Object.keys(firstRow).map((k) => ({ key: k, header: k }))

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asArrayProp = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? (value as ReadonlyArray<unknown>) : []

const optionalDestination = (p: Readonly<Record<string, unknown>>): string | undefined =>
  p['destination'] !== undefined && stringProp(p, 'destination') !== ''
    ? stringProp(p, 'destination')
    : undefined

const renderCsv = (
  rows: ReadonlyArray<unknown>,
  columns: ReadonlyArray<CsvColumn>,
  delimiter: string,
  includeHeaders: boolean
): string => {
  // Quoting is delimiter-driven: a value containing the ACTIVE delimiter must
  // be quoted or it splits into two fields when the file is read back.
  const lineFor = (row: unknown): string =>
    columns.map((c) => csvCell(asRecord(row)[c.key], delimiter)).join(delimiter)
  const headerLine = includeHeaders
    ? [columns.map((c) => csvCell(c.header, delimiter)).join(delimiter)]
    : []
  return [...headerLine, ...rows.map(lineFor)].join('\n')
}

export const handleFileGenerateCsv: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    const p = resolvedProps(action, runContext)
    const rows = asArrayProp(p['data'])
    const delimiterRaw = p['delimiter']
    const delimiter = typeof delimiterRaw === 'string' && delimiterRaw !== '' ? delimiterRaw : ','
    const destination = optionalDestination(p)
    const columns = columnsFor(
      Array.isArray(p['columns'])
        ? (p['columns'] as ReadonlyArray<Record<string, unknown>>)
        : undefined,
      asRecord(rows[0])
    )
    const csv = renderCsv(rows, columns, delimiter, p['includeHeaders'] !== false)
    const bytes = new TextEncoder().encode(csv)
    const key = destination ?? tempKey('.csv')

    const storage = yield* StorageService
    const wrote = yield* uploadArtifact(storage, key, bytes, 'text/csv')
    if (!wrote) return errorOutcome(`failed to write csv to ${key}`)

    const base = {
      key,
      filename: stringProp(p, 'filename') || 'export.csv',
      contentType: 'text/csv',
      size: bytes.length,
    }
    return {
      status: 'success',
      output: destination ? { ...base, path: destination } : { ...base, temporary: true },
    } as const
  })

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

type CsvRecords = ReadonlyArray<ReadonlyArray<string>>

const parseWithColumnDefs = (
  records: CsvRecords,
  defs: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> =>
  records.map((cells) =>
    Object.fromEntries(
      defs.map((c, i) => {
        const name = String(c['name'] ?? c['key'] ?? c['header'] ?? `col${i}`)
        const idx = typeof c['index'] === 'number' ? (c['index'] as number) : i
        return [name, cells[idx] ?? ''] as const
      })
    )
  )

const parseWithHeaderRow = (records: CsvRecords): ReadonlyArray<Record<string, unknown>> => {
  const header = records[0] ?? []
  return records
    .slice(1)
    .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''] as const)))
}

const intProp = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Shape parsed records into objects.
 *
 * `skipRows` is deliberately ABSENT here: it is applied to the document text
 * upstream, so skipping a preamble no longer switches the output shape from
 * header-keyed objects to `col0`/`col1`. Explicit `columns` still consume every
 * record as data (there is no header row to interpret when the mapping is
 * given); otherwise the first surviving record is the header.
 */
const csvRows = (
  records: CsvRecords,
  columnDefs: ReadonlyArray<Record<string, unknown>> | undefined
): ReadonlyArray<Record<string, unknown>> =>
  columnDefs ? parseWithColumnDefs(records, columnDefs) : parseWithHeaderRow(records)

type CsvBytes =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string }

/**
 * Load the bytes to parse from a `data:` URI, an `http(s)://` URL or a storage
 * key — the same three shapes the sibling `file:upload` already accepts.
 *
 * Plain storage keys keep going through `storage.download` rather than
 * `resolveSource` on purpose: `resolveSource` degrades a missing key to empty
 * bytes, which would turn "file not found" into a silent empty parse.
 */
const loadCsvBytes = (ref: string): Effect.Effect<CsvBytes, never, StorageService> =>
  Effect.gen(function* () {
    if (isSelfContainedSource(ref)) {
      const resolved = yield* Effect.result(resolveSource(ref))
      return resolved._tag === 'Failure'
        ? ({ ok: false, message: `invalid_outbound_url_${resolved.failure.reason}` } as const)
        : ({ ok: true, bytes: resolved.success.bytes } as const)
    }
    const storage = yield* StorageService
    const downloaded = yield* Effect.result(storage.download(ref))
    return downloaded._tag === 'Failure'
      ? ({ ok: false, message: `file not found: ${ref}` } as const)
      : ({ ok: true, bytes: downloaded.success } as const)
  })

/** Resolve the CSV text from inline `content`, or from `key`/`source` bytes. */
const csvText = (
  p: Readonly<Record<string, unknown>>
): Effect.Effect<CsvBytes | { readonly ok: true; readonly text: string }, never, StorageService> =>
  Effect.gen(function* () {
    const inline = p['content'] !== undefined ? stringProp(p, 'content') : undefined
    if (inline !== undefined && inline !== '') return { ok: true, text: inline } as const

    const ref = p['key'] !== undefined ? stringProp(p, 'key') : stringProp(p, 'source')
    if (!ref) {
      return inline !== undefined
        ? ({ ok: true, text: '' } as const)
        : ({ ok: false, message: 'file.parseCsv requires a key' } as const)
    }
    return yield* loadCsvBytes(ref)
  })

export const handleFileParseCsv: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const p = props(action)
    const loaded = yield* csvText(p)
    if (!loaded.ok) return errorOutcome(loaded.message)

    // Decode BEFORE anything else: line boundaries and delimiters have to be
    // read out of correctly-decoded text, not raw bytes.
    const decoded = 'text' in loaded ? loaded.text : decodeCsvBytes(loaded.bytes)

    // `skipRows` first, THEN detection — a preamble line carries none of the
    // candidate delimiters, so sampling the raw document would fall through to
    // the comma default and mis-parse the real header underneath it.
    const body = dropLeadingLines(decoded, intProp(p['skipRows'], 0))
    const delimiterRaw = p['delimiter']
    const delimiter =
      typeof delimiterRaw === 'string' && delimiterRaw !== '' ? delimiterRaw : autoDelimiter(body)

    const records = parseCsvDocument(body, delimiter)
    if (records === undefined) return errorOutcome('failed to parse csv: malformed quoting')

    const columnDefs = Array.isArray(p['columns'])
      ? (p['columns'] as ReadonlyArray<Record<string, unknown>>)
      : undefined

    return { status: 'success', output: { data: csvRows(records, columnDefs) } } as const
  })
