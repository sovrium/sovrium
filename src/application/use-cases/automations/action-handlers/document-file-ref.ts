/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { AssetStore } from '@/application/ports/services/asset-store'
import {
  StorageService,
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { stripUuidPrefix } from '../../attachments/attachment-fields'
import { buildSystemSession } from '../build-guest-session'
import { isRecord, type Raw } from './document-run'
import { fileRefRefusal, type FileRefItem } from './file-ref-origin'
import { FILE_SOURCE_MAX_BYTES, isSelfContainedSource, resolveSource } from './file-support'
import { fetchedUrlStanding } from './own-file-url'
import { CALLER_REFUSAL, runReadAccess } from './record-caller-gate'
import { safeFilename } from './safe-filename'
import { starterFileGate } from './starter-file-gate'
import { noteStepFileInput, type RecordInputOrigin } from './step-file-inputs'
import type { RunWrittenFiles } from './run-written-files'
import type { ActionRunContext, AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'

/**
 * READING A FILE REFERENCE — the one input road of the `document/*`, `pdf/*`
 * and `email/send` (attachments) actions.
 *
 * Six forms: a storage key, `{ key, bucket }`, `{ step }` (a previous step's
 * file), `{ asset }` (a declared private asset), `{ record }` (the file in a
 * record's attachment field) and `{ url }` (fetched through the guarded
 * egress). Every failure names the reference, so a step error says which
 * input could not be read.
 *
 * Who chose the reference matters (`file-ref-origin.ts`): one the run's data
 * supplied may only name a file the run produced. A `{ record }` reference
 * reads the record as the run does — as the person who started it by hand,
 * under their table rules — and only from an attachment field.
 */

/** A file reference that could not be read; `message` names it. */
export class FileRefError extends Data.TaggedError('FileRefError')<{
  readonly message: string
  /** Set when the file is refused for weighing more than the read allowed: how it is named. */
  readonly oversized?: string
  /** Set when a run started by hand may not read the file: the step answers the refusal alone. */
  readonly callerRefused?: true
}> {}

/** The bytes a reference names, with the name and type a consumer hands on. */
export interface ResolvedFile {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly contentType: string
}

const baseName = (path: string): string => stripUuidPrefix(path.slice(path.lastIndexOf('/') + 1))

const refused = (message: string): Effect.Effect<never, FileRefError> =>
  Effect.fail(new FileRefError({ message }))

/** The cap a read names in its refusal: the default by its label, any other in bytes. */
const capLabel = (maxBytes: number): string =>
  maxBytes === FILE_SOURCE_MAX_BYTES ? '100 MiB' : `${String(maxBytes)}-byte`

/** A file past the most a reference may read, refused by name and cap. */
const tooLarge = (label: string, maxBytes: number): Effect.Effect<never, FileRefError> =>
  Effect.fail(
    new FileRefError({
      message: `${label} is larger than the ${capLabel(maxBytes)} limit a file reference reads`,
      oversized: label,
    })
  )

/** How a stored object is read: its cap, the run's ledger, and the record it came out of, if any. */
interface StoredReader {
  readonly maxBytes: number
  readonly written: RunWrittenFiles | undefined
  readonly record?: RecordInputOrigin
}

/** Read a stored object (named when it cannot be read), noted as an input of the step. */
const readStored = (
  key: string,
  bucket: BucketBinding,
  label: string,
  reader: StoredReader
): Effect.Effect<ResolvedFile, FileRefError, StorageService> =>
  Effect.gen(function* () {
    const { maxBytes } = reader
    const storage = yield* StorageService
    // The catalogued size refuses an oversized file before a byte is buffered;
    // no catalog row falls through to the download, which the cap re-checks.
    const meta = yield* Effect.result(storage.getMetadata(key, bucket))
    if (meta._tag === 'Success' && meta.success.size > maxBytes) {
      return yield* tooLarge(label, maxBytes)
    }
    const bytes = yield* storage
      .download(key, bucket)
      .pipe(Effect.mapError(() => new FileRefError({ message: `${label} could not be read` })))
    if (bytes.length > maxBytes) return yield* tooLarge(label, maxBytes)
    const contentType = meta._tag === 'Success' ? meta.success.contentType : inferMimeFromKey(key)
    yield* noteStepFileInput({
      label,
      carriesRunBytes: reader.written?.keyHasRunBytes(key) === true,
      ...(reader.record === undefined ? {} : { record: reader.record }),
    })
    return { bytes, filename: baseName(key), contentType }
  })

/** `{ step }`: the file the named previous step produced (`key`, and `bucket` when it has one). */
const readStepFile = (
  step: string,
  scope: FileRefScope,
  maxBytes: number
): Effect.Effect<ResolvedFile, FileRefError, StorageService> => {
  const output = scope.runContext?.previousSteps[step]
  const file = isRecord(output?.['result']) ? output['result'] : output
  const key = file?.['key']
  if (typeof key !== 'string' || key === '') {
    return refused(`step "${step}" produced no file (no previous step of that name has a key)`)
  }
  const bucket = typeof file?.['bucket'] === 'string' ? file['bucket'] : UNATTRIBUTED_BUCKET
  const label = `the file of step "${step}" (${key})`
  return readStored(key, bucket, label, { maxBytes, written: scope.automation.writtenFiles }).pipe(
    Effect.map((read) => ({
      ...read,
      ...(typeof file?.['filename'] === 'string'
        ? { filename: safeFilename(file['filename']) }
        : {}),
      ...(typeof file?.['contentType'] === 'string' ? { contentType: file['contentType'] } : {}),
    }))
  )
}

/** `{ asset }`: a declared asset, read at start; the run's own bytes when its path is `literal`. */
const readAsset = (path: string, literal: boolean): Effect.Effect<ResolvedFile, FileRefError> =>
  Effect.gen(function* () {
    const asset = (yield* AssetStore).get(path)
    if (asset === undefined) return yield* refused(`asset "${path}" is not declared in assets`)
    yield* noteStepFileInput({ label: `asset "${path}"`, carriesRunBytes: literal })
    return { bytes: asset.bytes, filename: baseName(path), contentType: asset.contentType }
  })

/** The storage key one attachment cell value names (a key, or a metadata object's URL). */
export const attachmentKey = (value: unknown): string | undefined => {
  const parsed = parseJsonObjectCell(value) ?? value
  if (typeof parsed === 'string' && parsed !== '') return parsed
  if (isRecord(parsed) && typeof parsed['url'] === 'string') {
    return parseBucketFileUrl(parsed['url'])?.key
  }
  if (isRecord(parsed) && typeof parsed['key'] === 'string') return parsed['key']
  return undefined
}

/** The cells of an attachment field: a multiple-attachments field holds a list. */
export const attachmentCells = (value: unknown): readonly unknown[] => {
  const parsed = typeof value === 'string' && value.startsWith('[') ? safeJson(value) : value
  return Array.isArray(parsed) ? parsed : value === null || value === undefined ? [] : [value]
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * The column a reference or an `attachTo` names: `true` for a list of files,
 * `false` for one, or why it is not an attachment field. `subject` names who
 * named it in the message.
 */
export const attachmentColumnKind = (
  app: App,
  table: string,
  field: string,
  subject: string
): boolean | string => {
  const declared = app.tables?.find((t) => t.name === table)
  if (declared === undefined) return `${subject} names table "${table}", which is not declared`
  const column = declared.fields.find((f) => f.name === field)
  if (column === undefined) {
    return `${subject} names field "${table}.${field}", which is not declared`
  }
  if (column.type === 'single-attachment') return false
  if (column.type === 'multiple-attachments') return true
  return `${subject} field "${table}.${field}" is not an attachment field`
}

/** The record a `{ record }` reference names, as the run's reader may read it, or `null`. */
const readableRow = (
  table: string,
  id: string,
  field: string,
  scope: { readonly app: App; readonly automation: AutomationContext }
) =>
  Effect.gen(function* () {
    const access = yield* runReadAccess(scope.app, scope.automation, table)
    if (access.kind === 'refused') return null
    const row = yield* (yield* TableRepository).getRecord(buildSystemSession(), table, id)
    if (row === null || access.kind === 'system') return row
    return access.scope.admits(row) && access.scope.readsColumn(field, row) ? row : null
  })

/**
 * `{ record }`: the file held in a record's attachment field, in that field's
 * bucket — read as the run reads records, so a record its reader may not see
 * is not found, exactly as the records API answers them.
 */
const readRecordFile = (
  ref: Raw,
  scope: { readonly app: App; readonly automation: AutomationContext },
  maxBytes: number
): Effect.Effect<ResolvedFile, FileRefError, FileRefRequirements> =>
  Effect.gen(function* () {
    const { app } = scope
    const table = String(ref['table'] ?? '')
    const id = String(ref['id'] ?? '')
    const field = String(ref['field'] ?? '')
    const index = typeof ref['index'] === 'number' ? ref['index'] : 0
    const label = `the file in ${table}.${field} of record ${id}`
    const kind = attachmentColumnKind(app, table, field, 'a { record } reference')
    if (typeof kind === 'string') return yield* refused(kind)
    const row = yield* readableRow(table, id, field, scope).pipe(
      Effect.mapError(() => new FileRefError({ message: `${label} could not be read` }))
    )
    if (row === null) return yield* refused(`${label}: ${CALLER_REFUSAL}`)
    const key = attachmentKey(attachmentCells(row[field])[index])
    if (key === undefined) return yield* refused(`${label} is empty`)
    return yield* readStored(
      key,
      resolveFieldBucket(app, table, field) ?? SYSTEM_BUCKET_NAME,
      label,
      { maxBytes, written: scope.automation.writtenFiles, record: { table, recordId: id, field } }
    )
  })

/**
 * `{ url }`: fetched through the guarded egress (private addresses refused
 * unless allowed), or a `data:` URI. Any other text is not a URL: it is refused
 * as one that cannot be fetched, never read from storage as a key, which only
 * the key forms do behind the run's gate.
 */
const readUrl = (
  url: string,
  written: RunWrittenFiles | undefined
): Effect.Effect<ResolvedFile, FileRefError, StorageService> => {
  if (!isSelfContainedSource(url)) return refused(`URL ${url} could not be fetched`)
  return resolveSource(url).pipe(
    Effect.mapError(
      (blocked) =>
        new FileRefError({
          message: `URL ${url} was refused by the outbound guard (${blocked.reason})`,
        })
    ),
    // Judged where the bytes were finally served from, too: a redirect to a stored file counts.
    Effect.tap((source) =>
      Effect.flatMap(fetchedUrlStanding(written, url, source.fetchedFrom), (carriesRunBytes) =>
        noteStepFileInput({ label: `URL ${url}`, carriesRunBytes })
      )
    ),
    Effect.flatMap((source) =>
      source.bytes.length === 0
        ? refused(`URL ${url} could not be fetched`)
        : Effect.succeed({
            bytes: source.bytes,
            filename: baseName(new URL(url).pathname) || 'download',
            contentType: source.detectedMime ?? inferMimeFromKey(url),
          })
    )
  )
}

/**
 * `{ key, bucket }`, or `{ key }` from a resolved list item — which may be a
 * whole step result (a `pdf/split` part from `'{{steps.<name>.files}}'`): a
 * part with no `bucket` is a temporary file, and its `filename` is kept.
 */
const readKeyed = (
  ref: Raw,
  reader: StoredReader
): Effect.Effect<ResolvedFile, FileRefError, StorageService> => {
  const { key, bucket, filename } = ref
  if (typeof key !== 'string' || key === '') return refused('a file reference names no file')
  const read = readStored(
    key,
    typeof bucket === 'string' ? bucket : UNATTRIBUTED_BUCKET,
    `file "${key}"`,
    reader
  )
  return typeof filename === 'string' && filename !== ''
    ? Effect.map(read, (file) => ({ ...file, filename: safeFilename(filename) }))
    : read
}

/** What reading a file reference needs: storage, and the records a `{ record }` reads as its reader. */
type FileRefRequirements = StorageService | TableRepository | AuthRepository | DataSourceRepository

/** Where a reference is read: the app, the run, and the automation whose reader reads records. */
export interface FileRefScope {
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}

/** The stored key a reference names by key — a bare key, or `{ key, bucket }` — if any. */
const namedKey = (ref: unknown): string | undefined => {
  if (typeof ref === 'string') return ref === '' ? undefined : ref
  if (!isRecord(ref) || ['step', 'asset', 'url'].some((form) => typeof ref[form] === 'string')) {
    return undefined
  }
  return isRecord(ref['record']) || typeof ref['key'] !== 'string' ? undefined : ref['key']
}

/** A file named by key, read only when the run's gate lets its starter reach it. */
const gatedByKey = (
  key: string,
  scope: FileRefScope,
  read: Effect.Effect<ResolvedFile, FileRefError, FileRefRequirements>
): Effect.Effect<ResolvedFile, FileRefError, FileRefRequirements> =>
  Effect.flatMap(starterFileGate(scope.app, scope.automation)(key), (refusal) =>
    refusal === undefined
      ? read
      : Effect.fail(new FileRefError({ message: refusal, callerRefused: true }))
  )

/** One file reference, read (see {@link resolveFileRef}). */
const readFileRef = (
  item: FileRefItem,
  scope: FileRefScope,
  maxBytes: number
): Effect.Effect<ResolvedFile, FileRefError, FileRefRequirements> => {
  const { ref } = item
  const key = namedKey(ref)
  const reader = { maxBytes, written: scope.automation.writtenFiles }
  if (key !== undefined) {
    const read =
      typeof ref === 'string'
        ? readStored(key, UNATTRIBUTED_BUCKET, `file "${key}"`, reader)
        : readKeyed(ref as Raw, reader)
    return gatedByKey(key, scope, read)
  }
  if (!isRecord(ref)) return refused('a file reference must be a key or an object')
  if (typeof ref['step'] === 'string') return readStepFile(ref['step'], scope, maxBytes)
  // An asset path the configuration wrote out, as `file-ref-origin.ts` reads the authored props.
  const literal = item.origin === 'config' && scope.runContext !== undefined
  if (typeof ref['asset'] === 'string') return readAsset(ref['asset'], literal)
  if (isRecord(ref['record'])) return readRecordFile(ref['record'], scope, maxBytes)
  return typeof ref['url'] === 'string'
    ? readUrl(ref['url'], reader.written)
    : readKeyed(ref, reader)
}

/** How a reference is named in a size refusal. */
const refLabel = (ref: unknown): string => {
  if (typeof ref === 'string') return `file "${ref}"`
  if (isRecord(ref) && typeof ref['asset'] === 'string') return `asset "${ref['asset']}"`
  if (isRecord(ref) && typeof ref['url'] === 'string') return `URL ${ref['url']}`
  return 'the file'
}

/**
 * Read one file reference — after checking who chose it: one from run data
 * that names anything but a file this run produced fails, and nothing is read.
 * A file over `maxBytes` (100 MiB by default) is refused, a stored one by its
 * catalogued size before any byte is buffered.
 */
export const resolveFileRef = (
  item: FileRefItem,
  scope: FileRefScope,
  maxBytes: number = FILE_SOURCE_MAX_BYTES
): Effect.Effect<ResolvedFile, FileRefError, FileRefRequirements> => {
  const refusal = fileRefRefusal(item, scope)
  return (refusal === undefined ? readFileRef(item, scope, maxBytes) : refused(refusal)).pipe(
    // A stored read refuses by its catalogued size first; this re-checks every form.
    Effect.filterOrElse(
      (file) => file.bytes.length <= maxBytes,
      () => tooLarge(refLabel(item.ref), maxBytes)
    ),
    Effect.withSpan('automations.resolve-file-ref')
  )
}
