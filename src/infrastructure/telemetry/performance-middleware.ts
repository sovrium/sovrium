/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-request TRACE BOUNDARY: one Hono middleware that opens the span box
 * (`request-trace-context.ts`) around a request, takes the sampling decision
 * once, and — when Sentry performance sampling is armed — reports the finished
 * request as a transaction envelope
 * ([internal ref] / -TRACING).
 *
 * It is mounted when EITHER signal is armed, because the box has two consumers
 * and only one of them is the transaction:
 *
 * - `SENTRY_DSN` + `SENTRY_TRACES_SAMPLE_RATE` in `(0,1]` → the transaction
 *   envelope (`METHOD /templated/:route`, `op: http.server`) reads `box.root`
 *   for the trace identity and `box.spans` for the breakdown.
 * - `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` → `runRequestEffect` reads `box.root`
 *   to CHAIN under an existing request root instead of opening a second one.
 *   Without the box mounted for traces-only instances, a handler that runs
 *   several Effect programs still fragments one request into several traces.
 *
 * Static-asset paths are excluded so pixel/JS/CSS traffic dominates neither the
 * sample nor the collector.
 *
 * ## ONE dice roll, deliberately
 *
 * The Sentry transaction gate and Effect's span-export gate used to be
 * INDEPENDENT `Math.random()` draws taken in different files — this middleware
 * and `runRequestEffect`. At a rate of 0.1 the chance that one request won both
 * was 1%, so a sampled transaction almost never coincided with a sampled trace
 * and the two could not be cross-read even in principle. The draw is taken once
 * here and both gates read it off the box, which makes "sampled" mean the same
 * thing on both sides of a request by construction.
 *
 * A request chosen for a transaction is ALWAYS span-sampled, whatever the trace
 * ratio says: a transaction whose `spans[]` was emptied by an independent gate
 * is the exact payload this work exists to stop shipping.
 *
 * ## Why the box wraps `next()` and the report comes after
 *
 * A span is collected at CREATION but read after it ENDS — the span object is
 * mutated in place (see `request-trace-context.ts`). Opening the box around
 * `next()` therefore captures the whole request, and reading `box.root` /
 * `box.spans` in the frame after `next()` resolves yields finished spans.
 *
 * That same frame is where the response status and the DB query count are read.
 * Both are only knowable there: the status because the handler has not run yet
 * beforehand, and the count because it lives in an `AsyncLocalStorage` box
 * `dbQueryCountMiddleware` opens FURTHER OUT — this middleware is mounted inside
 * it, so the post-`next()` read is still within that box. Hoisting this
 * middleware above it would silently report 0 queries for every request.
 */

import { currentDbQueryCount } from '@/infrastructure/telemetry/db-query-counter'
import { reportTransaction } from './error-reporter'
import { withRequestTrace } from './request-trace-context'
import type { MiddlewareHandler } from 'hono'

/** Static-asset file extensions excluded from performance sampling. */
const STATIC_ASSET_EXT = /\.(css|js|mjs|map|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot)$/i

/** Whether a request path is a static asset (excluded from sampling). */
const isStaticAssetPath = (path: string): boolean =>
  path.startsWith('/assets/') || STATIC_ASSET_EXT.test(path)

/**
 * The bare catch-all Hono reports when a request matched no registered route.
 * `routePath` falls back to the wildcard the outermost `use('*')` — this very
 * middleware — is mounted under, so an unmatched request reads as `/*`.
 *
 * NOT `/api/auth/*` and friends: those are REAL registered route families whose
 * pattern is already bounded, so the check below is an exact match, never a
 * `includes('*')`.
 */
const UNMATCHED_ROUTE_PATTERN = '/*'

/**
 * The single transaction name every unmatched request collapses into.
 *
 * It is a CONSTANT on purpose, and it must never fall back to `c.req.path`.
 * Falling back would re-open through the 404 door the exact unbounded
 * cardinality that naming transactions by route template exists to close — and
 * re-open it at its worst: an unregistered path is by definition attacker- or
 * crawler-chosen, so any bot probing random URLs would mint one GlitchTip
 * transaction group per URL, forever, and drown the route table it sits next to.
 *
 * A publicDir file served by the `get('/*')` fallback lands here too. That is
 * deliberate: those names are unbounded for the same reason, so collapsing them
 * is the correct answer rather than a rounding error.
 */
const UNMATCHED_TRANSACTION_ROUTE = '/<unmatched>'

/**
 * The templated route a transaction is named after: `/api/forms/:name/submissions`,
 * never `/api/forms/contact/submissions`. One endpoint is one transaction group,
 * so per-endpoint aggregates stay readable however many records exist.
 */
const transactionRoute = (routePath: string): string =>
  routePath === UNMATCHED_ROUTE_PATTERN ? UNMATCHED_TRANSACTION_ROUTE : routePath

/** Which signals are armed, and at what rate. `undefined` means "off". */
export interface RequestTraceMiddlewareOptions {
  /** `SENTRY_TRACES_SAMPLE_RATE`, in `(0,1]`. */
  readonly transactionSampleRate?: number
  /** The OTLP trace head-sampling ratio, in `[0,1]`. */
  readonly traceSampleRatio?: number
}

/**
 * Build the request trace-boundary middleware. Opens a span box around each
 * non-asset request it samples, and emits a transaction when the Sentry
 * performance gate is armed and won this request's draw.
 */
export const createRequestTraceMiddleware = (
  options: RequestTraceMiddlewareOptions
): MiddlewareHandler => {
  const { transactionSampleRate, traceSampleRatio } = options
  return async (c, next) => {
    if (isStaticAssetPath(c.req.path)) {
      return next()
    }

    // The single draw both gates read. `Math.random()` is uniform on [0,1), so
    // `< 1` is always true at a rate of 1 — the E2E specs depend on that.
    const roll = Math.random()
    const emitTransaction = transactionSampleRate !== undefined && roll < transactionSampleRate
    const sampled = emitTransaction || (traceSampleRatio !== undefined && roll < traceSampleRatio)
    if (!sampled) {
      return next()
    }

    const start = Date.now()
    const { trace } = await withRequestTrace({ sampled, emitTransaction }, async () => {
      await next()
    })
    if (!emitTransaction) return

    // The TEMPLATED route, not `c.req.path`. Read here rather than before
    // `next()` precisely because `routePath` has by now advanced to the handler
    // that responded — the same post-`next()` discipline `requestLogger` uses
    // for the `route` metric label and `runRequestEffect` for the `route` span
    // attribute. Naming by the concrete path minted a transaction group per
    // record id, which is unbounded and makes per-endpoint aggregates useless.
    reportTransaction({
      name: `${c.req.method} ${transactionRoute(c.req.routePath)}`,
      startMs: start,
      endMs: Date.now(),
      httpStatus: c.res.status,
      dbQueryCount: currentDbQueryCount(),
      spans: trace.spans,
      droppedSpans: trace.dropped,
      ...(trace.root !== undefined
        ? { traceId: trace.root.traceId, spanId: trace.root.spanId }
        : {}),
    })
  }
}
