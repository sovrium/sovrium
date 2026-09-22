/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Data, Duration, Effect } from 'effect'
import { egressRetrySchedule } from '@/infrastructure/egress/egress-retry'
import type { S3StorageEnvConfig } from '@/domain/models/process-env/storage/storage'

/**
 * Deadline for an S3 call that moves object BYTES — an upload or a download
 * (standing rule E6). Generous, because the wall clock here is dominated by
 * the payload and the link, not by the peer's latency: a large attachment over
 * a slow uplink legitimately takes a minute. What it rules out is the case it
 * exists for — an endpoint mid-failover that accepts the connection and never
 * finishes.
 */
const S3_DATA_TIMEOUT_MS = 120_000

/**
 * Deadline for an S3 call that moves only METADATA — one listing page, a
 * delete, a reachability check. These are fixed-size round trips against a
 * healthy endpoint, so 30 s is already an order of magnitude of headroom.
 * Applied PER PAGE in the paginated walk below, not to the whole walk: a
 * hundred pages against a slow endpoint is slow but not stuck, and bounding
 * the walk would truncate a legitimately large bucket.
 */
const S3_METADATA_TIMEOUT_MS = 30_000

/**
 * S3 `<Error><Code>` values that describe the REQUEST rather than a passing
 * condition. Bun surfaces the XML error code as the rejection's `code`, so a
 * missing key, a bad signature, or a denied ACL is recognisable — and retrying
 * any of them is three identical failures and three round trips.
 *
 * Everything else is treated as transient: `SlowDown`, `InternalError`,
 * `ServiceUnavailable`, `RequestTimeout`, and the connection-level rejections
 * that carry no S3 code at all.
 */
const PERMANENT_S3_ERROR_CODES: ReadonlySet<string> = new Set([
  'AccessDenied',
  'EntityTooLarge',
  'InvalidAccessKeyId',
  'InvalidArgument',
  'InvalidBucketName',
  'InvalidRequest',
  'MethodNotAllowed',
  'NoSuchBucket',
  'NoSuchKey',
  'SignatureDoesNotMatch',
])

/** True when a rejection names an S3 error code that a retry cannot fix. */
const isPermanentS3Error = (cause: unknown): boolean => {
  if (typeof cause !== 'object' || cause === null) return false
  const { code } = cause as { readonly code?: unknown }
  return typeof code === 'string' && PERMANENT_S3_ERROR_CODES.has(code)
}

/**
 * Preserve an S3 rejection verbatim on the Effect's error channel.
 *
 * Every consumer of this adapter already wraps these functions in its own
 * `Effect.tryPromise` with its own error mapping (`storage-service-live.ts`
 * turns them into `StorageError`s naming the bucket), so nothing here should
 * re-shape the rejection. Effect 4's `runPromise` rejects with the RAW failure
 * value, so a caller still sees exactly what the S3 client produced — only the
 * timeout path substitutes an error of its own.
 */
const passThrough = (cause: unknown): unknown => cause

/**
 * A deadline expired with the request still in flight.
 *
 * Tagged rather than a bare `Error` so it stays distinguishable from a
 * rejection the object store itself produced once it reaches a caller's
 * `catch`: everything else on this module's error channel is the peer's own
 * value, passed through untouched, and this is the one failure Sovrium
 * invented.
 */
class S3TimeoutError extends Data.TaggedError('S3TimeoutError')<{
  readonly operation: string
  readonly timeoutMs: number
  readonly message: string
}> {}

/**
 * The `Effect.timeoutOrElse` options for one S3 operation.
 *
 * HONEST LIMIT, the same one `withFetchTimeout`'s docblock records for HTTP:
 * Bun's `S3Client` exposes neither a timeout option nor an `AbortSignal`
 * (checked against `bun-types@1.4.1`: `S3Options` carries `retry`, `partSize`
 * and `queueSize`, and nothing that cancels). So this bounds the RESPONSE, not
 * the SOCKET — the abandoned request keeps its connection until the peer gives
 * up. It bounds the caller's latency, which is the property that was missing.
 */
const s3Deadline = (
  operation: string,
  timeoutMs: number
): {
  readonly duration: Duration.Duration
  readonly orElse: () => Effect.Effect<never, S3TimeoutError>
} => ({
  duration: Duration.millis(timeoutMs),
  orElse: () =>
    Effect.fail(
      new S3TimeoutError({
        operation,
        timeoutMs,
        message: `S3 ${operation} exceeded ${String(timeoutMs)}ms and was abandoned`,
      })
    ),
})

/**
 * Retry an S3 operation that is idempotent from the object store's point of
 * view — a read, a listing page, a reachability check.
 *
 * A WRITE must never carry this. The caller cannot distinguish a lost response
 * from a lost request, so a retry there risks a second object; Bun's own
 * `S3Options.retry` (default 3) already covers the upload path from inside the
 * client, where it can tell the two apart.
 */
const retryIdempotentS3 = <A>(effect: Effect.Effect<A, unknown>): Effect.Effect<A, unknown> =>
  Effect.retry(effect, {
    schedule: egressRetrySchedule(),
    while: (cause: unknown) => !isPermanentS3Error(cause),
  })

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
): Promise<Uint8Array> =>
  Effect.runPromise(
    retryIdempotentS3(
      Effect.timeoutOrElse(
        // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
        Effect.tryPromise({ try: () => client.file(key, { bucket }).bytes(), catch: passThrough }),
        s3Deadline('download', S3_DATA_TIMEOUT_MS)
      )
    )
  )

export const s3Delete = async (
  client: Bun.S3Client,
  bucket: string,
  key: string
): Promise<void> => {
  // No retry. A DELETE is idempotent by the S3 spec, but a versioned bucket
  // turns a repeat into a second delete MARKER — so the safe-looking case is
  // the one that quietly differs, and a failed delete is better surfaced than
  // papered over.
  await Effect.runPromise(
    Effect.timeoutOrElse(
      // @effect-diagnostics-next-line unknownInEffectCatch:off -- see `passThrough`: this adapter's contract is that the peer's own rejection reaches the Promise boundary verbatim
      Effect.tryPromise({
        // eslint-disable-next-line drizzle/enforce-delete-with-where -- an S3 object store, not a Drizzle query builder: `delete` takes a key, and there is no `where` to add
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
 * A bucket listing is paginated and truncates SILENTLY at `maxKeys`: a bucket
 * with 1500 objects used to answer with 1000 and no indication that 500 were
 * dropped — so `s3List` under-reported files and `s3GetTotalBytes` returned a
 * quota figure that could never trip its own limit. Following the continuation
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
 * methods and therefore still reports these two sites; the suppression stays
 * until `S3_EGRESS_METHODS` drops it, which is a change to `[internal ref]` and so
 * belongs to `[internal ref]`.
 */
export const s3GetSignedUrl = async (
  client: Bun.S3Client,
  bucket: string,
  key: string,
  expiresIn: number
): Promise<string> => client.presign(key, { bucket, expiresIn, method: 'GET' })

/**
 * Parameters for {@link s3GetSignedUploadUrl}
 */
export interface S3SignedUploadUrlParams {
  readonly client: Bun.S3Client
  readonly bucket: string
  readonly key: string
  readonly expiresIn: number
  readonly contentType?: string
}

/**
 * A time-limited URL that accepts a `PUT` of the object's bytes.
 *
 * When a content type is supplied it is bound INTO the signature, so an upload
 * declaring a different one is rejected by the object store. The AWS presigner
 * dropped it silently — the typed and untyped URLs were byte-identical — which
 * made the parameter look honoured while granting an unconstrained write.
 *
 * Carries no deadline, for the reason given on {@link s3GetSignedUrl}: signing
 * is local arithmetic and there is no request to abandon.
 */
export const s3GetSignedUploadUrl = async (params: S3SignedUploadUrlParams): Promise<string> => {
  const { client, bucket, key, expiresIn, contentType } = params
  return client.presign(key, {
    bucket,
    expiresIn,
    method: 'PUT',
    ...(contentType ? { type: contentType } : {}),
  })
}
