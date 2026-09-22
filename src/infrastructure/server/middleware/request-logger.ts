/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logDebug } from '@/infrastructure/logging/logger'
import { recordHttpRequest } from '@/infrastructure/telemetry/metrics'
import { emitMetric } from '@/infrastructure/telemetry/observability-runtime'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { MiddlewareHandler } from 'hono'

const EXCLUDED_PREFIXES = ['/assets/', '/favicon'] as const

/**
 * Request access log + HTTP-server metrics middleware
 *.
 *
 * Logs method, path, status, duration, and the request correlation ID for each
 * request at debug level, AND — when metrics export is armed — records the
 * `http.server.request.count` counter and `http.server.request.duration`
 * histogram at the request edge. Static asset paths are excluded from both.
 *
 * The correlation ID is set by the `hono/request-id` middleware (mounted first
 * in `createHonoApp`); this middleware reads `c.get('requestId')` rather than
 * minting its own.
 *
 * CARDINALITY: the metric `route` label is `c.req.routePath` — the TEMPLATED
 * matched route pattern (`/`, `/api/tables/:slug`, …), read AFTER `next()` so it
 * reflects the handler that responded — NEVER the raw `c.req.path` (which would
 * explode label cardinality). `status` is the numeric response code as a string.
 *
 * Enable the access log with LOG_LEVEL=debug or NODE_ENV=development.
 *
 * Format: `<-- GET / 200 12ms [req:<id>]`
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()

  const { path } = c.req
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  const duration = Date.now() - start
  const requestId = c.get('requestId')
  const suffix = requestId ? ` [req:${requestId}]` : ''
  // Keep the [req:id] suffix on the human-readable stdout line (byte-identical)
  // AND attach request.id as a structured OTLP attribute for backend correlation.
  logDebug(
    `<-- ${c.req.method} ${path} ${c.res.status} ${duration}ms${suffix}`,
    requestId ? { 'request.id': requestId } : undefined
  )

  // HTTP-server metrics — only when metrics export is armed (zero overhead
  // otherwise, mirroring the perf-middleware contract). `routePath` is the
  // templated pattern of the handler that responded (bounded cardinality).
  if (getTelemetryConfig().metricsExport !== undefined) {
    emitMetric(
      recordHttpRequest(c.req.method, c.req.routePath, String(c.res.status), duration / 1000)
    )
  }
}
