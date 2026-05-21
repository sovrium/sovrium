/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { zValidator } from '@hono/zod-validator'
import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics-repository'
import { collectPageView } from '@/application/use-cases/analytics/collect-page-view'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { queryCampaigns } from '@/application/use-cases/analytics/query-campaigns'
import { queryDevices } from '@/application/use-cases/analytics/query-devices'
import { queryOverview } from '@/application/use-cases/analytics/query-overview'
import { queryPages } from '@/application/use-cases/analytics/query-pages'
import { queryReferrers } from '@/application/use-cases/analytics/query-referrers'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  analyticsCollectSchema,
  analyticsQuerySchema,
} from '@/domain/models/api/analytics/analytics'
import { matchesAnyGlobPattern } from '@/domain/utils/glob-matcher'
import { unauthorized, validationError } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideAnalyticsLive } from './analytics/effect-runner'
import type { Context, Hono } from 'hono'

function extractClientIp(xForwardedFor: string | undefined): string {
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0]
    return first?.trim() ?? 'unknown'
  }
  return 'unknown'
}

function parseAnalyticsQuery(
  c: Context,
  appName: string
):
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

  const toDate = new Date(parsed.data.to)
  const toEndOfSecond = new Date(Math.ceil(toDate.getTime() / 1000) * 1000 + 999)

  return {
    appName,
    from: new Date(parsed.data.from),
    to: toEndOfSecond,
    granularity: parsed.data.granularity,
  }
}

interface AnalyticsRouteConfig {
  readonly appName: string
  readonly retentionDays?: number
  readonly excludedPaths?: readonly string[]
  readonly respectDoNotTrack?: boolean
}

async function handleCollect(c: Context, config: AnalyticsRouteConfig): Promise<Response> {
  const { appName, retentionDays, excludedPaths, respectDoNotTrack } = config
  const body = c.req.valid('json' as never)
  const pagePath = (body as { readonly p: string }).p

  if (matchesAnyGlobPattern(excludedPaths, pagePath)) {
    return c.body(null, 204)
  }

  const dntHeader = c.req.header('DNT')
  if (respectDoNotTrack && dntHeader === '1') {
    return c.body(null, 204)
  }

  const ip = extractClientIp(c.req.header('x-forwarded-for'))
  const userAgent = c.req.header('user-agent') ?? ''
  const acceptLanguage = c.req.header('accept-language') ?? ''

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
      provideAnalyticsLive,
      Effect.catchAll(() => Effect.void)
    )
  )

  return c.body(null, 204)
}

function analyticsAccessDenied(c: Context): Response {
  return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
}

async function requireAdminSession(c: Context): Promise<Response | undefined> {
  const session = getSessionContext(c)
  if (!session) {
    return unauthorized(c)
  }
  const role = await getUserRole(session.userId)
  if (role !== 'admin') {
    return analyticsAccessDenied(c)
  }
  return undefined
}

async function handleOverview(c: Context, appName: string): Promise<Response> {
  const denied = await requireAdminSession(c)
  if (denied) {
    return denied
  }

  const params = parseAnalyticsQuery(c, appName)
  if (!params) {
    return validationError(
      c,
      [
        { field: 'from', message: 'Missing or invalid from parameter' },
        { field: 'to', message: 'Missing or invalid to parameter' },
      ],
      'Missing or invalid from/to parameters'
    )
  }

  const result = await Effect.runPromise(
    queryOverview({
      appName: params.appName,
      from: params.from,
      to: params.to,
      granularity: params.granularity,
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to query analytics', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

async function handlePages(c: Context, appName: string): Promise<Response> {
  const denied = await requireAdminSession(c)
  if (denied) {
    return denied
  }

  const params = parseAnalyticsQuery(c, appName)
  if (!params) {
    return validationError(
      c,
      [
        { field: 'from', message: 'Missing or invalid from parameter' },
        { field: 'to', message: 'Missing or invalid to parameter' },
      ],
      'Missing or invalid from/to parameters'
    )
  }

  const result = await Effect.runPromise(
    queryPages({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Failed to query pages', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json(result.right, 200)
}

async function handleReferrers(c: Context, appName: string): Promise<Response> {
  const denied = await requireAdminSession(c)
  if (denied) {
    return denied
  }

  const params = parseAnalyticsQuery(c, appName)
  if (!params) {
    return validationError(
      c,
      [
        { field: 'from', message: 'Missing or invalid from parameter' },
        { field: 'to', message: 'Missing or invalid to parameter' },
      ],
      'Missing or invalid from/to parameters'
    )
  }

  const result = await Effect.runPromise(
    queryReferrers({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to query referrers', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

async function handleDevices(c: Context, appName: string): Promise<Response> {
  const denied = await requireAdminSession(c)
  if (denied) {
    return denied
  }

  const params = parseAnalyticsQuery(c, appName)
  if (!params) {
    return validationError(
      c,
      [
        { field: 'from', message: 'Missing or invalid from parameter' },
        { field: 'to', message: 'Missing or invalid to parameter' },
      ],
      'Missing or invalid from/to parameters'
    )
  }

  const result = await Effect.runPromise(
    queryDevices({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to query devices', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

function validatePagination(
  limitStr: string | undefined,
  offsetStr: string | undefined
):
  | { readonly _tag: 'ok'; readonly limit: number; readonly offset: number }
  | { readonly _tag: 'invalid'; readonly param: 'limit' | 'offset' } {
  const limit = limitStr ? Number.parseInt(limitStr, 10) : 50
  const offset = offsetStr ? Number.parseInt(offsetStr, 10) : 0

  if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
    return { _tag: 'invalid', param: 'limit' }
  }
  if (Number.isNaN(offset) || offset < 0) {
    return { _tag: 'invalid', param: 'offset' }
  }
  return { _tag: 'ok', limit, offset }
}

function parseEventsQuery(c: Context):
  | {
      readonly _tag: 'ok'
      readonly limit: number
      readonly offset: number
      readonly eventType: string | undefined
      readonly eventName: string | undefined
      readonly from: Date | undefined
      readonly to: Date | undefined
    }
  | { readonly _tag: 'invalid'; readonly param: 'limit' | 'offset' } {
  const pagination = validatePagination(c.req.query('limit'), c.req.query('offset'))
  if (pagination._tag === 'invalid') return pagination

  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')

  return {
    _tag: 'ok',
    limit: pagination.limit,
    offset: pagination.offset,
    eventType: c.req.query('event_type') || undefined,
    eventName: c.req.query('event_name') || undefined,
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
  }
}

async function handleEvents(c: Context, appName: string): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return unauthorized(c)
  }

  const role = await getUserRole(session.userId)
  if (role !== 'admin') {
    return unauthorized(c)
  }

  const params = parseEventsQuery(c)
  if (params._tag === 'invalid') {
    return validationError(c, [
      { field: params.param, message: `Invalid ${params.param} parameter` },
    ])
  }

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const repo = yield* AnalyticsRepository
      return yield* repo.listEvents({
        appName,
        eventType: params.eventType,
        eventName: params.eventName,
        limit: params.limit,
        offset: params.offset,
        from: params.from,
        to: params.to,
      })
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to query events', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const events = result.right.events.map((event) => ({
    id: event.id,
    app_name: event.appName,
    event_type: event.eventType,
    event_name: event.eventName,
    org_id: event.orgId,
    visitor_hash: event.visitorHash,
    session_hash: event.sessionHash,
    timestamp: event.timestamp,
    properties: event.properties,
  }))

  return c.json({ events, pagination: result.right.pagination }, 200)
}

async function handleCampaigns(c: Context, appName: string): Promise<Response> {
  const denied = await requireAdminSession(c)
  if (denied) {
    return denied
  }

  const params = parseAnalyticsQuery(c, appName)
  if (!params) {
    return validationError(
      c,
      [
        { field: 'from', message: 'Missing or invalid from parameter' },
        { field: 'to', message: 'Missing or invalid to parameter' },
      ],
      'Missing or invalid from/to parameters'
    )
  }

  const result = await Effect.runPromise(
    queryCampaigns({
      appName: params.appName,
      from: params.from,
      to: params.to,
    }).pipe(provideAnalyticsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    return c.json(
      { success: false, message: 'Failed to query campaigns', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

export function chainAnalyticsRoutes<T extends Hono>(honoApp: T, config: AnalyticsRouteConfig): T {
  const { appName } = config
  return honoApp
    .post('/api/analytics/collect', zValidator('json', analyticsCollectSchema), (c) =>
      handleCollect(c, config)
    )
    .get('/api/analytics/overview', (c) => handleOverview(c, appName))
    .get('/api/analytics/pages', (c) => handlePages(c, appName))
    .get('/api/analytics/referrers', (c) => handleReferrers(c, appName))
    .get('/api/analytics/devices', (c) => handleDevices(c, appName))
    .get('/api/analytics/campaigns', (c) => handleCampaigns(c, appName))
    .get('/api/analytics/events', (c) => handleEvents(c, appName)) as T
}
