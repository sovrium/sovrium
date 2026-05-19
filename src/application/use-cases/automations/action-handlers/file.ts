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
  extOf,
  mimeByExt,
  resolveSource,
  splitCsvLine,
  splitNonEmptyLines,
  tempKey,
} from './file-support'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'


const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined =>
  p[key] !== undefined ? stringProp(p, key) : undefined

const errorOutcome = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})


export const handleFileUpload: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const p = props(action)
    const source = stringProp(p, 'source')
    const path = optionalString(p, 'path')
    const explicitContentType = optionalString(p, 'contentType')
    if (!source) return { status: 'failure', error: 'file.upload requires a source' } as const

    const { bytes, detectedMime } = yield* resolveSource(source)
    const mime =
      explicitContentType || detectedMime || mimeByExt(path) || 'application/octet-stream'
    const hasPath = path !== undefined && path.trim() !== ''
    const key = hasPath ? (path as string) : tempKey('')

    const storage = yield* StorageService
    const wrote = yield* Effect.either(storage.upload(key, bytes, mime))
    if (wrote._tag === 'Left') return errorOutcome(`failed to upload to ${key}`)

    const base = { key, contentType: mime, size: bytes.length }
    return {
      status: 'success',
      output: hasPath ? { ...base, path } : { ...base, temporary: true },
    } as const
  })


export const handleFileDownload: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return errorOutcome('file.download requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.either(storage.download(key))
    if (downloaded._tag === 'Left') return errorOutcome(`file not found: ${key}`)

    const bytes = downloaded.right
    const mime = mimeByExt(key) ?? 'application/octet-stream'
    const target = tempKey(extOf(key))
    const wrote = yield* Effect.either(storage.upload(target, bytes, mime))
    if (wrote._tag === 'Left') return errorOutcome(`failed to stage download for ${key}`)

    return {
      status: 'success',
      output: { contentType: mime, tempKey: target, size: bytes.length },
    } as const
  })


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
  const lineFor = (row: unknown): string =>
    columns.map((c) => csvCell(asRecord(row)[c.key])).join(delimiter)
  const headerLine = includeHeaders ? [columns.map((c) => csvCell(c.header)).join(delimiter)] : []
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
    const wrote = yield* Effect.either(storage.upload(key, bytes, 'text/csv'))
    if (wrote._tag === 'Left') return errorOutcome(`failed to write csv to ${key}`)

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


const parseWithColumnDefs = (
  rows: readonly string[],
  delimiter: string,
  defs: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> =>
  rows.map((line) => {
    const cells = splitCsvLine(line, delimiter)
    return Object.fromEntries(
      defs.map((c, i) => {
        const name = String(c['name'] ?? c['key'] ?? c['header'] ?? `col${i}`)
        const idx = typeof c['index'] === 'number' ? (c['index'] as number) : i
        return [name, cells[idx] ?? ''] as const
      })
    )
  })

const parseHeaderless = (
  rows: readonly string[],
  delimiter: string
): ReadonlyArray<Record<string, unknown>> =>
  rows.map((line) =>
    Object.fromEntries(splitCsvLine(line, delimiter).map((value, i) => [`col${i}`, value] as const))
  )

const parseWithHeaderRow = (
  rows: readonly string[],
  delimiter: string
): ReadonlyArray<Record<string, unknown>> => {
  const header = rows.length > 0 ? splitCsvLine(rows[0] as string, delimiter) : []
  return rows.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''] as const))
  })
}

const intProp = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const csvRows = (
  rows: readonly string[],
  delimiter: string,
  columnDefs: ReadonlyArray<Record<string, unknown>> | undefined,
  skipRows: number
): ReadonlyArray<Record<string, unknown>> =>
  columnDefs
    ? parseWithColumnDefs(rows, delimiter, columnDefs)
    : skipRows > 0
      ? parseHeaderless(rows, delimiter)
      : parseWithHeaderRow(rows, delimiter)

export const handleFileParseCsv: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const p = props(action)
    const key = p['key'] !== undefined ? stringProp(p, 'key') : stringProp(p, 'source')
    if (!key) return errorOutcome('file.parseCsv requires a key')

    const storage = yield* StorageService
    const downloaded = yield* Effect.either(storage.download(key))
    if (downloaded._tag === 'Left') return errorOutcome(`file not found: ${key}`)

    const skipRows = intProp(p['skipRows'], 0)
    const rows = splitNonEmptyLines(Buffer.from(downloaded.right).toString('utf-8')).slice(skipRows)
    const delimiterRaw = p['delimiter']
    const delimiter =
      typeof delimiterRaw === 'string' && delimiterRaw !== ''
        ? delimiterRaw
        : autoDelimiter(rows[0])
    const columnDefs = Array.isArray(p['columns'])
      ? (p['columns'] as ReadonlyArray<Record<string, unknown>>)
      : undefined

    return {
      status: 'success',
      output: { data: csvRows(rows, delimiter, columnDefs, skipRows) },
    } as const
  })
