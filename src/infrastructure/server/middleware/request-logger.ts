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

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()

  const { path } = c.req
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  const duration = Date.now() - start
  const requestId = c.get('requestId')
  const suffix = requestId ? ` [req:${requestId}]` : ''
  logDebug(
    `<-- ${c.req.method} ${path} ${c.res.status} ${duration}ms${suffix}`,
    requestId ? { 'request.id': requestId } : undefined
  )

  if (getTelemetryConfig().metricsExport !== undefined) {
    emitMetric(
      recordHttpRequest(c.req.method, c.req.routePath, String(c.res.status), duration / 1000)
    )
  }
}
