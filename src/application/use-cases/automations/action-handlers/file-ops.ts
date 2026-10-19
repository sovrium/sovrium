/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect, Option } from 'effect'
import {
  isStorageObjectNotFound,
  StorageService,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import { storageKeyCollisionForm } from '@/domain/kernel/identity/storage-key'
import { logError } from '@/infrastructure/logging/logger'
import { signDownloadLink, signUploadLink } from './file-sign-upload'
import { mimeByExt, uploadArtifactTo } from './file-support'
import { forgetRemovedKey, recordOwnCopy } from './run-written-files'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { BucketBinding, StorageError } from '@/application/ports/services/storage-service'

type Storage = Effect.Success<typeof StorageService>

/**
 * Storage-operation `file:*` action handlers — list / getMetadata / move /
 * copy / delete / signUrl. These complement `file.ts` (upload / download /
 * CSV codecs); kept in a sibling module so neither file outgrows the
 * per-file line cap. Every handler resolves the {@link StorageService} port
 * and never touches a concrete backend (S3 / local / bytea).
 *
 * `move`/`copy` are composed from `download` + `upload` (+ `delete` for move)
 * rather than a backend-native rename so the contract holds uniformly across
 * providers — the bytes survive, the catalog row follows.
 */

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

/** A failure that callers may swallow via `output.error` (status stays success). */
const softError = (message: string): ActionOutcome => ({
  status: 'success',
  output: { error: message },
})

/** Optional positive integer prop — `undefined` when absent or non-numeric. */
export const optionalNumber = (
  p: Readonly<Record<string, unknown>>,
  key: string
): number | undefined => {
  const raw = p[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

/**
 * List the keys under the action's `prefix`, keep those `admit` lets through,
 * then apply `limit` to what is left: a limit counts the keys listed, never
 * the keys left out. The `file/list` step (`gatedFileList`) admits every key
 * in a run nobody started, and what its starter may reach in one started by hand.
 */
export const listFilesUnder = <R>(
  action: Readonly<Record<string, unknown>>,
  admit: (keys: readonly string[]) => Effect.Effect<readonly string[], never, R>
): Effect.Effect<ActionOutcome, never, StorageService | R> =>
  Effect.gen(function* () {
    const p = props(action)
    const prefix = stringProp(p, 'prefix')
    const limit = optionalNumber(p, 'limit')

    const storage = yield* StorageService
    const listed = yield* Effect.result(storage.list(prefix))
    if (listed._tag === 'Failure') return softError(`failed to list files under ${prefix}`)

    const admitted = yield* admit(listed.success)
    const keys = limit !== undefined ? admitted.slice(0, limit) : admitted
    return {
      status: 'success',
      output: { files: keys.map((key) => ({ key })) },
    } as const
  }).pipe(
    Effect.withSpan('automations.file-list-admitted', { attributes: actionAttributes(action) })
  )

// ---------------------------------------------------------------------------
// getMetadata
// ---------------------------------------------------------------------------

export const handleFileGetMetadata: ActionHandler = (action) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return softError('file.getMetadata requires a key')

    const storage = yield* StorageService
    const meta = yield* Effect.result(storage.getMetadata(key, UNATTRIBUTED_BUCKET))
    if (meta._tag === 'Failure') return softError(`file not found: ${key}`)

    // The recorded bucket stays internal: the step output keeps its documented shape.
    const { bucket: _bucket, ...metadata } = meta.success
    return { status: 'success', output: metadata } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-get-metadata', {
      attributes: actionAttributes(action),
    })
  )

// ---------------------------------------------------------------------------
// copy / move (download + upload [+ delete])
// ---------------------------------------------------------------------------

/** Whether a failed catalog read is the "no such row" verdict rather than an outage. */
const isCatalogMiss = (cause: Cause.Cause<StorageError>): boolean => {
  const error = Cause.findErrorOption(cause)
  return Option.isSome(error) && isStorageObjectNotFound(error.value)
}

/** Log a catalog read that failed for a reason other than a missing row. */
const logCatalogFailure = (key: string, cause: Cause.Cause<StorageError>): void =>
  logError('[automations] file copy could not read the source bucket', cause, {
    'sovrium.storage.key': key,
  })

/**
 * The bucket the catalog records for `key`, or the unattributed opt-out when it
 * records none — or has no row at all (a key written to the object store out of
 * band, which the unattributed download below still reaches).
 *
 * A catalog that could not be read at all falls back the same way, but that is
 * an outage rather than an ordinary answer, so it is reported first: a copy that
 * silently lost its bucket would leave the file out of every bucket's reach with
 * nothing in the log to say why. `report` is the seam a test observes.
 */
export const recordedBucket = (
  storage: Storage,
  key: string,
  report: (key: string, cause: Cause.Cause<StorageError>) => void = logCatalogFailure
): Effect.Effect<BucketBinding, never> =>
  storage.getMetadata(key, UNATTRIBUTED_BUCKET).pipe(
    Effect.map((meta): BucketBinding => meta.bucket ?? UNATTRIBUTED_BUCKET),
    Effect.tapCause((cause) =>
      isCatalogMiss(cause) ? Effect.void : Effect.sync(() => report(key, cause))
    ),
    // effect-swallow: no catalog row is the ordinary case for a key written out of band, and the download that just succeeded proved the store answers; unattributed is the safe binding, and any other failure was logged just above
    Effect.orElseSucceed((): BucketBinding => UNATTRIBUTED_BUCKET),
    Effect.withSpan('automations.file.recorded-bucket')
  )

/**
 * Copy `sourceKey`'s bytes to `destinationKey` via the storage port. Returns
 * the byte count on success, or a {@link softError} `ActionOutcome` on the
 * first failed step (so `move`/`copy` only have to inspect one branch).
 *
 * The destination is written under the SOURCE's recorded bucket: a file held
 * by a bucket stays reachable through that bucket (its API, `ai/transcribe`
 * with `bucket`) after it is copied or moved, instead of falling out of every
 * bucket. An unattributed source stays unattributed, so a copy never exposes
 * a file through a bucket it did not already belong to.
 */
const copyBytes = (
  storage: Storage,
  sourceKey: string,
  destinationKey: string
): Effect.Effect<
  { readonly size: number; readonly bucket: BucketBinding } | ActionOutcome,
  never
> =>
  Effect.gen(function* () {
    const downloaded = yield* Effect.result(storage.download(sourceKey, UNATTRIBUTED_BUCKET))
    if (downloaded._tag === 'Failure') return softError(`file not found: ${sourceKey}`)
    const bucket = yield* recordedBucket(storage, sourceKey)
    const mime = mimeByExt(destinationKey) ?? mimeByExt(sourceKey) ?? 'application/octet-stream'
    const file = { bytes: downloaded.success, contentType: mime }
    const wrote = yield* uploadArtifactTo(storage, destinationKey, file, bucket)
    if (!wrote) return softError(`failed to write ${destinationKey}`)
    return { size: downloaded.success.length, bucket }
  })

/**
 * Whether `destinationKey` names the very object `sourceKey` does, as the
 * storage host compares keys: equal after Unicode NFC, or a second spelling the
 * host folds onto the stored source (letter case, where it folds it). A store
 * that cannot answer the spelling read is logged and judged on NFC alone.
 */
const sameStoredObject = (storage: Storage, sourceKey: string, destinationKey: string) => {
  const exact = { caseInsensitive: false }
  if (
    storageKeyCollisionForm(sourceKey, exact) === storageKeyCollisionForm(destinationKey, exact)
  ) {
    return Effect.succeed(true)
  }
  return storage.findOtherSpelling(destinationKey).pipe(
    Effect.map((other) => Option.isSome(other) && other.value.key === sourceKey),
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[automations] a move could not compare its two keys', cause))
    ),
    // effect-swallow: the copy below then reads and writes through the same store, which refuses a second spelling itself; logged just above.
    Effect.orElseSucceed(() => false)
  )
}

/**
 * Copy (or move) one stored file onto another key. In a run started by hand
 * the gates (`gated-file-operator.ts`) have already refused a destination this run
 * did not write; the file written here is recorded as the run's own, in the
 * bucket it lands in, so a later step of the same run may use or replace it.
 */
const copyOrMove = (
  action: Readonly<Record<string, unknown>>,
  automation: AutomationContext,
  deleteSource: boolean
): Effect.Effect<ActionOutcome, never, StorageService> =>
  Effect.gen(function* () {
    const p = props(action)
    const sourceKey = stringProp(p, 'sourceKey')
    const destinationKey = stringProp(p, 'destinationKey')
    if (!sourceKey || !destinationKey) {
      return softError(
        `file.${deleteSource ? 'move' : 'copy'} requires sourceKey and destinationKey`
      )
    }

    const storage = yield* StorageService
    // A move onto its own key would copy the file onto itself, then remove it.
    if (deleteSource && (yield* sameStoredObject(storage, sourceKey, destinationKey))) {
      return softError('file.move destinationKey must differ from sourceKey')
    }
    const copied = yield* copyBytes(storage, sourceKey, destinationKey)
    if ('status' in copied) return copied
    const { bucket } = copied
    yield* Effect.sync(() =>
      recordOwnCopy(automation.writtenFiles, { bucket, sourceKey, destinationKey })
    )

    if (deleteSource) {
      const removed = yield* Effect.result(storage.delete(sourceKey, UNATTRIBUTED_BUCKET))
      if (removed._tag === 'Failure') return softError(`failed to remove source ${sourceKey}`)
      // The run moved its file away: the key it left is no longer its own.
      yield* Effect.sync(() => forgetRemovedKey(automation, sourceKey))
    }

    const base = { key: destinationKey, destinationKey, sourceKey, size: copied.size }
    return {
      status: 'success',
      output: deleteSource ? { ...base, moved: true } : { ...base, copied: true },
    } as const
  })

export const handleFileCopy: ActionHandler = (action, _app, automation) =>
  copyOrMove(action, automation, false)

export const handleFileMove: ActionHandler = (action, _app, automation) =>
  copyOrMove(action, automation, true)

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

export const handleFileDelete: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return { status: 'failure', error: 'file.delete requires a key' } as const

    const storage = yield* StorageService
    const removed = yield* Effect.result(storage.delete(key, UNATTRIBUTED_BUCKET))
    if (removed._tag === 'Failure') {
      return { status: 'failure', error: `file not found: ${key}` } as const
    }
    // A key the run deleted is no longer its own; a delete that failed forgets nothing.
    yield* Effect.sync(() => forgetRemovedKey(automation, key))
    return { status: 'success', output: { deleted: true, key } } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-delete', { attributes: actionAttributes(action) })
  )

// ---------------------------------------------------------------------------
// signUrl
// ---------------------------------------------------------------------------

/**
 * Both links are Sovrium's own, served by the app on every storage provider. A
 * download link names the key ({@link signDownloadLink}). An upload link is
 * Sovrium's signed upload into the `system` bucket ({@link signUploadLink}), so
 * every rule of that road — catalogue, type, size, never over a stored key —
 * holds for what lands through it.
 */
export const handleFileSignUrl: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const p = props(action)
    const key = stringProp(p, 'key')
    if (!key) return softError('file.signUrl requires a key')
    const expiresIn = optionalNumber(p, 'expiresIn') ?? 3600
    const contentType = p['contentType'] !== undefined ? stringProp(p, 'contentType') : undefined

    if (p['operation'] !== 'upload') return signDownloadLink(key, expiresIn)
    const storage = yield* StorageService
    return yield* signUploadLink(storage, app, { key, expiresIn, contentType })
  }).pipe(
    Effect.withSpan('automations.handle-file-sign-url', { attributes: actionAttributes(action) })
  )
