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
import { logError } from '@/infrastructure/logging/logger'
import { mimeByExt, uploadArtifactTo } from './file-support'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
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
const optionalNumber = (p: Readonly<Record<string, unknown>>, key: string): number | undefined => {
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

export const handleFileList: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const prefix = stringProp(p, 'prefix')
    const limit = optionalNumber(p, 'limit')

    const storage = yield* StorageService
    const listed = yield* Effect.result(storage.list(prefix))
    if (listed._tag === 'Failure') return softError(`failed to list files under ${prefix}`)

    const keys = limit !== undefined ? listed.success.slice(0, limit) : listed.success
    return {
      status: 'success',
      output: { files: keys.map((key) => ({ key })) },
    } as const
  }).pipe(Effect.withSpan('automations.handle-file-list', { attributes: actionAttributes(action) }))

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
): Effect.Effect<number | ActionOutcome, never> =>
  Effect.gen(function* () {
    const downloaded = yield* Effect.result(storage.download(sourceKey, UNATTRIBUTED_BUCKET))
    if (downloaded._tag === 'Failure') return softError(`file not found: ${sourceKey}`)
    const bucket = yield* recordedBucket(storage, sourceKey)
    const mime = mimeByExt(destinationKey) ?? mimeByExt(sourceKey) ?? 'application/octet-stream'
    const file = { bytes: downloaded.success, contentType: mime }
    const wrote = yield* uploadArtifactTo(storage, destinationKey, file, bucket)
    if (!wrote) return softError(`failed to write ${destinationKey}`)
    return downloaded.success.length
  })

const copyOrMove = (
  action: Readonly<Record<string, unknown>>,
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
    const copied = yield* copyBytes(storage, sourceKey, destinationKey)
    if (typeof copied !== 'number') return copied

    if (deleteSource) {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- StorageService port, not a Drizzle query builder
      const removed = yield* Effect.result(storage.delete(sourceKey, UNATTRIBUTED_BUCKET))
      if (removed._tag === 'Failure') return softError(`failed to remove source ${sourceKey}`)
    }

    const base = { key: destinationKey, destinationKey, sourceKey, size: copied }
    return {
      status: 'success',
      output: deleteSource ? { ...base, moved: true } : { ...base, copied: true },
    } as const
  })

export const handleFileCopy: ActionHandler = (action) => copyOrMove(action, false)

export const handleFileMove: ActionHandler = (action) => copyOrMove(action, true)

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

export const handleFileDelete: ActionHandler = (action) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return { status: 'failure', error: 'file.delete requires a key' } as const

    const storage = yield* StorageService
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- StorageService port, not a Drizzle query builder
    const removed = yield* Effect.result(storage.delete(key, UNATTRIBUTED_BUCKET))
    if (removed._tag === 'Failure') {
      return { status: 'failure', error: `file not found: ${key}` } as const
    }
    return { status: 'success', output: { deleted: true, key } } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-delete', { attributes: actionAttributes(action) })
  )

// ---------------------------------------------------------------------------
// signUrl
// ---------------------------------------------------------------------------

export const handleFileSignUrl: ActionHandler = (action) =>
  Effect.gen(function* () {
    const p = props(action)
    const key = stringProp(p, 'key')
    if (!key) return softError('file.signUrl requires a key')
    const operation = p['operation'] === 'upload' ? 'upload' : 'download'
    const expiresIn = optionalNumber(p, 'expiresIn') ?? 3600
    const contentType = p['contentType'] !== undefined ? stringProp(p, 'contentType') : undefined

    const storage = yield* StorageService
    const signed = yield* Effect.result(
      operation === 'upload'
        ? storage.getSignedUploadUrl(key, expiresIn, contentType)
        : storage.getSignedUrl(key, expiresIn)
    )
    if (signed._tag === 'Failure') return softError(`failed to sign url for ${key}`)

    return {
      status: 'success',
      output: {
        url: signed.success,
        key,
        operation,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-sign-url', { attributes: actionAttributes(action) })
  )
