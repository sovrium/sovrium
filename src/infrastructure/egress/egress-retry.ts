/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Retry policy for network egress, as an Effect `Schedule`.
 *
 * The shape is deliberately the same as the automation-action policy in
 * `src/application/use-cases/automations/run/types.ts` — exponential growth
 * from a base delay, every sleep capped, a hard ceiling on attempts. That one
 * stays where it is: it is driven by operator-authored `retry:` config and
 * belongs to the automation runtime. This one is infrastructure's own default
 * for calls Sovrium makes on its own initiative, so it lives beside
 * `with-fetch-timeout.ts` rather than being hoisted into `src/domain/` (I13 —
 * the domain layer may not import Effect's runtime surface).
 *
 * WHAT MAY USE IT. Only an **idempotent** egress: re-running it must be
 * indistinguishable, to the peer, from running it once. Embeddings, chat
 * completions that have not started streaming, S3 reads / listings, and remote
 * schema loads qualify. An S3 write, an SMTP send and a webhook POST do not —
 * a retry there is a duplicate side effect, and the caller cannot tell a lost
 * response from a lost request.
 *
 * WHAT IT DOES NOT DO. It does not decide *which failures* are transient. That
 * judgement is per-protocol (an HTTP 400 is permanent, a 503 is not) and lives
 * at the call site as `Effect.retry`'s `while` predicate. A schedule that
 * retried everything would turn a malformed request into three malformed
 * requests.
 */

import { Duration, Effect, Schedule } from 'effect'

/**
 * First inter-attempt delay. Long enough to let a peer finish a failover or a
 * connection-pool refill, short enough that three attempts stay inside a
 * typical HTTP request budget (200 + 400 = 600 ms of sleeping at the default).
 */
const DEFAULT_EGRESS_RETRY_BASE_DELAY_MS = 200

/**
 * Ceiling on any single inter-attempt sleep. Exponential growth is useful for
 * the first couple of attempts and pathological after that: without a cap a
 * generous `attempts` wedges the calling request for minutes.
 */
const DEFAULT_EGRESS_RETRY_MAX_DELAY_MS = 5000

/**
 * Total attempts, the first one included. Three is the smallest number that
 * survives the failure this exists for — a single peer dropping one connection
 * mid-failover — without turning a genuine outage into a long stall.
 */
const DEFAULT_EGRESS_RETRY_ATTEMPTS = 3

/** Tuning knobs; every one falls back to the documented default above. */
export interface EgressRetryOptions {
  /** Total attempts, the first included. Values below 1 are clamped to 1. */
  readonly attempts?: number
  /** First inter-attempt delay in milliseconds. */
  readonly baseDelayMs?: number
  /** Cap applied to every inter-attempt delay, in milliseconds. */
  readonly maxDelayMs?: number
}

/**
 * Exponential back-off emitting one delay before each RETRY — none before the
 * first attempt and none after the last failure — so `attempts: N` yields
 * `N - 1` delays and exactly `N` invocations of the effect.
 *
 * The exact sequence is pinned in `egress-retry.test.ts`; no E2E spec can
 * observe it, so that unit test is the only guard against silent drift.
 */
export const egressRetrySchedule = (
  options: Readonly<EgressRetryOptions> = {}
): Schedule.Schedule<Duration.Duration> => {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_EGRESS_RETRY_ATTEMPTS)
  const base = options.baseDelayMs ?? DEFAULT_EGRESS_RETRY_BASE_DELAY_MS
  const cap = options.maxDelayMs ?? DEFAULT_EGRESS_RETRY_MAX_DELAY_MS
  // `exponential` computes `base * 2^(attempt - 1)`, 1-indexed.
  return Schedule.exponential(Duration.millis(base), 2).pipe(
    Schedule.modifyDelay(({ duration }) =>
      Effect.succeed(Duration.min(duration, Duration.millis(cap)))
    ),
    // `attempts` counts TOTAL attempts and the first is not a retry, so the
    // schedule may recur at most `attempts - 1` times.
    Schedule.upTo({ times: attempts - 1 })
  )
}

/**
 * HTTP statuses worth a second attempt: a request timeout, a rate-limit, and
 * the 5xx family a load balancer emits while a backend is being replaced.
 * Everything else — 400, 401, 403, 404, 422 — is the peer telling us the
 * request itself is wrong, and repeating it is noise.
 */
const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504])

/**
 * True when an HTTP status code describes a transient condition.
 *
 * Adapters that cannot reach the peer at all (DNS failure, connection refused)
 * map the rejection to a synthetic `502`, so a network-level failure lands in
 * this set without a separate branch.
 */
export const isRetryableHttpStatus = (statusCode: number): boolean =>
  RETRYABLE_HTTP_STATUSES.has(statusCode)
