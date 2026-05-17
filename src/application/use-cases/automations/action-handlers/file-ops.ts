/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { mimeByExt } from './file-support'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

type Storage = Effect.Effect.Success<typeof StorageService>

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
    const listed = yield* Effect.either(storage.list(prefix))
    if (listed._tag === 'Left') return softError(`failed to list files under ${prefix}`)

    const keys = limit !== undefined ? listed.right.slice(0, limit) : listed.right
    return {
      status: 'success',
      output: { files: keys.map((key) => ({ key })) },
    } as const
  })

// ---------------------------------------------------------------------------
// getMetadata
// ---------------------------------------------------------------------------

export const handleFileGetMetadata: ActionHandler = (action) =>
  Effect.gen(function* () {
    const key = stringProp(props(action), 'key')
    if (!key) return softError('file.getMetadata requires a key')

    const storage = yield* StorageService
    const meta = yield* Effect.either(storage.getMetadata(key))
    if (meta._tag === 'Left') return softError(`file not found: ${key}`)

    return { status: 'success', output: { ...meta.right } } as const
  })

// ---------------------------------------------------------------------------
// copy / move (download + upload [+ delete])
// ---------------------------------------------------------------------------

/**
 * Copy `sourceKey`'s bytes to `destinationKey` via the storage port. Returns
 * the byte count on success, or a {@link softError} `ActionOutcome` on the
 * first failed step (so `move`/`copy` only have to inspect one branch).
 */
const copyBytes = (
  storage: Storage,
  sourceKey: string,
  destinationKey: string
): Effect.Effect<number | ActionOutcome, never> =>
  Effect.gen(function* () {
    const downloaded = yield* Effect.either(storage.download(sourceKey))
    if (downloaded._tag === 'Left') return softError(`file not found: ${sourceKey}`)
    const mime = mimeByExt(destinationKey) ?? mimeByExt(sourceKey) ?? 'application/octet-stream'
    const wrote = yield* Effect.either(storage.upload(destinationKey, downloaded.right, mime))
    if (wrote._tag === 'Left') return softError(`failed to write ${destinationKey}`)
    return downloaded.right.length
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
      const removed = yield* Effect.either(storage.delete(sourceKey))
      if (removed._tag === 'Left') return softError(`failed to remove source ${sourceKey}`)
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
    const removed = yield* Effect.either(storage.delete(key))
    if (removed._tag === 'Left') {
      return { status: 'failure', error: `file not found: ${key}` } as const
    }
    return { status: 'success', output: { deleted: true, key } } as const
  })

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
    const signed = yield* Effect.either(
      operation === 'upload'
        ? storage.getSignedUploadUrl(key, expiresIn, contentType)
        : storage.getSignedUrl(key, expiresIn)
    )
    if (signed._tag === 'Left') return softError(`failed to sign url for ${key}`)

    return {
      status: 'success',
      output: {
        url: signed.right,
        key,
        operation,
        expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      },
    } as const
  })
