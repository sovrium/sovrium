/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, type Schema } from 'effect'
import { collectPageView } from '@/application/use-cases/analytics/collect-page-view'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { queryCampaigns } from '@/application/use-cases/analytics/query-campaigns'
import { queryDevices } from '@/application/use-cases/analytics/query-devices'
import { queryOverview } from '@/application/use-cases/analytics/query-overview'
import { queryPages } from '@/application/use-cases/analytics/query-pages'
import { queryReferrers } from '@/application/use-cases/analytics/query-referrers'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import { matchesAnyGlobPattern } from '@/domain/kernel/matching/glob-matcher'
import {
  analyticsCampaignsResponseSchema,
  analyticsClickSchema,
  analyticsCollectSchema,
  analyticsDevicesResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsQuerySchema,
  analyticsTopPagesResponseSchema,
  analyticsTopReferrersResponseSchema,
} from '@/domain/models/api/analytics/analytics'
import { listEventsResponseSchema } from '@/domain/models/api/analytics/analytics-events'
import { requestDeclinesTracking } from '@/domain/models/app/analytics/privacy-signals-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { handleClick } from '@/presentation/api/analytics/click-handlers'
import {
  parseEventsQuery,
  readEvents,
  refusesEventType,
} from '@/presentation/api/analytics/events-query'
import {
  refuseHourlySeries,
  roundDevices,
  roundOverview,
  roundVisitRows,
} from '@/presentation/api/analytics/report-rounding'
import { handleTargets } from '@/presentation/api/analytics/targets-handlers'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import { unauthorized, validationError, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { effectValidator, type ValidatedContext } from '@/presentation/api/runtime/effect-validator'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context, Hono } from 'hono'

/**
 * Parse and validate analytics query parameters from request
 */
function parseAnalyticsQuery(
  c: Context,
  appName: string
):
  | {
      readonly appName: string
      readonly from: Date
      readonly to: Date
      readonly granularity: 'hour' | 'day' | 'week' | 'month'
      readonly eventType?: string
      readonly eventName?: string
    }
  | undefined {
  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')
  const validGranularities = new Set(['hour', 'day', 'week', 'month'])
  const rawGranularity = c.req.query('granularity') ?? 'day'
  const granularity = (validGranularities.has(rawGranularity) ? rawGranularity : 'day') as
    'hour' | 'day' | 'week' | 'month'

  if (!fromStr || !toStr) return undefined

  const parsed = decodeSafe(analyticsQuerySchema)({ from: fromStr, to: toStr, granularity })
  if (!parsed.success) return undefined

  // Round `to` up to the end of its second so that the query range captures
  // all events within the same wall-clock second.  Without this, sub-second
  // differences between the client timestamp and server-side NOW() can exclude
  // rows that logically fall within the requested window.
  const toDate = new Date(parsed.data.to)
  const toEndOfSecond = new Date(Math.ceil(toDate.getTime() / 1000) * 1000 + 999)

  // Which event population (and named event) to aggregate; the shared where-clause
  // pins `page_view` by default and answers EMPTY for an unrecognised value.
  const eventType = c.req.query('event_type')
  const eventName = c.req.query('event_name')

  return {
    appName,
    from: new Date(parsed.data.from),
    to: toEndOfSecond,
    granularity: parsed.data.granularity,
    ...(eventType === undefined ? {} : { eventType }),
    ...(eventName === undefined ? {} : { eventName }),
  }
}

/** The app's role ladder, read by every analytics read door. */
type Roles = AdminRoleResolvable

/**
 * Per-app analytics configuration forwarded from route registration.
 */
interface AnalyticsRouteConfig {
  readonly appName: string
  readonly retentionDays?: number
  readonly excludedPaths?: readonly string[]
  readonly respectDoNotTrack: boolean
  readonly respectGlobalPrivacyControl: boolean
  readonly profile: AnalyticsProfile
  /**
   * The link table as the config declares it, for naming the destination
   * each recorded `targetIndex` resolves to.
   *
   * Optional so an app without links pays nothing for the reader existing.
   */
  readonly resolveLinks?: () => ReadonlyArray<{
    readonly slug: string
    readonly destinations: readonly string[]
  }>
  /**
   * The app's role ladder, so the read endpoints admit its top role beside
   * the built-in `admin`; absent, only the built-in `admin` is
   * admin-equivalent.
   */
  readonly app?: AdminRoleResolvable
}

type CollectContext = ValidatedContext<'json', typeof analyticsCollectSchema.Type>

/**
 * Handle POST /api/analytics/collect — public endpoint, no auth required
 *
 * Records a page view (with a server-computed visitor identifier) and fires the retention cleanup.
 * Returns 204 No Content for fastest response.
 */
async function handleCollect(c: CollectContext, config: AnalyticsRouteConfig): Promise<Response> {
  const { appName, retentionDays, excludedPaths } = config
  const { p: pagePath, ...body } = c.req.valid('json')

  // An excluded path, or a `DNT: 1` / `Sec-GPC: 1` visitor: answered alike, nothing stored
  if (
    matchesAnyGlobPattern(excludedPaths, pagePath) ||
    requestDeclinesTracking(config, (name) => c.req.header(name))
  ) {
    return c.body(null, 204)
  }

  const ip = getRequestClientIp(c)
  const userAgent = c.req.header('user-agent') ?? ''
  const acceptLanguage = c.req.header('accept-language') ?? ''

  // Fire-and-forget: record page view and purge stale data asynchronously
  void Effect.runPromise(
    provideDomain(
      c,
      Effect.all(
        [
          collectPageView({
            appName,
            pagePath,
            pageTitle: body.t,
            referrerUrl: body.r,
            ip,
            userAgent,
            timeZone: resolveOperatorTimezone(process.env),
            acceptLanguage,
            screenWidth: body.sw,
            screenHeight: body.sh,
            utmSource: body.us,
            utmMedium: body.um,
            utmCampaign: body.uc,
            utmContent: body.ux,
            utmTerm: body.ut,
            profile: config.profile,
          }),
          purgeOldAnalyticsData(appName, retentionDays, resolveOperatorTimezone(process.env)),
        ],
        { concurrency: 'unbounded' }
      )
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[analytics] page-view collection failed', cause)
        })
      ),
      // effect-swallow: see the tap above. The beacon answers 204 either way —
      // a visitor's page load must not fail because an analytics row did.
      Effect.catch(() => Effect.void)
    )
  )

  return c.body(null, 204)
}

/**
 * Return a 404 access-denied response for non-admin analytics access.
 *
 * Analytics endpoints are admin-only. Per security rule S1 (anti-enumeration),
 * authenticated-but-unauthorized callers receive 404 (not 403) so they cannot
 * infer the existence of analytics data.
 */
function analyticsAccessDenied(c: Context): Response {
  return notFound(c, 'Not found')
}

/**
 * Resolve the caller's session and verify they have the admin role.
 *
 * Returns `undefined` (caller should treat as success/continue) when the
 * caller is an admin, otherwise returns the appropriate error Response.
 */
function requireAdminSession(c: Context, app: Roles) {
  return Effect.gen(function* () {
    const session = getSessionContext(c)
    if (!session) {
      return unauthorized(c)
    }
    const role = yield* getUserRole(session.userId)
    // Admin-equivalent: the built-in `admin` and the app's top role. The route
    // middleware in front of these handlers admits the whole console tier; this
    // is the data door, so it asks the narrower question every data door asks.
    if (!isAdminEquivalent(role, app)) {
      return analyticsAccessDenied(c)
    }
    return undefined
  })
}

/** The 400 a report without a usable `from`/`to` range answers. */
const invalidRange = (c: Context): Response =>
  validationError(
    c,
    [
      { field: 'from', message: 'Missing or invalid from parameter' },
      { field: 'to', message: 'Missing or invalid to parameter' },
    ],
    'Missing or invalid from/to parameters'
  )

/** Run `answer` for an admin; anyone else gets the refusal {@link requireAdminSession} answers. */
const adminOnly = <E>(
  c: Context,
  app: Roles,
  answer: Effect.Effect<Response, E, DomainServices>
): Promise<Response> =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const denied = yield* requireAdminSession(c, app)
        return denied ?? (yield* answer)
      })
    )
  )

/**
 * The handler of an admin report: the range off the query, the read, and its
 * answer through the report's schema. `noun` names the read in the log and in
 * the refusal.
 */
const reportHandler =
  <A, E, S extends Schema.Top>(
    read: (
      params: NonNullable<ReturnType<typeof parseAnalyticsQuery>>
    ) => Effect.Effect<A, E, DomainServices>,
    report: {
      readonly name: string
      readonly noun: string
      readonly schema: S
      /** The report as `audience-only` answers it (see `report-rounding.ts`). */
      readonly round: (answer: A) => A
      /** Whether the report answers a series, whose finest step the profile caps. */
      readonly series?: true
    }
  ) =>
  (c: Context, config: AnalyticsRouteConfig): Promise<Response> =>
    adminOnly(
      c,
      config.app ?? {},
      Effect.gen(function* () {
        const hourly = report.series ? refuseHourlySeries(c, config.profile) : undefined
        if (hourly) return hourly
        const params = parseAnalyticsQuery(c, config.appName)
        if (!params) return invalidRange(c)

        const result = yield* read(params).pipe(Effect.result)
        if (result._tag === 'Failure') {
          logError(
            `[analytics] ${report.name} query failed`,
            result.failure,
            requestLogAttributes(c)
          )
          return c.json(
            { success: false, message: `Failed to query ${report.noun}`, code: 'INTERNAL_ERROR' },
            500
          )
        }
        const answer =
          config.profile === 'audience-only' ? report.round(result.success) : result.success
        return shapedJson(c, answer, report.schema)
      })
    )

const handleOverview = reportHandler(queryOverview, {
  name: 'overview',
  noun: 'analytics',
  schema: analyticsOverviewResponseSchema,
  round: roundOverview,
  series: true,
})
const handlePages = reportHandler(queryPages, {
  name: 'pages',
  noun: 'pages',
  schema: analyticsTopPagesResponseSchema,
  round: roundVisitRows('pages'),
})
const handleReferrers = reportHandler(queryReferrers, {
  name: 'referrers',
  noun: 'referrers',
  schema: analyticsTopReferrersResponseSchema,
  round: roundVisitRows('referrers'),
})
const handleDevices = reportHandler(queryDevices, {
  name: 'devices',
  noun: 'devices',
  schema: analyticsDevicesResponseSchema,
  round: roundDevices,
})
const handleCampaigns = reportHandler(queryCampaigns, {
  name: 'campaigns',
  noun: 'campaigns',
  schema: analyticsCampaignsResponseSchema,
  round: roundVisitRows('campaigns'),
})

/**
 * Handle GET /api/analytics/events — requires admin role
 *
 * Returns analytics events with optional filtering by eventType and eventName.
 * Supports cursor-based pagination.
 */
function handleEvents(c: Context, config: AnalyticsRouteConfig): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        // The same gate as every sibling report: 401 without a session, 404 (S1) for
        // a signed-in caller who is not admin-equivalent.
        const denied = yield* requireAdminSession(c, config.app ?? {})
        if (denied) {
          return denied
        }
        if (refusesEventType(c, config.profile)) return notFound(c)

        const params = parseEventsQuery(c)
        if (params._tag === 'invalid') {
          return validationError(c, [
            { field: params.param, message: `Invalid ${params.param} parameter` },
          ])
        }

        const result = yield* readEvents(config.appName, params, config.profile).pipe(Effect.result)

        if (result._tag === 'Failure') {
          logError('[analytics] events query failed', result.failure, requestLogAttributes(c))
          return c.json(
            { success: false, message: 'Failed to query events', code: 'INTERNAL_ERROR' },
            500
          )
        }

        return shapedJson(c, result.success, listEventsResponseSchema)
      })
    )
  )
}

/**
 * Chain analytics routes onto a Hono app
 *
 * Provides:
 * - POST /api/analytics/collect - Record page view (public, no auth)
 * - POST /api/analytics/click - Record outbound click (public, no auth)
 * - GET /api/analytics/overview - Summary + time series (admin only)
 * - GET /api/analytics/pages - Top pages (admin only)
 * - GET /api/analytics/referrers - Top referrers (admin only)
 * - GET /api/analytics/devices - Device breakdown (admin only)
 * - GET /api/analytics/campaigns - UTM campaigns (admin only)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param config - Per-app analytics configuration (appName, retention, exclusions, DNT)
 * @returns Hono app with analytics routes chained
 */
export function chainAnalyticsRoutes(honoApp: Hono, config: AnalyticsRouteConfig): Hono {
  return honoApp
    .post('/api/analytics/collect', effectValidator('json', analyticsCollectSchema), (c) =>
      handleCollect(c, config)
    )
    .post('/api/analytics/click', effectValidator('json', analyticsClickSchema), (c) =>
      handleClick(c, config)
    )
    .get('/api/analytics/overview', (c) => handleOverview(c, config))
    .get('/api/analytics/pages', (c) => handlePages(c, config))
    .get('/api/analytics/referrers', (c) => handleReferrers(c, config))
    .get('/api/analytics/devices', (c) => handleDevices(c, config))
    .get('/api/analytics/campaigns', (c) => handleCampaigns(c, config))
    .get('/api/analytics/targets', (c) => handleTargets(c, config))
    .get('/api/analytics/events', (c) => handleEvents(c, config))
}
