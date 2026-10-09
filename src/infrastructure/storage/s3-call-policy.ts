/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Duration, Effect } from 'effect'
import { egressRetrySchedule } from '@/infrastructure/egress/egress-retry'

/**
 * How Sovrium calls an S3 endpoint: the deadline each operation runs under,
 * which rejections are worth a retry, and how a rejection reaches the caller.
 *
 * One policy for every S3 call site — the object adapter (`s3-adapter.ts`)
 * and the stored-size probe (`stored-object-size.ts`) both read it from here,
 * so a timeout or a retry rule cannot drift between them.
 */

/**
 * Deadline for an S3 call that moves object BYTES — an upload or a download
 * (standing rule E6). Generous, because the wall clock here is dominated by
 * the payload and the link, not by the peer's latency: a large attachment over
 * a slow uplink legitimately takes a minute. What it rules out is the case it
 * exists for — an endpoint mid-failover that accepts the connection and never
 * finishes.
 */
export const S3_DATA_TIMEOUT_MS = 120_000

/**
 * Deadline for an S3 call that moves only METADATA — one listing page, a
 * delete, a reachability check. These are fixed-size round trips against a
 * healthy endpoint, so 30 s is already an order of magnitude of headroom.
 * Applied PER PAGE in the adapter's paginated listing walk, not to the whole walk: a
 * hundred pages against a slow endpoint is slow but not stuck, and bounding
 * the walk would truncate a legitimately large bucket.
 */
export const S3_METADATA_TIMEOUT_MS = 30_000

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
 * Every consumer of the S3 adapter already wraps these functions in its own
 * `Effect.tryPromise` with its own error mapping (`storage-service-live.ts`
 * turns them into `StorageError`s naming the bucket), so nothing here should
 * re-shape the rejection. Effect 4's `runPromise` rejects with the RAW failure
 * value, so a caller still sees exactly what the S3 client produced — only the
 * timeout path substitutes an error of its own.
 */
export const passThrough = (cause: unknown): unknown => cause

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
export const s3Deadline = (
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
export const retryIdempotentS3 = <A>(
  effect: Effect.Effect<A, unknown>
): Effect.Effect<A, unknown> =>
  Effect.retry(effect, {
    schedule: egressRetrySchedule(),
    while: (cause: unknown) => !isPermanentS3Error(cause),
  })
