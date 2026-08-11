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
 * Module-scoped mutable state (single-process deployments) mirrors
 * `infrastructure/forms/form-rate-limiter.ts`.
 */

import { hostname } from 'node:os'
import {
  buildAuthHeader,
  buildEnvelope,
  buildEventFromError,
  buildTransaction,
  type EventMeta,
  type RequestContext,
  type SentryEvent,
  type SentryTransaction,
} from './sentry-envelope'
import { getTelemetryConfig } from './telemetry-config'
import type { SentryDsn } from '@/domain/models/env/telemetry/sentry-dsn'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000
const POST_TIMEOUT_MS = 3000
const FLUSH_CAP_MS = 2000

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
/** Sliding-window report timestamps for the 30/min token bucket. */
const rateWindow = new Map<'all', ReadonlyArray<number>>()

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

/**
 * Report a completed HTTP request as a Sentry performance transaction
 * (fire-and-forget). Shares the DSN ingest path with errors, so it is a no-op
 * unless error reporting is enabled. Sampling is the caller's responsibility —
 * this always emits when called (respecting only the 429 mute).
 */
export const reportTransaction = (name: string, startMs: number, endMs: number): void => {
  try {
    const { errorReporting } = getTelemetryConfig()
    if (errorReporting === undefined) return
    if (isMuted(Date.now())) return

    const meta = resolveMeta(errorReporting.environment)
    const transaction = buildTransaction(name, startMs, endMs, meta)
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
  const pruned = (rateWindow.get('all') ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (pruned.length >= RATE_LIMIT) {
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- persist pruned window
    rateWindow.set('all', pruned)
    return false
  }
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- record report timestamp
  rateWindow.set('all', [...pruned, now])
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
 * POST an envelope, never throwing. Honors HTTP 429 by muting further reports
 * for the advised `Retry-After` window (default 60 s).
 */
const sendEnvelope = async (url: string, body: string, authHeader: string): Promise<void> => {
  try {
    const response = await fetch(url, {
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
      muteState.set('until', Date.now() + retryAfter * 1000)
    }
  } catch {
    // Never throw — a dead/slow collector must not break the observed request.
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
