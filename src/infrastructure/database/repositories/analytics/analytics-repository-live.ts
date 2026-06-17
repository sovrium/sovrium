/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, between, count, countDistinct, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AnalyticsRepository,
  AnalyticsDatabaseError,
} from '@/application/ports/repositories/analytics/analytics-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { analyticsEvents as analyticsEventsPg } from '@/infrastructure/database/drizzle/schema/analytics-events'
import { analyticsEvents as analyticsEventsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/analytics-events'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import {
  dateTruncTimeBucket,
  jsonExtractPath,
} from '@/infrastructure/database/sql/dialect-sql-helpers'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { AnalyticsQueryParams } from '@/application/ports/repositories/analytics/analytics-repository'

const analyticsEvents = resolveDialectSchema(analyticsEventsPg, analyticsEventsSqlite)

const wrap = makeDbWrap((error) => new AnalyticsDatabaseError({ cause: error }))

const pageViewWhereClause = (params: AnalyticsQueryParams) =>
  and(
    inArray(analyticsEvents.appName, [params.appName, 'default']),
    eq(analyticsEvents.eventType, 'page_view'),
    between(analyticsEvents.timestamp, params.from, params.to)
  )

const narrowGranularity = (granularity: string): 'hour' | 'day' | 'week' | 'month' => {
  if (
    granularity === 'hour' ||
    granularity === 'day' ||
    granularity === 'week' ||
    granularity === 'month'
  ) {
    return granularity
  }
  return 'day'
}

const computePercentages = (
  rows: readonly { readonly name: string | null; readonly count: number }[]
): readonly { readonly name: string; readonly count: number; readonly percentage: number }[] => {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (total === 0) return []
  return rows.map((row) => ({
    name: row.name ?? 'Unknown',
    count: row.count,
    percentage: Math.round((row.count / total) * 10_000) / 100,
  }))
}

export const AnalyticsRepositoryLive = Layer.succeed(AnalyticsRepository, {
  recordEvent: (input) =>
    wrap(async () => {
      await db.insert(analyticsEvents).values({
        appName: input.appName,
        eventType: input.eventType,
        eventName: input.eventName ?? undefined,
        orgId: input.orgId ?? undefined,
        visitorHash: input.visitorHash,
        sessionHash: input.sessionHash,
        properties: jsonbLiteral(input.properties ?? {}) as never,
      })
    }),

  recordPageView: (input) =>
    wrap(async () => {
      const properties = {
        path: input.pagePath,
        title: input.pageTitle,
        isEntrance: input.isEntrance,
        referrerUrl: input.referrerUrl,
        referrerDomain: input.referrerDomain,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
        utmTerm: input.utmTerm,
        deviceType: input.deviceType,
        browserName: input.browserName,
        osName: input.osName,
        language: input.language,
        screenWidth: input.screenWidth,
        screenHeight: input.screenHeight,
      }
      await db.insert(analyticsEvents).values({
        appName: input.appName,
        eventType: 'page_view',
        visitorHash: input.visitorHash,
        sessionHash: input.sessionHash,
        properties: jsonbLiteral(properties) as never,
      })
    }),

  getSummary: (params) =>
    wrap(async () => {
      const result = await db
        .select({
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
          sessions: countDistinct(analyticsEvents.sessionHash),
        })
        .from(analyticsEvents)
        .where(pageViewWhereClause(params))

      const row = result[0]
      return {
        pageViews: row?.pageViews ?? 0,
        uniqueVisitors: row?.uniqueVisitors ?? 0,
        sessions: row?.sessions ?? 0,
      }
    }),

  getTimeSeries: (params) =>
    wrap(async () => {
      const bucket = narrowGranularity(params.granularity)
      const periodExpr = dateTruncTimeBucket(analyticsEvents.timestamp, bucket)
      const rows = await db
        .select({
          period: sql<string>`${periodExpr}`.as('period'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
          sessions: countDistinct(analyticsEvents.sessionHash),
        })
        .from(analyticsEvents)
        .where(pageViewWhereClause(params))
        .groupBy(periodExpr)
        .orderBy(periodExpr)

      return rows.map((row) => ({
        period: row.period,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
        sessions: row.sessions,
      }))
    }),

  getTopPages: (params) =>
    wrap(async () => {
      const pathExpr = jsonExtractPath(analyticsEvents.properties, 'path')
      const rows = await db
        .select({
          path: sql<string>`${pathExpr}`.as('path'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(pageViewWhereClause(params))
        .groupBy(pathExpr)
        .orderBy(sql`count(*) DESC`)

      return rows.map((row) => ({
        path: row.path,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
      }))
    }),

  getTopReferrers: (params) =>
    wrap(async () => {
      const refDomain = jsonExtractPath(analyticsEvents.properties, 'referrerDomain')
      const utmCampaign = jsonExtractPath(analyticsEvents.properties, 'utmCampaign')
      const rows = await db
        .select({
          domain: sql<string | null>`${refDomain}`.as('domain'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(
          and(
            pageViewWhereClause(params),
            or(
              sql`${refDomain} IS NOT NULL`,
              and(sql`${refDomain} IS NULL`, sql`${utmCampaign} IS NULL`)
            )
          )
        )
        .groupBy(refDomain)
        .orderBy(sql`count(*) DESC`)

      return rows.map((row) => ({
        domain: row.domain ?? null,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
      }))
    }),

  getDevices: (params) =>
    wrap(async () => {
      const condition = pageViewWhereClause(params)
      const deviceExpr = jsonExtractPath(analyticsEvents.properties, 'deviceType')
      const browserExpr = jsonExtractPath(analyticsEvents.properties, 'browserName')
      const osExpr = jsonExtractPath(analyticsEvents.properties, 'osName')

      const deviceRows = await db
        .select({
          name: sql<string | null>`${deviceExpr}`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(deviceExpr)
        .orderBy(sql`count(*) DESC`)

      const browserRows = await db
        .select({
          name: sql<string | null>`${browserExpr}`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(browserExpr)
        .orderBy(sql`count(*) DESC`)

      const osRows = await db
        .select({
          name: sql<string | null>`${osExpr}`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(osExpr)
        .orderBy(sql`count(*) DESC`)

      return {
        deviceTypes: computePercentages(deviceRows),
        browsers: computePercentages(browserRows),
        operatingSystems: computePercentages(osRows),
      }
    }),

  getCampaigns: (params) =>
    wrap(async () => {
      const sourceExpr = jsonExtractPath(analyticsEvents.properties, 'utmSource')
      const mediumExpr = jsonExtractPath(analyticsEvents.properties, 'utmMedium')
      const campaignExpr = jsonExtractPath(analyticsEvents.properties, 'utmCampaign')
      const rows = await db
        .select({
          source: sql<string | null>`${sourceExpr}`.as('source'),
          medium: sql<string | null>`${mediumExpr}`.as('medium'),
          campaign: sql<string | null>`${campaignExpr}`.as('campaign'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(
          and(
            pageViewWhereClause(params),
            sql`(${sourceExpr} IS NOT NULL OR ${mediumExpr} IS NOT NULL OR ${campaignExpr} IS NOT NULL)`
          )
        )
        .groupBy(sourceExpr, mediumExpr, campaignExpr)
        .orderBy(sql`count(*) DESC`)

      return rows.map((row) => ({
        source: row.source ?? null,
        medium: row.medium ?? null,
        campaign: row.campaign ?? null,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
      }))
    }),

  deleteOlderThan: (appName, cutoff) =>
    wrap(async () => {
      const result = await db
        .delete(analyticsEvents)
        .where(
          and(
            or(eq(analyticsEvents.appName, appName), eq(analyticsEvents.appName, 'default')),
            lt(analyticsEvents.timestamp, cutoff)
          )
        )
        .returning({ id: analyticsEvents.id })

      return result.length
    }),

  listEvents: (params) =>
    wrap(async () => {
      const limit = params.limit ?? 50
      const offset = params.offset ?? 0
      const conditions = [
        inArray(analyticsEvents.appName, [params.appName, 'default']),
        ...(params.eventType ? [eq(analyticsEvents.eventType, params.eventType)] : []),
        ...(params.eventName ? [eq(analyticsEvents.eventName, params.eventName)] : []),
        ...(params.from && params.to
          ? [between(analyticsEvents.timestamp, params.from, params.to)]
          : []),
      ]

      const [totalResult] = await db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(and(...conditions))

      const total = Number(totalResult?.count ?? 0)

      const rows = await db
        .select()
        .from(analyticsEvents)
        .where(and(...conditions))
        .orderBy(sql`${analyticsEvents.timestamp} DESC`)
        .limit(limit)
        .offset(offset)

      const events = rows.map((row) => ({
        id: row.id,
        appName: row.appName,
        eventType: row.eventType,
        eventName: row.eventName,
        orgId: row.orgId,
        visitorHash: row.visitorHash,
        sessionHash: row.sessionHash,
        timestamp: row.timestamp,
        properties: (row.properties ?? {}) as Record<string, unknown>,
      }))

      return {
        events,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + events.length < total,
        },
      }
    }),
})
