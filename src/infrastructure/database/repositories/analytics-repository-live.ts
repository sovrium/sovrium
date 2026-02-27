/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, between, count, countDistinct, eq, inArray, lt, or, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AnalyticsRepository,
  AnalyticsDatabaseError,
} from '@/application/ports/repositories/analytics-repository'
import { db } from '@/infrastructure/database'
import { analyticsPageViews } from '@/infrastructure/database/drizzle/schema/analytics-page-views'
import type { AnalyticsQueryParams } from '@/application/ports/repositories/analytics-repository'

/**
 * Build the common WHERE clause for analytics queries
 *
 * Matches both the specified appName AND 'default' to support
 * direct SQL inserts (which use the schema default 'default').
 */
const whereClause = (params: AnalyticsQueryParams) =>
  and(
    inArray(analyticsPageViews.appName, [params.appName, 'default']),
    between(analyticsPageViews.timestamp, params.from, params.to)
  )

/**
 * Map granularity to PostgreSQL DATE_TRUNC interval
 */
const granularityToInterval = (granularity: string): string => {
  const map: Record<string, string> = {
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
  }
  return map[granularity] ?? 'day'
}

/**
 * Compute percentage breakdown from count results
 */
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

/**
 * Analytics Repository Implementation
 *
 * Uses Drizzle ORM query builder with raw SQL for aggregations.
 * All queries are parameterized (SQL injection safe).
 */
export const AnalyticsRepositoryLive = Layer.succeed(AnalyticsRepository, {
  recordPageView: (input) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.insert(analyticsPageViews).values({
          appName: input.appName,
          pagePath: input.pagePath,
          pageTitle: input.pageTitle,
          visitorHash: input.visitorHash,
          sessionHash: input.sessionHash,
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
        })
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getSummary: (params) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select({
            pageViews: count(),
            uniqueVisitors: countDistinct(analyticsPageViews.visitorHash),
            sessions: countDistinct(analyticsPageViews.sessionHash),
          })
          .from(analyticsPageViews)
          .where(whereClause(params))

        const row = result[0]
        return {
          pageViews: row?.pageViews ?? 0,
          uniqueVisitors: row?.uniqueVisitors ?? 0,
          sessions: row?.sessions ?? 0,
        }
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getTimeSeries: (params) =>
    Effect.tryPromise({
      try: async () => {
        const interval = granularityToInterval(params.granularity)
        const rows = await db
          .select({
            period:
              sql<string>`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsPageViews.timestamp})::text`.as(
                'period'
              ),
            pageViews: count(),
            uniqueVisitors: countDistinct(analyticsPageViews.visitorHash),
            sessions: countDistinct(analyticsPageViews.sessionHash),
          })
          .from(analyticsPageViews)
          .where(whereClause(params))
          .groupBy(sql`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsPageViews.timestamp})`)
          .orderBy(sql`DATE_TRUNC(${sql.raw(`'${interval}'`)}, ${analyticsPageViews.timestamp})`)

        return rows.map((row) => ({
          period: row.period,
          pageViews: row.pageViews,
          uniqueVisitors: row.uniqueVisitors,
          sessions: row.sessions,
        }))
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getTopPages: (params) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            path: analyticsPageViews.pagePath,
            pageViews: count(),
            uniqueVisitors: countDistinct(analyticsPageViews.visitorHash),
          })
          .from(analyticsPageViews)
          .where(whereClause(params))
          .groupBy(analyticsPageViews.pagePath)
          .orderBy(sql`count(*) DESC`)

        return rows.map((row) => ({
          path: row.path,
          pageViews: row.pageViews,
          uniqueVisitors: row.uniqueVisitors,
        }))
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getTopReferrers: (params) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            domain: analyticsPageViews.referrerDomain,
            pageViews: count(),
            uniqueVisitors: countDistinct(analyticsPageViews.visitorHash),
          })
          .from(analyticsPageViews)
          .where(
            and(
              whereClause(params),
              // Exclude UTM campaign traffic (belongs in /api/analytics/campaigns)
              or(
                // Include rows with referrer_domain set
                sql`${analyticsPageViews.referrerDomain} IS NOT NULL`,
                // Include direct traffic (NULL referrer AND NULL campaign)
                and(
                  sql`${analyticsPageViews.referrerDomain} IS NULL`,
                  sql`${analyticsPageViews.utmCampaign} IS NULL`
                )
              )
            )
          )
          .groupBy(analyticsPageViews.referrerDomain)
          .orderBy(sql`count(*) DESC`)

        return rows.map((row) => ({
          // eslint-disable-next-line unicorn/no-null -- null represents direct traffic (no referrer)
          domain: row.domain ?? null,
          pageViews: row.pageViews,
          uniqueVisitors: row.uniqueVisitors,
        }))
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getDevices: (params) =>
    Effect.tryPromise({
      try: async () => {
        const condition = whereClause(params)

        // Device type breakdown
        const deviceRows = await db
          .select({
            name: analyticsPageViews.deviceType,
            count: count(),
          })
          .from(analyticsPageViews)
          .where(condition)
          .groupBy(analyticsPageViews.deviceType)
          .orderBy(sql`count(*) DESC`)

        // Browser breakdown
        const browserRows = await db
          .select({
            name: analyticsPageViews.browserName,
            count: count(),
          })
          .from(analyticsPageViews)
          .where(condition)
          .groupBy(analyticsPageViews.browserName)
          .orderBy(sql`count(*) DESC`)

        // OS breakdown
        const osRows = await db
          .select({
            name: analyticsPageViews.osName,
            count: count(),
          })
          .from(analyticsPageViews)
          .where(condition)
          .groupBy(analyticsPageViews.osName)
          .orderBy(sql`count(*) DESC`)

        return {
          deviceTypes: computePercentages(deviceRows),
          browsers: computePercentages(browserRows),
          operatingSystems: computePercentages(osRows),
        }
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  getCampaigns: (params) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({
            source: analyticsPageViews.utmSource,
            medium: analyticsPageViews.utmMedium,
            campaign: analyticsPageViews.utmCampaign,
            pageViews: count(),
            uniqueVisitors: countDistinct(analyticsPageViews.visitorHash),
          })
          .from(analyticsPageViews)
          .where(
            and(
              whereClause(params),
              // Only include rows that have at least one UTM parameter
              sql`(${analyticsPageViews.utmSource} IS NOT NULL OR ${analyticsPageViews.utmMedium} IS NOT NULL OR ${analyticsPageViews.utmCampaign} IS NOT NULL)`
            )
          )
          .groupBy(
            analyticsPageViews.utmSource,
            analyticsPageViews.utmMedium,
            analyticsPageViews.utmCampaign
          )
          .orderBy(sql`count(*) DESC`)

        return rows.map((row) => ({
          // eslint-disable-next-line unicorn/no-null -- null represents missing UTM parameter
          source: row.source ?? null,
          // eslint-disable-next-line unicorn/no-null -- null represents missing UTM parameter
          medium: row.medium ?? null,
          // eslint-disable-next-line unicorn/no-null -- null represents missing UTM parameter
          campaign: row.campaign ?? null,
          pageViews: row.pageViews,
          uniqueVisitors: row.uniqueVisitors,
        }))
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),

  deleteOlderThan: (appName, cutoff) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(analyticsPageViews)
          .where(
            and(
              // Delete records for this app OR records with the default app name
              // This ensures test data inserted via the view (which gets 'default' app_name)
              // is cleaned up by retention logic regardless of the actual app name
              or(
                eq(analyticsPageViews.appName, appName),
                eq(analyticsPageViews.appName, 'default')
              ),
              lt(analyticsPageViews.timestamp, cutoff)
            )
          )
          .returning({ id: analyticsPageViews.id })

        return result.length
      },
      catch: (error) => new AnalyticsDatabaseError({ cause: error }),
    }),
})
