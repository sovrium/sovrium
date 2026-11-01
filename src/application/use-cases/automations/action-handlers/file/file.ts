/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { decodedHandler, type DecodedAction } from '../decoded-handler'
import { typedOwnProp } from '../document/run'
import { uploadSourceStanding } from '../own-file-url'
import { CALLER_REFUSAL } from '../record/caller-gate'
import {
  builtFromRunBytes,
  recordOwnUpload,
  recordRunArtifact,
  RUN_BYTES,
} from '../run-written-files'
import { actionAttributes } from '../shared'
import { autoDelimiter, csvCell, decodeCsvBytes, dropLeadingLines, parseCsvDocument } from './csv'
import {
  FileDownloadSettings,
  FileGenerateCsvSettings,
  FileParseCsvSettings,
  FileUploadSettings,
} from './settings'
import {
  extOf,
  isSelfContainedSource,
  mimeByExt,
  readStoredSource,
  resolveSource,
  sourceRefusalMessage,
  storedReadMessage,
  storeArtifact,
  tempKey,
  uploadArtifact,
} from './support'
import { uploadPlacement } from './upload-placement'
import type { ActionOutcome } from '../shared'
import type { OutboundHttp } from '@/application/ports/services/outbound-http'

/**
 * `file:*` action handlers — read/write bucket files via the StorageService
 * port. Binary data flows between steps via storage keys (small ones under
 * `tmp/automations/`), not in-memory buffers, mirroring the `FileActionResult`
 * contract: a `download` step writes the bytes to a fresh temp key that a
 * later `upload` (or `code`) step references as `source`.
 *
 * Pure source resolution / MIME inference / CSV codec live in `file-support.ts`.
 */

const errorOutcome = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------

/** The answer to an upload that was not written: refused as the gate refuses, or failed. */
const writeFailure = (wrote: 'taken' | 'failed', key: string): ActionOutcome =>
  wrote === 'taken'
    ? { status: 'failure', error: CALLER_REFUSAL }
    : errorOutcome(`failed to upload to ${key}`)

/** What an upload step hands on: its bucket when it named one, else its path or `temporary`. */
const uploadOutput = (
  base: { readonly key: string; readonly contentType: string; readonly size: number },
  path: string | undefined,
  bucket: string | undefined
): Readonly<Record<string, unknown>> => {
  if (bucket !== undefined) return { ...base, bucket }
  return path !== undefined && path.trim() !== '' ? { ...base, path } : { ...base, temporary: true }
}

export const handleFileUpload = decodedHandler(FileUploadSettings, (action, app, automation) =>
  Effect.gen(function* () {
    const { source, path, headers, contentType: explicitContentType } = action.props
    const bucket = action.props.bucket || undefined
    if (!source) return { status: 'failure', error: 'file.upload requires a source' } as const

    // `resolveSource`'s SSRF block: a private or loopback `http(s)://` source fails before
    // any fetch, surfaced as `invalid_outbound_url_<reason>`; a stored file past the
    // 100 MiB limit is refused by name. Nothing is stored either way.
    const resolved = yield* Effect.result(resolveSource(source, headers ?? {}))
    if (resolved._tag === 'Failure') return errorOutcome(sourceRefusalMessage(resolved.failure))
    const { bytes, detectedMime } = resolved.success
    const mime =
      explicitContentType || detectedMime || mimeByExt(path) || 'application/octet-stream'
    const placed = yield* uploadPlacement({ app, path, bucket, mime, automation })
    if ('refusal' in placed) return { status: 'failure', error: placed.refusal } as const
    const { key, target } = placed

    const storage = yield* StorageService
    const wrote = yield* storeArtifact(storage, key, { bytes, contentType: mime }, target)
    // A key found free that a file took in the meantime: kept, and refused as the gate refuses.
    if (wrote !== 'written') return writeFailure(wrote, key)
    // A stored key, or a URL of the app, carries the standing of the file it names.
    const carriesRunBytes = yield* uploadSourceStanding(
      automation.writtenFiles,
      source,
      resolved.success
    )
    yield* Effect.sync(() =>
      recordOwnUpload(automation.writtenFiles, { bucket, key, carriesRunBytes })
    )

    return {
      status: 'success',
      output: uploadOutput({ key, contentType: mime, size: bytes.length }, path, bucket),
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-upload', { attributes: actionAttributes(action) })
  )
)

// ---------------------------------------------------------------------------
// download
// ---------------------------------------------------------------------------

export const handleFileDownload = decodedHandler(FileDownloadSettings, (action, _app, automation) =>
  Effect.gen(function* () {
    const { key } = action.props
    if (!key) return errorOutcome('file.download requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.result(readStoredSource(key))
    if (downloaded._tag === 'Failure') return errorOutcome(storedReadMessage(downloaded.failure))

    const bytes = downloaded.success
    const mime = mimeByExt(key) ?? 'application/octet-stream'
    const target = tempKey(extOf(key))
    const wrote = yield* uploadArtifact(storage, target, bytes, mime)
    if (!wrote) return errorOutcome(`failed to stage download for ${key}`)
    // The staged copy holds the stored file's bytes, and carries its standing.
    const carriesRunBytes = builtFromRunBytes(automation.writtenFiles, [key])
    yield* recordRunArtifact(automation.writtenFiles, target, { carriesRunBytes })

    return {
      status: 'success',
      output: { contentType: mime, tempKey: target, size: bytes.length },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-download', { attributes: actionAttributes(action) })
  )
)

// ---------------------------------------------------------------------------
// generateCsv
// ---------------------------------------------------------------------------

interface CsvColumn {
  readonly key: string
  readonly header: string
}

type GenerateCsvProps = DecodedAction<typeof FileGenerateCsvSettings>['props']

const columnsFor = (
  defs: GenerateCsvProps['columns'],
  firstRow: Readonly<Record<string, unknown>>
): ReadonlyArray<CsvColumn> =>
  defs
    ? defs.map((c) => {
        const k = c.field ?? c.key ?? c.header ?? ''
        return { key: k, header: c.header ?? k }
      })
    : Object.keys(firstRow).map((k) => ({ key: k, header: k }))

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asArrayProp = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? (value as ReadonlyArray<unknown>) : []

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

export const handleFileGenerateCsv = decodedHandler(
  FileGenerateCsvSettings,
  (action, _app, automation, runContext) =>
    Effect.gen(function* () {
      const p = action.props
      // The rows a whole template names, read with their types kept.
      const rows = asArrayProp(typedOwnProp(p, 'data', runContext))
      const delimiter = p.delimiter ?? ','
      const destination = p.destination || undefined
      const columns = columnsFor(p.columns, asRecord(rows[0]))
      const csv = renderCsv(rows, columns, delimiter, p.includeHeaders !== false)
      const bytes = new TextEncoder().encode(csv)
      const key = destination ?? tempKey('.csv')

      const storage = yield* StorageService
      const wrote = yield* uploadArtifact(storage, key, bytes, 'text/csv')
      if (!wrote) return errorOutcome(`failed to write csv to ${key}`)
      // Built from the step's data alone: its bytes are the run's.
      yield* recordRunArtifact(automation.writtenFiles, key, RUN_BYTES)

      const base = {
        key,
        filename: p.filename || 'export.csv',
        contentType: 'text/csv',
        size: bytes.length,
      }
      return {
        status: 'success',
        output: destination ? { ...base, path: destination } : { ...base, temporary: true },
      } as const
    }).pipe(
      Effect.withSpan('automations.handle-file-generate-csv', {
        attributes: actionAttributes(action),
      })
    )
)

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

type CsvRecords = ReadonlyArray<ReadonlyArray<string>>

type ParseCsvProps = DecodedAction<typeof FileParseCsvSettings>['props']

type CsvColumnDefs = NonNullable<ParseCsvProps['columns']>

const parseWithColumnDefs = (
  records: CsvRecords,
  defs: CsvColumnDefs
): ReadonlyArray<Record<string, unknown>> =>
  records.map((cells) =>
    Object.fromEntries(
      defs.map((c, i) => {
        const name = c.name ?? c.key ?? c.header ?? `col${i}`
        return [name, cells[c.index ?? i] ?? ''] as const
      })
    )
  )

const parseWithHeaderRow = (records: CsvRecords): ReadonlyArray<Record<string, unknown>> => {
  const header = records[0] ?? []
  return records
    .slice(1)
    .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''] as const)))
}

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
  columnDefs: CsvColumnDefs | undefined
): ReadonlyArray<Record<string, unknown>> =>
  columnDefs ? parseWithColumnDefs(records, columnDefs) : parseWithHeaderRow(records)

type CsvBytes =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string }

/**
 * Load the bytes to parse from a `data:` URI, an `http(s)://` URL or a storage
 * key — the same three shapes the sibling `file:upload` already accepts.
 *
 * Plain storage keys keep going through `readStoredSource` rather than
 * `resolveSource` on purpose: `resolveSource` degrades a missing key to empty
 * bytes, which would turn "file not found" into a silent empty parse.
 */
const loadCsvBytes = (ref: string): Effect.Effect<CsvBytes, never, StorageService | OutboundHttp> =>
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

/** Resolve the CSV text from inline `content`, or from `key`/`source` bytes. */
const csvText = (
  p: ParseCsvProps
): Effect.Effect<
  CsvBytes | { readonly ok: true; readonly text: string },
  never,
  StorageService | OutboundHttp
> =>
  Effect.gen(function* () {
    const inline = p.content
    if (inline !== undefined && inline !== '') return { ok: true, text: inline } as const

    const ref = p.key ?? p.source ?? ''
    if (!ref) {
      return inline !== undefined
        ? ({ ok: true, text: '' } as const)
        : ({ ok: false, message: 'file.parseCsv requires a key' } as const)
    }
    return yield* loadCsvBytes(ref)
  })

export const handleFileParseCsv = decodedHandler(FileParseCsvSettings, (action) =>
  Effect.gen(function* () {
    const p = action.props
    const loaded = yield* csvText(p)
    if (!loaded.ok) return errorOutcome(loaded.message)

    // Decode BEFORE anything else: line boundaries and delimiters have to be
    // read out of correctly-decoded text, not raw bytes.
    const decoded = 'text' in loaded ? loaded.text : decodeCsvBytes(loaded.bytes)

    // `skipRows` first, THEN detection — a preamble line carries none of the
    // candidate delimiters, so sampling the raw document would fall through to
    // the comma default and mis-parse the real header underneath it.
    const body = dropLeadingLines(decoded, p.skipRows ?? 0)
    const delimiter = p.delimiter ?? autoDelimiter(body)

    const records = parseCsvDocument(body, delimiter)
    if (records === undefined) return errorOutcome('failed to parse csv: malformed quoting')

    return { status: 'success', output: { data: csvRows(records, p.columns) } } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-parse-csv', { attributes: actionAttributes(action) })
  )
)
