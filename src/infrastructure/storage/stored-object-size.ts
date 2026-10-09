/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageError, storageObjectNotFound } from '@/application/ports/services/storage-service'
import { assertCanonicalS3Key } from './s3-adapter'
import {
  S3_METADATA_TIMEOUT_MS,
  passThrough,
  retryIdempotentS3,
  s3Deadline,
} from './s3-call-policy'

/**
 * `StorageService.statObject` — the size of an object as the OBJECT STORE
 * reports it, with no catalog row required.
 *
 * The catalog only knows the objects this app wrote. A fleet agent is told to
 * apply a bundle the control plane wrote into the store they share, so its
 * catalog has no row for it, and a size read from the catalog fails as "File
 * not found" on a bundle that is there. Each provider therefore answers from
 * its own store: `read` resolves the size, or `undefined` when nothing is
 * stored under `key`.
 *
 * A store that answers but reports no usable size fails naming the key. The
 * caller sizes an object BEFORE downloading it, to refuse one too large to
 * buffer, so an unknown size must never read as "small enough".
 */
export const storedObjectSize = (
  key: string,
  read: () => Promise<number | undefined>
): Effect.Effect<{ readonly size: number }, StorageError> =>
  Effect.tryPromise({
    try: read,
    catch: (cause: unknown) => new StorageError({ cause }),
  }).pipe(
    Effect.flatMap((size) => {
      if (size === undefined) {
        return Effect.fail(new StorageError({ cause: storageObjectNotFound(key) }))
      }
      return Number.isSafeInteger(size) && size >= 0
        ? Effect.succeed({ size })
        : Effect.fail(new StorageError({ cause: `the store reported no size for ${key}` }))
    })
  )

/** True when an S3 rejection says nothing is stored under the key (a `HEAD` 404). */
const isNoSuchKey = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  (cause as { readonly code?: unknown }).code === 'NoSuchKey'

/**
 * The size of `key` in an S3 bucket — one `HEAD`, retried and bounded like
 * every other S3 read; `undefined` when the key holds nothing.
 */
export const s3StoredSize = (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Promise<number | undefined> => {
  assertCanonicalS3Key(key)
  return Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.file(key, { bucket }).stat(), catch: passThrough }),
        s3Deadline('stat', S3_METADATA_TIMEOUT_MS)
      )
    ).pipe(
      Effect.map((stats): { readonly size?: number } => stats),
      Effect.catchIf(isNoSuchKey, (): Effect.Effect<{ readonly size?: number }> =>
        Effect.succeed({})
      ),
      Effect.map((stats) => stats.size)
    )
  )
}
