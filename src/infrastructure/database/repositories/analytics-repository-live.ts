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
} from '@/application/ports/repositories/analytics-repository'
import { db } from '@/infrastructure/database'
import { analyticsEvents } from '@/infrastructure/database/drizzle/schema/analytics-events'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { jsonbLiteral } from '@/infrastructure/database/sql/sql-utils'
import type { AnalyticsQueryParams } from '@/application/ports/repositories/analytics-repository'

const wrap = makeDbWrap((error) => new AnalyticsDatabaseError({ cause: error }))

const pageViewWhereClause = (params: AnalyticsQueryParams) =>
  and(
    inArray(analyticsEvents.appName, [params.appName, 'default']),
    eq(analyticsEvents.eventType, 'page_view'),
    between(analyticsEvents.timestamp, params.from, params.to)
  )

const granularityToInterval = (granularity: string): string => {
  const map: Record<string, string> = {
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
  }
  return map[granularity] ?? 'day'
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
      const eventNameClause = input.eventName ? sql`${input.eventName}` : sql.raw('NULL')
      const orgIdClause = input.orgId ? sql`${input.orgId}` : sql.raw('NULL')
      await db.execute(
        sql`INSERT INTO system.analytics_events
              (app_name, event_type, event_name, org_id, visitor_hash, session_hash, properties)
              VALUES (
                ${input.appName},
                ${input.eventType},
                ${eventNameClause},
                ${orgIdClause},
                ${input.visitorHash},
                ${input.sessionHash},
                ${jsonbLiteral(input.properties ?? {})}
              )`
      )
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
      await db.execute(
        sql`INSERT INTO system.analytics_events
              (app_name, event_type, visitor_hash, session_hash, properties)
              VALUES (
                ${input.appName},
                'page_view',
                ${input.visitorHash},
                ${input.sessionHash},
                ${jsonbLiteral(properties)}
              )`
      )
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
      const interval = granularityToInterval(params.granularity)
      const rows = await db
        .select({
          period:
            sql<string>`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsEvents.timestamp})::text`.as(
              'period'
            ),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
          sessions: countDistinct(analyticsEvents.sessionHash),
        })
        .from(analyticsEvents)
        .where(pageViewWhereClause(params))
        .groupBy(sql`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsEvents.timestamp})`)
        .orderBy(sql`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsEvents.timestamp})`)

      return rows.map((row) => ({
        period: row.period,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
        sessions: row.sessions,
      }))
    }),

  getTopPages: (params) =>
    wrap(async () => {
      const rows = await db
        .select({
          path: sql<string>`${analyticsEvents.properties}->>'path'`.as('path'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(pageViewWhereClause(params))
        .groupBy(sql`${analyticsEvents.properties}->>'path'`)
        .orderBy(sql`count(*) DESC`)

      return rows.map((row) => ({
        path: row.path,
        pageViews: row.pageViews,
        uniqueVisitors: row.uniqueVisitors,
      }))
    }),

  getTopReferrers: (params) =>
    wrap(async () => {
      const rows = await db
        .select({
          domain: sql<string | null>`${analyticsEvents.properties}->>'referrerDomain'`.as('domain'),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(
          and(
            pageViewWhereClause(params),
            or(
              sql`${analyticsEvents.properties}->>'referrerDomain' IS NOT NULL`,
              and(
                sql`${analyticsEvents.properties}->>'referrerDomain' IS NULL`,
                sql`${analyticsEvents.properties}->>'utmCampaign' IS NULL`
              )
            )
          )
        )
        .groupBy(sql`${analyticsEvents.properties}->>'referrerDomain'`)
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

      const deviceRows = await db
        .select({
          name: sql<string | null>`${analyticsEvents.properties}->>'deviceType'`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(sql`${analyticsEvents.properties}->>'deviceType'`)
        .orderBy(sql`count(*) DESC`)

      const browserRows = await db
        .select({
          name: sql<string | null>`${analyticsEvents.properties}->>'browserName'`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(sql`${analyticsEvents.properties}->>'browserName'`)
        .orderBy(sql`count(*) DESC`)

      const osRows = await db
        .select({
          name: sql<string | null>`${analyticsEvents.properties}->>'osName'`.as('name'),
          count: count(),
        })
        .from(analyticsEvents)
        .where(condition)
        .groupBy(sql`${analyticsEvents.properties}->>'osName'`)
        .orderBy(sql`count(*) DESC`)

      return {
        deviceTypes: computePercentages(deviceRows),
        browsers: computePercentages(browserRows),
        operatingSystems: computePercentages(osRows),
      }
    }),

  getCampaigns: (params) =>
    wrap(async () => {
      const rows = await db
        .select({
          source: sql<string | null>`${analyticsEvents.properties}->>'utmSource'`.as('source'),
          medium: sql<string | null>`${analyticsEvents.properties}->>'utmMedium'`.as('medium'),
          campaign: sql<string | null>`${analyticsEvents.properties}->>'utmCampaign'`.as(
            'campaign'
          ),
          pageViews: count(),
          uniqueVisitors: countDistinct(analyticsEvents.visitorHash),
        })
        .from(analyticsEvents)
        .where(
          and(
            pageViewWhereClause(params),
            sql`(${analyticsEvents.properties}->>'utmSource' IS NOT NULL OR ${analyticsEvents.properties}->>'utmMedium' IS NOT NULL OR ${analyticsEvents.properties}->>'utmCampaign' IS NOT NULL)`
          )
        )
        .groupBy(
          sql`${analyticsEvents.properties}->>'utmSource'`,
          sql`${analyticsEvents.properties}->>'utmMedium'`,
          sql`${analyticsEvents.properties}->>'utmCampaign'`
        )
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
