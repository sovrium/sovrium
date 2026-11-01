/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import {
  passThrough,
  retryIdempotentS3,
  s3Deadline,
  S3_DATA_TIMEOUT_MS,
  S3_METADATA_TIMEOUT_MS,
} from './s3-call-policy'
import type { S3StorageEnvConfig } from '@/domain/models/process-env/storage/storage'

/**
 * The S3 provider runs on Bun's native `Bun.S3Client`, not on `@aws-sdk/client-s3`.
 *
 * Bun ships an S3 client in the runtime, so the AWS SDK was a dependency the
 * shipped binary carried purely to speak a protocol Bun already speaks. The
 * call shapes are not interchangeable — AWS is `client.send(new XCommand({...}))`
 * with PascalCase fields, Bun is `write`/`file`/`list`/`delete`/`presign` with
 * camelCase ones — so the behaviour of this module is pinned by
 * `s3-adapter.test.ts` and by `[internal ref]-*`, not by its types.
 *
 * `bucket` stays a per-call parameter rather than being baked into the client,
 * because every function here already took it and the callers pass a single
 * configured bucket anyway.
 */
export const createS3Client = (config: S3StorageEnvConfig): Bun.S3Client =>
  new Bun.S3Client({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region,
    // Inverted, not renamed: AWS asks whether to FORCE path style, Bun asks
    // whether to use virtual-hosted style. `STORAGE_S3_FORCE_PATH_STYLE=true`
    // is the documented MinIO switch and must keep producing path-style URLs.
    virtualHostedStyle: !config.forcePathStyle,
  })

/**
 * Refuse a key the client would send as a different one.
 *
 * Bun's client trims a leading or trailing `/` and rewrites `\\` as `/` before
 * signing, and leaves `.` / `..` segments for the endpoint, which some
 * S3-compatible stores normalise. Ownership is recorded against the literal
 * key, so any of those would let an unowned spelling replace an owned object.
 * Exported for the sizing probe, which addresses objects the same way.
 */
export const assertCanonicalS3Key = (key: string): void => {
  if (!isCanonicalStorageKey(key)) {
    throw new Error(`Invalid storage key "${key}": it does not name exactly one stored object`)
  }
}

/**
 * {@link assertCanonicalS3Key} on the error channel: a refused key is a
 * FAILURE the caller maps (a `StorageError`), never a defect that would slip
 * past its mapping.
 */
export const canonicalS3Key = (key: string): Effect.Effect<void, unknown> =>
  // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: the refusal reaches the caller verbatim, as every other failure of this adapter does
  Effect.try({ try: () => assertCanonicalS3Key(key), catch: passThrough })

/**
 * The store answered, but not with anything this adapter can use: a refused
 * conditional write, a listing that cannot end. Sovrium's own failure, tagged
 * like `S3TimeoutError` so it stays distinguishable from the peer's rejections
 * passed through untouched.
 */
export class S3AnswerError extends Data.TaggedError('S3AnswerError')<{
  readonly message: string
}> {}

/**
 * Parameters for {@link s3Upload}
 */
export interface S3UploadParams {
  readonly client: Bun.S3Client
  readonly bucket: string
  readonly key: string
  readonly content: Uint8Array
  readonly mimeType: string
}

/**
 * Every function of this adapter returns an `Effect` whose error channel holds
 * the peer's own rejection verbatim (`passThrough`), or the `S3TimeoutError`
 * of an expired deadline. The caller maps it (`attemptStorage`) and runs it
 * in its own fiber, so the span and interruption of the request reach the call.
 */
export const s3Upload = (params: S3UploadParams): Effect.Effect<void, unknown> => {
  const { client, bucket, key, content, mimeType } = params
  // No retry: a re-sent PUT after a lost response can write the object twice.
  return canonicalS3Key(key).pipe(
    Effect.andThen(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
        Effect.tryPromise({
          try: () => client.write(key, content, { bucket, type: mimeType }),
          catch: passThrough,
        }),
        s3Deadline('upload', S3_DATA_TIMEOUT_MS)
      )
    ),
    Effect.asVoid
  )
}

/** How long the signed `PUT` of a create-only write stays valid. */
const CREATE_ONLY_URL_SECONDS = 300

/** Whether the store holds an object at `key`, asked of the store itself. */
const s3Exists = (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Effect.Effect<boolean, unknown> =>
  retryIdempotentS3(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
      Effect.tryPromise({ try: () => client.exists(key, { bucket }), catch: passThrough }),
      s3Deadline('exists', S3_METADATA_TIMEOUT_MS)
    )
  )

/** The request a create-only write sends: a seam, so a test can play the store's answer. */
export type S3ConditionalPut = (url: string, init: Readonly<RequestInit>) => Promise<Response>

const sendConditionalPut: S3ConditionalPut = (url, init) =>
  withFetchTimeout(url, init, S3_DATA_TIMEOUT_MS)

/**
 * {@link s3Upload} that replaces nothing: `taken` when an object is stored at
 * `key`. Bun's client sends no conditional header, so the bytes go in a signed
 * `PUT` carrying `If-None-Match: *`, which S3 answers `412` (or `409` for a
 * concurrent conditional write) when the key holds an object. A store that
 * ignores the header would replace the object, so the key is also checked
 * just before the bytes are sent; on such a store the window between that
 * check and the write stays open.
 */
export const s3UploadCreateOnly = (
  params: S3UploadParams,
  put: S3ConditionalPut = sendConditionalPut
): Effect.Effect<'written' | 'taken', unknown> =>
  Effect.gen(function* () {
    const { client, bucket, key, content, mimeType } = params
    yield* canonicalS3Key(key)
    if (yield* s3Exists(client, bucket, key)) return 'taken'
    // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: a signing failure reaches the caller verbatim
    const url = yield* Effect.try({
      try: () => client.presign(key, { bucket, method: 'PUT', expiresIn: CREATE_ONLY_URL_SECONDS }),
      catch: passThrough,
    })
    // No retry, as for `s3Upload`: a re-sent PUT after a lost response would answer `taken`.
    // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: the peer's own rejection reaches the caller verbatim; `put` carries its own deadline (`withFetchTimeout`)
    const response = yield* Effect.tryPromise({
      try: () =>
        put(url, {
          method: 'PUT',
          headers: { 'If-None-Match': '*', 'Content-Type': mimeType },
          body: content.slice(),
        }),
      catch: passThrough,
    })
    if (response.status === 412 || response.status === 409) return 'taken'
    if (!response.ok) {
      return yield* new S3AnswerError({
        message: `s3 create-only write of "${key}" failed with HTTP ${response.status}`,
      })
    }
    return 'written'
  })

export const s3Delete = (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Effect.Effect<void, unknown> =>
  // No retry. A DELETE is idempotent by the S3 spec, but a versioned bucket
  // turns a repeat into a second delete MARKER — so the safe-looking case is
  // the one that quietly differs, and a failed delete is better surfaced than
  // papered over.
  canonicalS3Key(key).pipe(
    Effect.andThen(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
        Effect.tryPromise({
          try: () => client.delete(key, { bucket }),
          catch: passThrough,
        }),
        s3Deadline('delete', S3_METADATA_TIMEOUT_MS)
      )
    ),
    Effect.asVoid
  )

/**
 * Fail unless the configured bucket is reachable with the configured credentials.
 *
 * A one-key listing rather than a bucket HEAD: Bun exposes no bucket-level
 * HEAD, and a listing capped at `maxKeys: 1` is the cheapest request that still
 * fails for a missing bucket and for bad credentials alike. What matters to the
 * caller is unchanged — an unreachable bucket fails BOOT rather than surfacing
 * on the first upload. The rejection is left to propagate; `storage-service-live`
 * is what turns it into a `StorageError` naming the bucket.
 */
export const s3ValidateBucket = (
  client: Bun.S3Client,
  bucket: string
): Effect.Effect<void, unknown> =>
  retryIdempotentS3(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the caller verbatim
      Effect.tryPromise({
        try: () => client.list({ maxKeys: 1 }, { bucket }),
        catch: passThrough,
      }),
      s3Deadline('bucket probe', S3_METADATA_TIMEOUT_MS)
    )
  ).pipe(Effect.asVoid)

/**
 * A time-limited URL that serves the object's bytes.
 *
 * `presign` is synchronous — signing is local arithmetic with no round trip —
 * but the function stays `async` so the port and its callers are untouched.
 *
 * NO DEADLINE, and that is not an omission. Its declared return type is
 * `string`, not `Promise<string>`: there is no network and nothing to time
 * out, so a wrapper here would be inert ceremony that reads as protection.
 * `sovrium/require-egress-timeout` counts `presign` among its S3 egress
 * methods and therefore still reports this site; the suppression stays
 * until `S3_EGRESS_METHODS` drops it, which is a change to `[internal ref]` and so
 * belongs to `[internal ref]`.
 */
export const s3GetSignedUrl = async (
  client: Bun.S3Client,
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> => {
  assertCanonicalS3Key(key)
  return client.presign(key, { bucket, expiresIn, method: 'GET' })
}
