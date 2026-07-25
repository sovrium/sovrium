/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { runRequest } from '@/infrastructure/telemetry/observability-runtime'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { Context } from 'hono'

export interface RunRequestOptions<A, E, R> {
  readonly provideLayer?: (program: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>
}

const decideSampled = (ratio: number): boolean => {
  if (ratio >= 1) return true
  if (ratio <= 0) return false
  return Math.random() < ratio
}

export async function runRequestEffect<A, E = never, R = never>(
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

  const requestLog =
    requestId === ''
      ? Effect.logDebug(`${method} ${route}`)
      : Effect.logDebug(`${method} ${route}`).pipe(Effect.annotateLogs({ 'request.id': requestId }))

  const rooted = requestLog.pipe(
    Effect.zipRight(provided),
    Effect.withSpan(`http.server ${method} ${route}`, {
      attributes: { method, route, 'request.id': requestId },
    })
  )

  const { traces } = getTelemetryConfig()
  const gated =
    traces !== undefined && !decideSampled(traces.sampleRatio)
      ? Effect.withTracerEnabled(rooted, false)
      : rooted

  return runRequest(gated)
}
