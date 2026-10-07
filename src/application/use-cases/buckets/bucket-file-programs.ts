/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four things a bucket endpoint actually DOES: read a file, transform one,
 * write one, and remove one — plus the quota question a write has to ask first.
 *
 * Each declares the `StorageService` port and nothing else. No Hono context, no
 * status codes, no headers: a caller that is not HTTP (the automation `file:*`
 * actions, a CLI, the static build) reaches the same programs and gets the same
 * refusals. Turning a `StorageError` into 404-versus-500, and a transform
 * rejection into 400-versus-500, is the HTTP caller's job — the distinction
 * needs `isNotFoundError`, which is a wire-level judgement about a message, not
 * a property of the operation.
 */

import { Data, Effect } from 'effect'
import {
  ImageTransformService,
  type NegotiatedTransformFailure,
} from '@/application/ports/services/image-transform-service'
import {
  StorageService,
  isStorageObjectNotFound,
} from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import type { StorageError } from '@/application/ports/services/storage-service'
import type { TransformParams } from '@/domain/models/app/buckets/image-transform-params'

/**
 * The requested transform could not be produced.
 *
 * A tagged failure rather than an `{ ok: false }` return, because it is a
 * failure: the caller asked for bytes this file or this build cannot produce,
 * and there is no silent passthrough because answering with the UNtransformed
 * bytes would let an operator believe a transform had run.
 * `failure.reason` distinguishes an undecodable source and a missing encoder
 * (both the caller's problem) from a genuine pipeline fault.
 */
export class ImageTransformRejected extends Data.TaggedError('ImageTransformRejected')<{
  readonly failure: NegotiatedTransformFailure
}> {}

/** Bytes ready to be served, with the content type they are actually in. */
export interface TransformedFile {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/** Read a file's bytes from the bucket it belongs to. */
export const readBucketFile = (input: {
  readonly key: string
  readonly bucket: string
}): Effect.Effect<Uint8Array, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.download(input.key, input.bucket)
  }).pipe(Effect.withSpan('buckets.read-file'))

/**
 * Read a file and run the on-the-fly image transform over it.
 *
 * The `Accept` header drives format negotiation when no explicit `format` was
 * supplied, which is why an image download with no transform parameters still
 * comes through here — it may still be transcoded.
 *
 * When the transform produced a concrete output format the content type reflects
 * THAT format; otherwise it falls back to the stored filename's suffix, which is
 * the only other evidence of what the bytes are.
 */
export const produceTransformedFile = (input: {
  readonly key: string
  readonly bucket: string
  readonly transform: TransformParams
  readonly acceptHeader: string | undefined
}): Effect.Effect<
  TransformedFile,
  StorageError | ImageTransformRejected,
  StorageService | ImageTransformService
> =>
  Effect.gen(function* () {
    const source = yield* readBucketFile({ key: input.key, bucket: input.bucket })
    const transformed = yield* (yield* ImageTransformService).negotiateTransform(
      source,
      input.transform,
      input.acceptHeader
    )
    if (!transformed.ok) return yield* new ImageTransformRejected({ failure: transformed })
    return {
      bytes: transformed.bytes,
      contentType: transformed.contentType ?? inferMimeFromKey(input.key),
    }
  }).pipe(Effect.withSpan('buckets.produce-transformed-file'))

/**
 * Write a file's bytes into a bucket under an already-resolved key, recording
 * `uploadedById` — the signed-in person behind the write — as its uploader.
 */
export const storeBucketFile = (input: {
  readonly key: string
  readonly content: Uint8Array
  readonly mimeType: string
  readonly bucket: string
  readonly uploadedById?: string
}): Effect.Effect<void, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(input.key, input.content, input.mimeType, {
      bucket: input.bucket,
      uploadedById: input.uploadedById,
    })
  }).pipe(Effect.withSpan('buckets.store-file'))

/** Whether a bucket holds an object at a key, and who the catalog says uploaded it. */
export type StoredObjectOwner =
  { readonly stored: false } | { readonly stored: true; readonly uploadedBy: string | undefined }

/**
 * Who uploaded the object a bucket holds at `key` — what the owner-or-admin
 * rule reads before a delete or an overwrite. A key the bucket does not hold
 * (absent, or another bucket's) answers `stored: false`; any other storage
 * failure propagates, so an outage is never mistaken for "nobody's".
 */
export const readStoredObjectOwner = (input: {
  readonly key: string
  readonly bucket: string
}): Effect.Effect<StoredObjectOwner, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const found = yield* Effect.result(storage.getMetadata(input.key, input.bucket))
    if (found._tag === 'Success') {
      return { stored: true, uploadedBy: found.success.uploadedBy } as const
    }
    if (isStorageObjectNotFound(found.failure)) return { stored: false } as const
    return yield* found.failure
  }).pipe(Effect.withSpan('buckets.read-object-owner'))

/** Remove a file from a bucket. */
export const removeBucketFile = (input: {
  readonly key: string
  readonly bucket: string
}): Effect.Effect<void, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    // Bracket notation: `storage.delete(...)` trips drizzle/enforce-delete-with-where.
    yield* storage['delete'](input.key, input.bucket)
  }).pipe(Effect.withSpan('buckets.remove-file'))

/** What the deployment-wide storage cap has to say about one incoming upload. */
export type QuotaVerdict =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'exceeded'; readonly projected: number; readonly cap: number }

/**
 * Decide whether one more upload fits under `STORAGE_MAX_TOTAL_SIZE`.
 *
 * The cap is an operator lever, so an unset or unparseable value means "no cap"
 * rather than "no uploads". A probe that FAILS also allows the write: the upload
 * itself is about to touch the same backend and will surface any genuine
 * connectivity problem with a better message than a quota check could — and
 * refusing every upload because the total could not be read would turn a
 * read-side outage into a write-side one.
 */
export const checkStorageQuota = (
  incomingSize: number
): Effect.Effect<QuotaVerdict, never, StorageService> => {
  const maxTotalSizeEnv = process.env['STORAGE_MAX_TOTAL_SIZE']
  if (maxTotalSizeEnv === undefined || maxTotalSizeEnv === '')
    return Effect.succeed({ kind: 'allowed' })

  const cap = parseInt(maxTotalSizeEnv, 10)
  if (!Number.isFinite(cap) || cap <= 0) return Effect.succeed({ kind: 'allowed' })

  return Effect.gen(function* () {
    const storage = yield* StorageService
    const used = yield* storage.getTotalBytes
    const projected = used + incomingSize
    return projected > cap
      ? ({ kind: 'exceeded', projected, cap } as const)
      : ({ kind: 'allowed' } as const)
  }).pipe(
    // effect-swallow: an unreadable total must not block a write. The upload that follows touches the same backend and reports a real outage itself; see this function's doc comment.
    Effect.orElseSucceed(() => ({ kind: 'allowed' }) as const),
    Effect.withSpan('buckets.check-quota')
  )
}
