/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hashStream, readStreamWithin } from './bounded-read'
import { canonicalS3Key } from './s3-adapter'
import { passThrough, retryIdempotentS3, s3Deadline, S3_DATA_TIMEOUT_MS } from './s3-call-policy'
import type { StoredObjectHash } from '@/application/ports/services/storage-service'

/**
 * The bytes of the object at `key`, read at most `maxBytes`: `undefined` once
 * the object passes the cap, streamed piece by piece so a larger object is never buffered
 * whole. The deadline aborts the transfer; a retry starts it again from the
 * first byte, and an object over the cap is an answer, never retried.
 */
export const s3DownloadWithin = (
  client: Bun.S3Client,
  bucket: string,
  key: string,
  maxBytes: number
): Effect.Effect<Uint8Array | undefined, unknown> =>
  canonicalS3Key(key).pipe(
    Effect.andThen(
      retryIdempotentS3(
        Effect.timeoutOrElse(
          // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
          Effect.tryPromise({
            try: (signal) =>
              readStreamWithin(client.file(key, { bucket }).stream(), maxBytes, signal),
            catch: passThrough,
          }),
          s3Deadline('download', S3_DATA_TIMEOUT_MS)
        )
      )
    )
  )

/**
 * The length and SHA-256 of the object at `key`, hashed while it is streamed:
 * memory stays constant whatever its size. The deadline aborts the transfer; a
 * retry hashes again from the first byte.
 */
export const s3HashObject = (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Effect.Effect<StoredObjectHash, unknown> =>
  canonicalS3Key(key).pipe(
    Effect.andThen(
      retryIdempotentS3(
        Effect.timeoutOrElse(
          // @effect-diagnostics-next-line unknownInEffectCatch:off -- as `s3DownloadWithin`: the peer's own rejection reaches the caller verbatim
          Effect.tryPromise({
            try: (signal) => hashStream(client.file(key, { bucket }).stream(), signal),
            catch: passThrough,
          }),
          s3Deadline('download', S3_DATA_TIMEOUT_MS)
        )
      )
    )
  )
