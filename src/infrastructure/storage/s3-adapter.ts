/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'
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
 * Parameters for {@link s3Upload}
 */
export interface S3UploadParams {
  readonly client: Bun.S3Client
  readonly bucket: string
  readonly key: string
  readonly content: Uint8Array
  readonly mimeType: string
}

export const s3Upload = async (params: S3UploadParams): Promise<void> => {
  const { client, bucket, key, content, mimeType } = params
  assertCanonicalS3Key(key)
  // No retry: a re-sent PUT after a lost response can write the object twice.
  await Effect.runPromise(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
      Effect.tryPromise({
        try: () => client.write(key, content, { bucket, type: mimeType }),
        catch: passThrough,
      }),
      s3Deadline('upload', S3_DATA_TIMEOUT_MS)
    )
  )
}

export const s3Download = async (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Promise<Uint8Array> => {
  assertCanonicalS3Key(key)
  return Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.file(key, { bucket }).bytes(), catch: passThrough }),
        s3Deadline('download', S3_DATA_TIMEOUT_MS)
      )
    )
  )
}

export const s3Delete = async (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Promise<void> => {
  assertCanonicalS3Key(key)
  // No retry. A DELETE is idempotent by the S3 spec, but a versioned bucket
  // turns a repeat into a second delete MARKER — so the safe-looking case is
  // the one that quietly differs, and a failed delete is better surfaced than
  // papered over.
  await Effect.runPromise(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
      Effect.tryPromise({
        try: () => client.delete(key, { bucket }),
        catch: passThrough,
      }),
      s3Deadline('delete', S3_METADATA_TIMEOUT_MS)
    )
  )
}

/**
 * Keys returned per listing call. 1000 is the S3 API maximum.
 */
const LIST_PAGE_SIZE = 1000

/**
 * Hard ceiling on pages walked by one listing, i.e. 100 000 objects.
 *
 * A bucket listing is paginated and truncates SILENTLY at `maxKeys`: read as one
 * page, a bucket with 1500 objects answers with 1000 and no indication that 500
 * were dropped — so `s3List` would under-report files and `s3GetTotalBytes`
 * would return a quota figure that could never trip its own limit. Following the continuation
 * token fixes the common case, but an unbounded loop turns a dashboard read
 * into an unbounded round-trip count against a remote endpoint.
 *
 * So: paginate, and STATE the truncation when the ceiling is reached. A bounded
 * number that admits it is a floor is usable; a silent one is not.
 */
const MAX_LIST_PAGES = 100

/**
 * One paginated listing pass over a bucket.
 *
 * `truncated` is `true` when {@link MAX_LIST_PAGES} was exhausted with more
 * pages still pending — the results are then a prefix of the bucket, not the
 * whole of it.
 */
interface S3ListingPage {
  readonly items: ReadonlyArray<{ readonly key: string; readonly size: number }>
  readonly truncated: boolean
}

/**
 * Walk every listing page for `bucket`/`prefix`, up to {@link MAX_LIST_PAGES}.
 *
 * The bucket goes in `list`'s SECOND argument, which is the only place Bun
 * reads it from: a `bucket` passed inside the first (`S3ListObjectsOptions`)
 * argument is silently ignored and the client's default bucket is listed
 * instead — measured against a request-recording endpoint, not inferred from
 * the types, which do not carry `bucket` on that argument at all.
 */
const s3ListAll = async (
  client: Bun.S3Client,
  bucket: string,
  prefix?: string
): Promise<S3ListingPage> => {
  const step = async (
    token: string | undefined,
    pagesLeft: number,
    acc: ReadonlyArray<{ readonly key: string; readonly size: number }>
  ): Promise<S3ListingPage> => {
    // Bounded and retried PER PAGE, not per walk: a hundred pages against a
    // slow endpoint is slow but not stuck, and a deadline over the whole walk
    // would truncate a legitimately large bucket — the exact silent-truncation
    // failure `MAX_LIST_PAGES` exists to make visible.
    const response = await Effect.runPromise(
      retryIdempotentS3(
        Effect.timeoutOrElse(
          // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
          Effect.tryPromise({
            try: () =>
              client.list(
                {
                  ...(prefix ? { prefix } : {}),
                  maxKeys: LIST_PAGE_SIZE,
                  ...(token ? { continuationToken: token } : {}),
                },
                { bucket }
              ),
            catch: passThrough,
          }),
          s3Deadline('list', S3_METADATA_TIMEOUT_MS)
        )
      )
    )
    const items = [
      ...acc,
      ...(response.contents ?? [])
        .filter((item) => Boolean(item.key))
        // `size` is optional on the response: reading it as `undefined` would
        // poison the whole quota figure with `NaN`.
        .map((item) => ({ key: item.key, size: item.size ?? 0 })),
    ]
    const next = response.nextContinuationToken
    if (!response.isTruncated || !next) return { items, truncated: false }
    if (pagesLeft <= 1) return { items, truncated: true }
    return step(next, pagesLeft - 1, items)
  }

  return step(undefined, MAX_LIST_PAGES, [])
}

/**
 * Object keys under `prefix`.
 *
 * `truncated` is `true` when the listing hit {@link MAX_LIST_PAGES} and the
 * keys are therefore a prefix of the bucket rather than all of it.
 */
export const s3List = async (
  client: Bun.S3Client,
  bucket: string,
  prefix: string
): Promise<{ readonly keys: readonly string[]; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket, prefix)
  return { keys: page.items.map((item) => item.key), truncated: page.truncated }
}

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
export const s3ValidateBucket = async (client: Bun.S3Client, bucket: string): Promise<void> => {
  await Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({
          try: () => client.list({ maxKeys: 1 }, { bucket }),
          catch: passThrough,
        }),
        s3Deadline('bucket probe', S3_METADATA_TIMEOUT_MS)
      )
    )
  )
}

/**
 * Sum object sizes across the whole bucket, following the continuation token.
 * Used for `STORAGE_MAX_TOTAL_SIZE` on the S3 provider and for the footprint
 * dashboard's bucket row.
 *
 * `truncated` is `true` when the walk stopped at {@link MAX_LIST_PAGES}; the
 * byte count is then a LOWER BOUND, and the caller is expected to say so
 * rather than present it as the total.
 */
export const s3GetTotalBytes = async (
  client: Bun.S3Client,
  bucket: string
): Promise<{ readonly bytes: number; readonly truncated: boolean }> => {
  const page = await s3ListAll(client, bucket)
  return {
    bytes: page.items.reduce((sum, item) => sum + item.size, 0),
    truncated: page.truncated,
  }
}

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
