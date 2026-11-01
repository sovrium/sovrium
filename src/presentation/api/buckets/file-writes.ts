/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The HTTP half of a bucket write once it has been admitted: the stored upload, and a failed delete. */

import { Data, Effect } from 'effect'
import {
  StorageKeySpellingTaken,
  StorageKeyTaken,
} from '@/application/ports/services/storage-service'
import {
  checkStorageQuota,
  storeBucketFile,
} from '@/application/use-cases/buckets/bucket-file-programs'
import { bucketUploadResponseSchema } from '@/domain/models/api/buckets/files'
import { logError } from '@/infrastructure/logging/logger'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { buildUploadStorageKey } from '@/infrastructure/storage/upload-key'
import { spellingTaken } from '@/presentation/api/buckets/object-ownership-gate'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import { respondWith } from '@/presentation/api/runtime/run-effect'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { Context } from 'hono'

/** The uploaded file's bytes could not be read off the request. */
class UploadedBytesError extends Data.TaggedError('UploadedBytesError')<{
  readonly cause: unknown
}> {}

/**
 * Persist a validated upload and return the HTTP response.
 *
 * The quota probe runs FIRST and its verdict is advisory by construction: an
 * unreadable total allows the write (see `checkStorageQuota`), so a read-side
 * outage never becomes a write-side one.
 */
export const persistUpload = (
  c: Context,
  file: File,
  target: { readonly bucket: string; readonly session: UserSession | undefined },
  explicitPath?: string
) =>
  Effect.gen(function* () {
    const { bucket } = target
    // The signed-in person behind the write is recorded as its uploader.
    const uploadedById = target.session?.userId
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: (cause) => new UploadedBytesError({ cause }),
    })
    const content = new Uint8Array(arrayBuffer)
    const mimeType = file.type || 'application/octet-stream'
    // An explicit `path` is stored verbatim (enables path-prefixed public keys);
    // otherwise a random per-upload key avoids filename collisions while keeping
    // the human-readable filename as a suffix for debugging convenience (shared
    // `<uuid>-<filename>` convention — see {@link buildUploadStorageKey}).
    const key = explicitPath ?? buildUploadStorageKey(file.name)

    const quota = yield* checkStorageQuota(content.length)
    if (quota.kind === 'exceeded') {
      return c.json(
        storageErrorBody(
          `Storage quota exceeded: ${quota.projected} > ${quota.cap} bytes`,
          'QUOTA_EXCEEDED'
        ),
        507
      )
    }

    const result = yield* Effect.result(
      storeBucketFile({ key, content, mimeType, bucket, uploadedById })
    )
    if (result._tag === 'Failure') return uploadFailureResponse(c, result.failure)

    // A write at an explicit path may replace an object already served: drop its
    // cached transforms, or the next download answers the bytes it replaced.
    evictTransformCacheForKey(key)

    return yield* respondWith(
      c,
      Effect.succeed({ success: true, key, size: content.length, mimeType, filename: file.name }),
      bucketUploadResponseSchema,
      201
    )
  })

/** The answer to an upload the store refused. */
const uploadFailureResponse = (c: Context, failure: { readonly cause: unknown }): Response => {
  const { cause } = failure
  logError('[buckets] upload failed', failure)
  // An explicit `path` lets a caller aim an ordinary upload at a key another
  // bucket owns. The storage layer refuses that write as not-found; answer 404
  // with the generic message rather than echoing it inside a 500, so the
  // refusal is indistinguishable from an absent key (S1).
  if (isNotFoundError(cause)) return notFound(c, 'File not found')
  // Another spelling of the key was stored since the route checked it.
  if (cause instanceof StorageKeySpellingTaken) return spellingTaken(c)
  const message = cause instanceof Error ? cause.message : String(cause)
  return c.json(storageErrorBody(`Upload failed: ${message}`, 'STORAGE_ERROR'), 500)
}

/** The 404 an absent object earns on delete, or the 500 any other storage failure does. */
export function deleteFailureResponse(c: Context, failure: { readonly cause: unknown }): Response {
  const { cause } = failure
  const isNotFound = isNotFoundError(cause)
  if (!isNotFound) {
    logError('[buckets] delete failed', failure)
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  return isNotFound
    ? notFound(c, 'File not found')
    : c.json(storageErrorBody(`Delete failed: ${message}`, 'STORAGE_ERROR'), 500)
}

/** The 409 a signed upload aimed at a stored object earns, at signing and at `PUT`. */
export const objectAlreadyStored = (c: Context): Response =>
  c.json(storageErrorBody('An object is already stored at this path', 'CONFLICT'), 409)

/**
 * The answer to a signed upload the store refused: a second spelling of a key
 * this bucket holds is that object (409), and another bucket's object answers
 * like an absent key (404).
 */
export const signedUploadFailure = (c: Context, cause: unknown): Response => {
  if (cause instanceof StorageKeySpellingTaken || cause instanceof StorageKeyTaken) {
    return objectAlreadyStored(c)
  }
  return isNotFoundError(cause)
    ? notFound(c, 'File not found')
    : c.json(storageErrorBody('Upload failed', 'STORAGE_ERROR'), 500)
}
