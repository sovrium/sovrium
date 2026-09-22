/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Once-per-process S3 bucket reachability probe.
 *
 * `StorageServiceLive` used to `Effect.tryPromise` a `s3ValidateBucket()` LIST
 * inside its `Layer.effect` body and FAIL construction when the bucket did not
 * answer. Two consequences followed from that, and both were wrong:
 *
 *  - **Every layer build paid a network round trip.** The layer is built once
 *    per composition, and `routes/buckets/effect-runner.ts` re-provided it per
 *    request — so a signed-URL request cost an S3 `LIST` before it did any
 *    work.
 *  - **A route-level outage read as a construction failure.** Once the domain
 *    layer is owned by the server runtime (see
 *    `@docs/infrastructure/framework/effect.md`, "Runtime and lifecycle"), a
 *    bucket that is briefly unreachable would take down the whole runtime —
 *    every route, not just the ones that touch storage — and every caller's
 *    tagged union would have to name a `StorageError` it cannot act on. That is
 *    why both composition roots had to wrap the layer in `Layer.orDie`.
 *
 * So the probe is now advisory: it runs at most once per process per endpoint,
 * never fails, and reports its outcome so the caller can log it. Operator
 * ENV VALIDATION stays fatal and stays where it was — a missing
 * `STORAGE_S3_BUCKET` is a configuration error the operator must fix before the
 * process is useful, whereas an unreachable bucket is a condition that can
 * resolve itself while the server runs.
 *
 * NO TTL, deliberately, where {@link import('./../ai/ollama-reachability')}'s
 * sibling memo has one: the Ollama result DECIDES provider routing on every AI
 * request, so it has to catch up with an operator who starts Ollama. This
 * result decides nothing — it is a log line — so re-probing would buy a warning
 * nobody reads at the cost of a round trip on every rebuild.
 */

/** The outcome of one probe: reachable, or the cause it was not. */
export interface S3BucketProbeResult {
  readonly reachable: boolean
  /** Present only when `reachable` is false; the rejection the LIST produced. */
  readonly cause?: unknown
}

/** A settled-or-in-flight probe, keyed by the endpoint it was taken against. */
interface CachedProbe {
  /** `<endpoint>|<bucket>` — a different one is a cache MISS. */
  readonly key: string
  /** Stored UNRESOLVED so concurrent builds share one round trip. */
  readonly result: Promise<S3BucketProbeResult>
}

// eslint-disable-next-line functional/no-let -- process-local memo; surviving across layer builds is the entire point
let cached: CachedProbe | undefined

/**
 * Probe the bucket once per process, per endpoint.
 *
 * @param key - `<endpoint>|<bucket>`. An operator repointing either must not be
 *   answered from a memo taken against the old one.
 * @param validate - The reachability check. Injected rather than imported so a
 *   unit test can drive both outcomes without a network or a live S3 client.
 * @returns Never rejects: a rejection from `validate` becomes
 *   `{ reachable: false, cause }`, so a stored promise can never surface as an
 *   unhandled rejection.
 */
export const probeS3BucketOnce = (
  key: string,
  validate: () => Promise<unknown>
): Promise<S3BucketProbeResult> => {
  if (cached !== undefined && cached.key === key) return cached.result

  const result = validate().then(
    (): S3BucketProbeResult => ({ reachable: true }),
    (cause: unknown): S3BucketProbeResult => ({ reachable: false, cause })
  )
  // eslint-disable-next-line functional/no-expression-statements -- writing the memo is the point
  cached = { key, result }
  return result
}
