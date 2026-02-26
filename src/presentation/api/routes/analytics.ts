/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { zValidator } from '@hono/zod-validator'
import { Effect } from 'effect'
import { collectPageView } from '@/application/use-cases/analytics/collect-page-view'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { queryCampaigns } from '@/application/use-cases/analytics/query-campaigns'
import { queryDevices } from '@/application/use-cases/analytics/query-devices'
import { queryOverview } from '@/application/use-cases/analytics/query-overview'
import { queryPages } from '@/application/use-cases/analytics/query-pages'
import { queryReferrers } from '@/application/use-cases/analytics/query-referrers'
import { analyticsCollectSchema, analyticsQuerySchema } from '@/domain/models/api/analytics'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics-repository-live'
import { matchesAnyGlobPattern } from '@/infrastructure/utils/glob-matcher'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'

/**
 * Extract client IP from request headers
 */
function extractClientIp(xForwardedFor: string | undefined): string {
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0]
    return first?.trim() ?? 'unknown'
  }
  return 'unknown'
}

/**
 * Parse and validate analytics query parameters from request
 */
function parseAnalyticsQuery(c: Context):
  | {
      readonly appName: string
      readonly from: Date
      readonly to: Date
      readonly granularity: 'hour' | 'day' | 'week' | 'month'
    }
  | undefined {
  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')
  const validGranularities = new Set(['hour', 'day', 'week', 'month'])
  const rawGranularity = c.req.query('granularity') ?? 'day'
  const granularity = (validGranularities.has(rawGranularity) ? rawGranularity : 'day') as
    | 'hour'
    | 'day'
    | 'week'
    | 'month'

  if (!fromStr || !toStr) return undefined

  const parsed = analyticsQuerySchema.safeParse({ from: fromStr, to: toStr, granularity })
  if (!parsed.success) return undefined

  return {
    appName: c.req.query('appName') ?? '',
    from: new Date(parsed.data.from),
    to: new Date(parsed.data.to),
    granularity: parsed.data.granularity,
  }
}

/**
 * Handle POST /api/analytics/collect — public endpoint, no auth required
 *
 * Records a page view with privacy-safe visitor hashing.
 * Also triggers retention cleanup (fire-and-forget) to purge stale records.
 * Returns 204 No Content for fastest response.
 */
async function handleCollect(
  c: Context,
  appName: string,
  retentionDays?: number,
  excludedPaths?: readonly string[]
): Promise<Response> {
  const body = c.req.valid('json' as never)
  const pagePath = (body as { readonly p: string }).p

  // Check if path is excluded - return 204 without recording
  if (matchesAnyGlobPattern(excludedPaths, pagePath)) {
    // eslint-disable-next-line unicorn/no-null
    return c.body(null, 204)
  }

  const ip = extractClientIp(c.req.header('x-forwarded-for'))
  const userAgent = c.req.header('user-agent') ?? ''
  const acceptLanguage = c.req.header('accept-language') ?? ''

  // Fire-and-forget: record page view and purge stale data asynchronously
  // eslint-disable-next-line functional/no-expression-statements
  void Effect.runPromise(
    Effect.all(
      [
        collectPageView({
          appName,
          pagePath,
          pageTitle: (body as { readonly t?: string }).t,
          referrerUrl: (body as { readonly r?: string }).r,
          ip,
          userAgent,
          acceptLanguage,
          screenWidth: (body as { readonly sw?: number }).sw,
          screenHeight: (body as { readonly sh?: number }).sh,
          utmSource: (body as { readonly us?: string }).us,
          utmMedium: (body as { readonly um?: string }).um,
          utmCampaign: (body as { readonly uc?: string }).uc,
          utmContent: (body as { readonly ux?: string }).ux,
          utmTerm: (body as { readonly ut?: string }).ut,
        }),
        purgeOldAnalyticsData(appName, retentionDays),
      ],
      { concurrency: 'unbounded' }
    ).pipe(
      Effect.provide(AnalyticsRepositoryLive),
      Effect.catchAll(() => Effect.void)
    )
  )

  // eslint-disable-next-line unicorn/no-null
  return c.body(null, 204)
}

/**
 * Handle GET /api/analytics/overview — requires auth
 */
async function handleOverview(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parseAnalyticsQuery(c)
  if (!params) {
    return c.json({ error: 'Missing or invalid from/to parameters', code: 'VALIDATION_ERROR' }, 400)
  }

  const result = await Effect.runPromise(
    queryOverview({
      appName: params.appName,
      from: params.from,
      to: params.to,
      granularity: params.granularity,
    }).pipe(Effect.provide(AnalyticsRepositoryLive), Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to query analytics', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

/**
 * Handle GET /api/analytics/pages — requires auth
 */
async function handlePages(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parseAnalyticsQuery(c)
  if (!params) {
    return c.json({ error: 'Missing or invalid from/to parameters', code: 'VALIDATION_ERROR' }, 400)
  }

  const result = await Effect.runPromise(
    queryPages({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(Effect.provide(AnalyticsRepositoryLive), Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to query pages', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

/**
 * Handle GET /api/analytics/referrers — requires auth
 */
async function handleReferrers(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parseAnalyticsQuery(c)
  if (!params) {
    return c.json({ error: 'Missing or invalid from/to parameters', code: 'VALIDATION_ERROR' }, 400)
  }

  const result = await Effect.runPromise(
    queryReferrers({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(Effect.provide(AnalyticsRepositoryLive), Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to query referrers', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

/**
 * Handle GET /api/analytics/devices — requires auth
 */
async function handleDevices(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parseAnalyticsQuery(c)
  if (!params) {
    return c.json({ error: 'Missing or invalid from/to parameters', code: 'VALIDATION_ERROR' }, 400)
  }

  const result = await Effect.runPromise(
    queryDevices({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(Effect.provide(AnalyticsRepositoryLive), Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to query devices', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

/**
 * Handle GET /api/analytics/campaigns — requires auth
 */
async function handleCampaigns(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parseAnalyticsQuery(c)
  if (!params) {
    return c.json({ error: 'Missing or invalid from/to parameters', code: 'VALIDATION_ERROR' }, 400)
  }

  const result = await Effect.runPromise(
    queryCampaigns({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(Effect.provide(AnalyticsRepositoryLive), Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to query campaigns', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

/**
 * Chain analytics routes onto a Hono app
 *
 * Provides:
 * - POST /api/analytics/collect - Record page view (public, no auth)
 * - GET /api/analytics/overview - Summary + time series (auth required)
 * - GET /api/analytics/pages - Top pages (auth required)
 * - GET /api/analytics/referrers - Top referrers (auth required)
 * - GET /api/analytics/devices - Device breakdown (auth required)
 * - GET /api/analytics/campaigns - UTM campaigns (auth required)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param appName - Application name for multi-tenant analytics
 * @param retentionDays - Number of days to retain analytics data (triggers cleanup on collect)
 * @param excludedPaths - Glob patterns for paths excluded from tracking
 * @returns Hono app with analytics routes chained
 */
export function chainAnalyticsRoutes<T extends Hono>(
  honoApp: T,
  appName: string,
  retentionDays?: number,
  excludedPaths?: readonly string[]
): T {
  return honoApp
    .post('/api/analytics/collect', zValidator('json', analyticsCollectSchema), (c) =>
      handleCollect(c, appName, retentionDays, excludedPaths)
    )
    .get('/api/analytics/overview', handleOverview)
    .get('/api/analytics/pages', handlePages)
    .get('/api/analytics/referrers', handleReferrers)
    .get('/api/analytics/devices', handleDevices)
    .get('/api/analytics/campaigns', handleCampaigns) as T
}
