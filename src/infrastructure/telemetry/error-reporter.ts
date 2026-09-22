/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fire-and-forget Sentry-protocol error reporter
 *.
 *
 * Captured errors are serialized into a Sentry envelope and POSTed to the DSN's
 * envelope endpoint with a 3 s timeout. Reporting NEVER throws and never blocks
 * the request it observes — a slow or dead collector cannot take the app down.
 *
 * Backpressure guards keep a crash-looping app from flooding the backend:
 *   - a `WeakMap` prevents the same error object being reported twice when it
 *     surfaces at multiple boundaries (`.onError` + `logError`-with-cause) —
 *     TIME-SCOPED to the dedup window, so a long-lived exception singleton is
 *     never muted permanently;
 *   - a fingerprint dedup window (60 s default, `SENTRY_DEDUP_WINDOW_MS`)
 *     collapses identical repeats;
 *   - a 30-events/minute token bucket caps the outbound rate;
 *   - an HTTP 429 `Retry-After` mutes reporting for the advised window.
 *
 * Any OTHER non-2xx is not backpressure but a delivery failure, and is WARNed
 * about (once per `url:status` per dedup window) with an excerpt of the
 * receiver's response body — see `sendEnvelope`.
 *
 * Module-scoped mutable state (single-process deployments). The token bucket
 * composes the shared `createSlidingWindowLimiter()` primitive, as
 * `infrastructure/forms/form-rate-limiter.ts` does; the dedup guards do not,
 * because they answer "seen recently?" rather than "how many in the window".
 */

import { hostname } from 'node:os'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import { emitLog } from './observability-runtime'
import {
  buildAuthHeader,
  buildEnvelope,
  buildEventFromError,
  buildTransaction,
  type EventMeta,
  type RequestContext,
  type SentryEvent,
  type SentryTransaction,
  type TransactionInput,
} from './sentry-envelope'
import { getTelemetryConfig } from './telemetry-config'
import type { SentryDsn } from '@/domain/models/process-env/telemetry/sentry-dsn'
import type { SlidingWindowConfig } from '@/infrastructure/process/sliding-window-limiter'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const POST_TIMEOUT_MS = 3000
const FLUSH_CAP_MS = 2000
/** How much of a refusing receiver's response body travels into the WARN line. */
const BODY_EXCERPT_LIMIT = 200

/**
 * Fingerprint dedup window — how long an identical `name:message:first-frame`
 * is collapsed into its first report.
 *
 * Operator-overridable via `SENTRY_DEDUP_WINDOW_MS` (a deployment/backpressure
 * concern, so an env var — never the app schema). Mirrors the
 * `parseBlockTimeoutMs` idiom in `application/use-cases/admin/overview.ts`: a
 * missing, non-numeric, or non-positive value falls back to the 60 s default.
 *
 * Making it configurable is also what lets the E2E spec observe the window's
 * far side in ~2 s instead of parking a test process for 62 s.
 */
const DEFAULT_DEDUP_WINDOW_MS = 60_000
const parseDedupWindowMs = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DEDUP_WINDOW_MS
}
const DEDUP_WINDOW_MS = parseDedupWindowMs(process.env.SENTRY_DEDUP_WINDOW_MS)

// --- Module state (per-process) --------------------------------------------

/** Set-once reporter metadata (release/environment/server_name). */
const metaState = new Map<'meta', EventMeta>()
/** Set-once process-handler registration guard. */
const handlerState = new Map<'registered', true>()
/** 429 `Retry-After` mute deadline (ms-since-epoch). */
const muteState = new Map<'until', number>()
/** Double-report guard keyed on the error object identity → last-report ms. */
const reportedObjects = new WeakMap<object, number>()
/** Fingerprint → last-report ms, for the `DEDUP_WINDOW_MS` dedup window. */
const fingerprintSeen = new Map<string, number>()
/**
 * Report budget for the 30/min sliding window, on the shared limiter.
 *
 * One global bucket, so the key is a constant: this caps what the process as
 * a whole ships to the collector, deliberately unlike the per-caller limiters
 * elsewhere. The two dedup guards above stay bespoke — they hold ONE timestamp
 * per key and answer "seen recently?", with no count and no ceiling, which is
 * a different question from "how many in the window".
 */
const reportBudget = createSlidingWindowLimiter()
const REPORT_BUDGET_KEY = 'all'
const REPORT_BUDGET: SlidingWindowConfig = {
  windowMs: RATE_WINDOW_MS,
  maxRequests: RATE_LIMIT,
}
/** `url:status` → last-warned ms, so a refusing collector is warned about once. */
const deliveryFailureSeen = new Map<string, number>()

/**
 * Provide the reporter with its release/environment/server_name. Called once
 * from `activateTelemetry` during boot (before any request can error).
 */
export const initErrorReporter = (meta: EventMeta): void => {
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- set-once reporter meta
  metaState.set('meta', meta)
}

/** Register process-level crash handlers exactly once (DSN-gated by the caller). */
export const registerProcessErrorHandlers = (): void => {
  if (handlerState.get('registered')) return
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- set-once guard
  handlerState.set('registered', true)
  // eslint-disable-next-line functional/no-expression-statements -- register process crash handler
  process.on('uncaughtException', reportAndExit)
  // eslint-disable-next-line functional/no-expression-statements -- register process rejection handler
  process.on('unhandledRejection', reportAndExit)
}

/**
 * Report a captured error to the DSN endpoint (fire-and-forget). Returns a
 * promise that always resolves (never rejects) so callers can `void` it at a
 * request boundary or `await` it on a process-exit path without risking an
 * unhandled rejection.
 */
export const reportException = (error: unknown, request?: RequestContext): Promise<void> => {
  try {
    const config = getTelemetryConfig()
    const { errorReporting } = config
    if (errorReporting === undefined) return Promise.resolve()

    const now = Date.now()
    if (isMuted(now)) return Promise.resolve()
    if (isDuplicateObject(error, now)) return Promise.resolve()
    if (isDuplicateFingerprint(error, now)) return Promise.resolve()
    if (!allowByRate(now)) return Promise.resolve()

    const meta = resolveMeta(errorReporting.environment)
    const event = buildEventFromError(error, meta, request)
    return emitEnvelope(errorReporting.dsn, meta.release, 'event', event)
  } catch {
    return Promise.resolve()
  }
}

/** What the caller knows about a finished request, minus the reporter's own metadata. */
export type ReportTransactionInput = Omit<TransactionInput, 'meta'>

/**
 * Report a completed HTTP request as a Sentry performance transaction
 * (fire-and-forget). Shares the DSN ingest path with errors, so it is a no-op
 * unless error reporting is enabled. Sampling is the caller's responsibility —
 * this always emits when called (respecting only the 429 mute).
 *
 * The input is an options object rather than positional arguments because it
 * grew from four values to nine; `meta` is supplied here, since the release and
 * environment are the reporter's business and not the middleware's.
 */
export const reportTransaction = (input: ReportTransactionInput): void => {
  try {
    const { errorReporting } = getTelemetryConfig()
    if (errorReporting === undefined) return
    if (isMuted(Date.now())) return

    const meta = resolveMeta(errorReporting.environment)
    const transaction = buildTransaction({ ...input, meta })
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget transaction POST
    void emitEnvelope(errorReporting.dsn, meta.release, 'transaction', transaction)
  } catch {
    // Never throw — telemetry must not affect the observed request.
  }
}

// --- Internals -------------------------------------------------------------

const isMuted = (now: number): boolean => now < (muteState.get('until') ?? 0)

/**
 * Collapse the SAME error object surfacing at two boundaries (`.onError` plus
 * the `logError`-with-cause path) into one report.
 *
 * The guard is TIME-SCOPED, not permanent. It used to be a bare `WeakSet`, so
 * the first sighting of an object blacklisted it for the rest of the process
 * lifetime. That is fine for a freshly-thrown `Error` — a new object per
 * request — but catastrophic for a long-lived SINGLETON: `hono/timeout` builds
 * its exception once at module-import time, so the first API timeout muted
 * every subsequent one forever. The 2026-07-25 incident consequently showed a
 * single reported occurrence for a burst of ~6 real timeouts, and the recurrence
 * was invisible.
 *
 * Reusing `DEDUP_WINDOW_MS` keeps both guards on one clock: identity handles
 * the exact double-boundary case, the fingerprint window handles distinct
 * objects that describe the same failure.
 */
const isDuplicateObject = (error: unknown, now: number): boolean => {
  if (typeof error !== 'object' || error === null) return false
  const last = reportedObjects.get(error)
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true
  // eslint-disable-next-line functional/no-expression-statements -- double-report guard
  reportedObjects.set(error, now)
  return false
}

const isDuplicateFingerprint = (error: unknown, now: number): boolean => {
  const fp = fingerprint(error)
  const last = fingerprintSeen.get(fp)
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return true
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- dedup window
  fingerprintSeen.set(fp, now)
  return false
}

const allowByRate = (now: number): boolean => {
  if (reportBudget.isExceeded(REPORT_BUDGET_KEY, REPORT_BUDGET, now)) return false
  // eslint-disable-next-line functional/no-expression-statements -- record against the shared limiter's mutable store
  reportBudget.record(REPORT_BUDGET_KEY, REPORT_BUDGET, now)
  return true
}

const fingerprint = (error: unknown): string => {
  const err = error instanceof Error ? error : new Error(String(error))
  const firstFrame = (err.stack?.split('\n')[1] ?? '').trim()
  return `${err.name}:${err.message}:${firstFrame}`
}

const fallbackMeta = (environment: string): EventMeta => ({
  release: 'sovrium@0.0.0',
  environment,
  serverName: hostname(),
})

/** Reporter meta, or a hostname-derived fallback when boot init hasn't run. */
const resolveMeta = (environment: string): EventMeta =>
  metaState.get('meta') ?? fallbackMeta(environment)

const clientVersion = (release: string): string => release.replace(/^sovrium@/, '') || '0.0.0'

/**
 * Serialize a payload into an envelope, derive its `X-Sentry-Auth` header, and
 * POST it to the DSN endpoint. Shared by the error and transaction paths so the
 * identical build-body → derive-auth → send tail lives in exactly one place.
 */
const emitEnvelope = (
  dsn: SentryDsn,
  release: string,
  itemType: 'event' | 'transaction',
  payload: SentryEvent | SentryTransaction
): Promise<void> => {
  const body = buildEnvelope(payload.event_id, itemType, payload)
  const auth = buildAuthHeader(dsn, clientVersion(release))
  return sendEnvelope(dsn.envelopeUrl, body, auth)
}

/**
 * The one capability the send path needs from `fetch`, declared structurally
 * rather than as `typeof fetch`: the global type carries runtime-specific extras
 * (Bun adds `preconnect`) that a test stub has no business implementing.
 */
export type FetchLike = (input: string, init?: Readonly<RequestInit>) => Promise<Response>

/** Injectable seams so delivery-failure reporting is testable without a network. */
export interface EnvelopeSendDeps {
  readonly fetchImpl: FetchLike
  readonly log: (message: string) => void
  readonly now: () => number
}

const defaultSendDeps: EnvelopeSendDeps = {
  fetchImpl: fetch,
  // `emitLog`, deliberately — NOT `reportException`. Reporting a failure to
  // report would recurse straight back into this function.
  log: (message) => emitLog('warn', message),
  now: () => Date.now(),
}

/**
 * POST an envelope, never throwing. Honors HTTP 429 by muting further reports
 * for the advised `Retry-After` window (default 60 s), and WARNS on any other
 * non-2xx.
 *
 * That warning is the whole point of the second branch. This function used to
 * inspect `response.status` for 429 and nothing else, so a 400 (a payload the
 * receiver's schema rejects), a 401 (a stale key) or a 413 (an envelope over the
 * size cap) discarded the event with no signal on any surface. Combined with the
 * empty-backend ambiguity — no data looks the same as no traffic — that is how
 * error reporting can be broken for weeks while every gate stays green. The
 * response body carries the receiver's own validation error, which is the single
 * most useful diagnostic available, so an excerpt of it travels with the status.
 *
 * Exported for its unit test: the delivery-failure branch is only reachable
 * through an injected `fetch`.
 */
export const sendEnvelope = async (
  url: string,
  body: string,
  authHeader: string,
  deps: EnvelopeSendDeps = defaultSendDeps
): Promise<void> => {
  try {
    const response = await deps.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': authHeader,
      },
      body,
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    })
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 60
      // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- 429 backoff
      muteState.set('until', deps.now() + retryAfter * 1000)
      return
    }
    if (!response.ok) {
      await warnDeliveryRefused(url, response, deps)
    }
  } catch {
    // Never throw — a dead/slow collector must not break the observed request.
  }
}

/**
 * WARN once per `(url, status)` per dedup window. A collector refusing one
 * envelope is refusing all of them, so an un-deduplicated warning would out-shout
 * the errors it is trying to make visible. Same clock as the fingerprint window,
 * for the same reason: one backpressure story, not two.
 */
const warnDeliveryRefused = async (
  url: string,
  response: Response,
  deps: EnvelopeSendDeps
): Promise<void> => {
  const key = `${url}:${response.status}`
  const now = deps.now()
  const last = deliveryFailureSeen.get(key)
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- dedup window
  deliveryFailureSeen.set(key, now)

  const excerpt = await readBodyExcerpt(response)
  const detail = excerpt === '' ? '' : ` Response: ${excerpt}`
  deps.log(
    `Error reporting was refused by ${url} (HTTP ${response.status}) — the event was ` +
      `discarded. Check SENTRY_DSN and the receiver's ingest configuration.${detail}`
  )
}

/** First slice of the response body — the receiver's own validation error. */
const readBodyExcerpt = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).slice(0, BODY_EXCERPT_LIMIT).trim()
  } catch {
    return ''
  }
}

/** Report a fatal error, wait up to 2 s for delivery, then exit non-zero. */
const reportAndExit = (error: unknown): void => {
  // eslint-disable-next-line functional/no-expression-statements -- crash path: best-effort report, then terminate
  void Promise.race([
    reportException(error),
    new Promise<void>((resolve) => setTimeout(resolve, FLUSH_CAP_MS)),
  ]).finally(exitFailure)
}

const exitFailure = (): never => process.exit(1)
