/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Request-edge tracing wrapper.
 *
 * Runs a request's Effect program on the unified observability runtime, wrapped
 * in a ROOT `http.server <METHOD> <route>` span so that:
 *
 *  1. any `Effect.withSpan` CHILD seams inside the program (page/SSR render, and
 *     later the DB/automation/AI seams) chain under the request root, and
 *  2. a structured request log is emitted INSIDE the root span — `OtlpLogger`
 *     stamps the span's `traceId` onto it, giving free log↔trace correlation
 *     (the correlation that was missing in GlitchTip).
 *
 * `route` is the TEMPLATED route pattern (`c.req.routePath` — `/`, `/api/tables/:slug`),
 * never the concrete URL, matching the metrics story's `route`-label cardinality
 * discipline.
 *
 * Head-sampling — the ecoconception volume lever — is applied HERE, once per
 * request: when traces are armed but this request is not sampled, the whole
 * traced region runs under `Effect.withTracerEnabled(false)` so NO spans (root or
 * child) are created or exported. When traces are off entirely, the active
 * runtime carries the default no-op tracer, so `Effect.withSpan` is a no-op and
 * this wrapper adds no overhead beyond one debug log.
 *
 * BATCH-1 scope: only the page/SSR route is routed through this wrapper. The 60
 * API-route call sites still run on the default runtime (untraced) until a later
 * batch migrates them by passing their domain layer via `provideLayer`.
 */

import { Effect } from 'effect'
import { runRequest } from '@/infrastructure/telemetry/observability-runtime'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { Context } from 'hono'

/** Options for {@link runRequestEffect}. */
export interface RunRequestOptions<A, E, R> {
  /**
   * Discharge the program's domain-layer requirements to `never` (e.g. an API
   * route passing `(p) => p.pipe(Effect.provide(XLive))`). Omit it when the
   * program already has no requirements (`R = never`), as the page route does.
   */
  readonly provideLayer?: (program: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>
}

/** Head-sampling decision for one request from the effective ratio in `[0,1]`. */
const decideSampled = (ratio: number): boolean => {
  if (ratio >= 1) return true
  if (ratio <= 0) return false
  return Math.random() < ratio
}

/**
 * Run `program` on the observability runtime under a root `http.server` span.
 * Returns the program's success value; failures/defects propagate as a rejected
 * Promise (the page route's existing `try/catch` maps them to a 500), preserving
 * today's request-handling behavior.
 */
export async function runRequestEffect<A, E = never, R = never>(
  // eslint-disable-next-line functional/prefer-immutable-types -- Hono Context is inherently mutable
  c: Context,
  program: Effect.Effect<A, E, R>,
  options?: RunRequestOptions<A, E, R>
): Promise<A> {
  const provided: Effect.Effect<A, E, never> = options?.provideLayer
    ? options.provideLayer(program)
    : (program as Effect.Effect<A, E, never>)

  const { method } = c.req
  const route = c.req.routePath
  const requestId = (c.get('requestId') as string | undefined) ?? ''

  // The in-span request log: emitted while the root span is current, so
  // OtlpLogger correlates it to the trace. Debug level matches the existing
  // access-log discipline (LOG_LEVEL=debug surfaces it; higher levels drop it).
  const requestLog =
    requestId === ''
      ? Effect.logDebug(`${method} ${route}`)
      : Effect.logDebug(`${method} ${route}`).pipe(Effect.annotateLogs({ 'request.id': requestId }))

  const rooted = requestLog.pipe(
    Effect.andThen(provided),
    Effect.withSpan(`http.server ${method} ${route}`, {
      attributes: { method, route, 'request.id': requestId },
    })
  )

  // Apply head-sampling only when traces are armed; otherwise the active runtime
  // has no OTLP tracer and `withSpan` is already a no-op.
  const { traces } = getTelemetryConfig()
  const gated =
    traces !== undefined && !decideSampled(traces.sampleRatio)
      ? Effect.withTracerEnabled(rooted, false)
      : rooted

  return runRequest(gated)
}
