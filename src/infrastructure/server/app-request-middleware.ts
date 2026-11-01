/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The request middleware `createHonoApp` mounts between the guard chain
 * (`app-guard-chain.ts`) and the first route, in its one fixed order: the trace
 * boundary, the retired-host redirect, the `X-Sovrium-Config` header, the
 * analytics retention purge, then the access log.
 *
 * Extracted from `compose-hono-app.ts` so the composition root reads as its
 * phases. Every link here is infrastructure or an application use-case; none
 * names presentation.
 */

import { Effect } from 'effect'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { logDebug } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { provideDomain } from '@/infrastructure/server/domain-runtime'
import { hostRedirect } from '@/infrastructure/server/middleware/host-redirect'
import { requestLogger } from '@/infrastructure/server/middleware/request-logger'
import { createRequestTraceMiddleware } from '@/infrastructure/telemetry/performance-middleware'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Mount the per-request trace boundary when EITHER signal that reads it is
 * armed: Sentry performance sampling (`SENTRY_DSN` +
 * `SENTRY_TRACES_SAMPLE_RATE` in `(0,1]`), which turns the box into a
 * transaction envelope, or OTLP traces (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`),
 * which needs the box so a handler running several Effect programs chains them
 * under ONE request root instead of opening a root per program. No-op when
 * neither is armed.
 */
function mountPerformanceMiddleware(honoApp: Readonly<Hono>): void {
  const { performance, traces } = getTelemetryConfig()
  if (performance === undefined && traces === undefined) return
  honoApp.use(
    '*',
    createRequestTraceMiddleware({
      ...(performance !== undefined ? { transactionSampleRate: performance.sampleRate } : {}),
      ...(traces !== undefined ? { traceSampleRatio: traces.sampleRatio } : {}),
    })
  )
}

/**
 * X-Sovrium-Config response header middleware. Carries the SHA-256 hash of
 * the file-loaded config so operators can identify which config a running
 * server is serving from any HTTP response without hitting the admin API.
 * Config is code-only — there is no runtime config-mutation surface and
 * therefore no file-vs-DB drift to report; the header is just the plain
 * hash. A reload builds a new app with the new hash, so the header only
 * ever names a configuration the server accepted.
 */
const mountConfigHashHeader = (honoApp: Readonly<Hono>, configHash: string | undefined): void => {
  const currentConfigHash = configHash ?? ''
  if (!currentConfigHash) return
  honoApp.use('*', async (c, next) => {
    await next()
    c.header('X-Sovrium-Config', currentConfigHash)
  })
}

/**
 * Analytics retention cleanup middleware — purges stale page view records.
 * Runs awaited on page requests to guarantee old data is removed before response.
 */
const mountAnalyticsPurge = (honoApp: Readonly<Hono>, app: App): void => {
  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  if (!analyticsEnabled) return
  const retentionDays = typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined

  honoApp.use('*', async (c, next) => {
    await Effect.runPromise(
      provideDomain(
        c,
        purgeOldAnalyticsData(app.name, retentionDays, resolveOperatorTimezone(process.env))
      ).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logDebug('[analytics] retention purge failed', { cause: String(cause) })
          })
        ),
        // effect-swallow: see the tap above. This runs awaited on EVERY page
        // request, so it is logged at debug rather than error — and a
        // housekeeping sweep must never be the reason a page fails to render.
        Effect.catch(() => Effect.void)
      )
    )
    return next()
  })
}

/**
 * Mount the request middleware on `honoApp`, in order, and return the app with
 * the access log (debug level only, excludes /assets/*) as its last link.
 */
export const mountRequestMiddleware = (
  honoApp: Readonly<Hono>,
  app: App,
  configHash: string | undefined
): Readonly<Hono> => {
  // Per-request trace boundary (the infrastructure observability performance
  // requirement / -TRACING). Mounted early so it spans the full downstream
  // handling, but deliberately INSIDE `dbQueryCountMiddleware` (the guard
  // chain): it reads `currentDbQueryCount()` after `next()` resolves, and that
  // read is only request-scoped while the query-count box is still open. Zero
  // overhead when neither telemetry signal is armed.
  mountPerformanceMiddleware(honoApp)

  // Retired-host → canonical-path 301 redirect. Mounted EARLY (right after the
  // guard chain, before every route) so it preempts all downstream routing and
  // short-circuits with a path-preserving 301 when the incoming host matches
  // `SOVRIUM_REDIRECT_HOST`. A complete no-op unless BOTH
  // `SOVRIUM_REDIRECT_HOST` and `SOVRIUM_REDIRECT_HOST_TARGET` are set, so it has
  // zero blast radius on every other deployment — see ./middleware/host-redirect.
  honoApp.use('*', hostRedirect)

  mountConfigHashHeader(honoApp, configHash)
  mountAnalyticsPurge(honoApp, app)

  return honoApp.use('*', requestLogger)
}
