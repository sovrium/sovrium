/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, eq, gt, inArray, ne, or, sql } from 'drizzle-orm'
import { AnalyticsDatabaseError } from '@/application/ports/repositories/analytics/analytics-repository'
import {
  PAGE_VIEW_EXCLUDED_PROPERTIES,
  SHARED_IDENTIFIER_EVENT_TYPES,
  SHARED_IDENTIFIERS,
} from '@/domain/models/app/analytics/analytics-profile-service'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { analyticsEvents as analyticsEventsPg } from '@/infrastructure/database/drizzle/schema/analytics-events'
import { analyticsEvents as analyticsEventsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/analytics-events'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type {
  AnalyticsEventRow,
  MinimisedEventWrite,
  UnminimisedEventsPage,
} from '@/application/ports/repositories/analytics/analytics-repository'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'
import type { AllowedJsonKey } from '@/infrastructure/database/sql/dialect-sql-strategy'
import type { SQL } from 'drizzle-orm'
import type { Effect } from 'effect'

const analyticsEvents = resolveDialectSchema(analyticsEventsPg, analyticsEventsSqlite)

const wrap = makeDbWrap((error) => new AnalyticsDatabaseError({ cause: error }))

/**
 * The rows that MAY still carry a field `audience-only` excludes: a coarse,
 * index-friendly prefilter. The domain's `minimiseEvent` decides for each row,
 * so a row this lets through that needs nothing is simply left alone.
 */
const mayCarryExcludedFields = (dialect: Dialect): SQL | undefined => {
  const field = (key: AllowedJsonKey) =>
    dialect.sql.jsonExtractPath(analyticsEvents.properties, key)
  const present = (key: AllowedJsonKey) => sql`${field(key)} IS NOT NULL`
  const hasQuery = (key: AllowedJsonKey) =>
    or(sql`${field(key)} LIKE '%?%'`, sql`${field(key)} LIKE '%#%'`)
  return or(
    and(
      eq(analyticsEvents.eventType, 'page_view'),
      or(...PAGE_VIEW_EXCLUDED_PROPERTIES.map(present), hasQuery('path'))
    ),
    and(
      eq(analyticsEvents.eventType, 'outbound_click'),
      or(hasQuery('href'), hasQuery('pagePath'))
    ),
    and(
      inArray(analyticsEvents.eventType, [...SHARED_IDENTIFIER_EVENT_TYPES]),
      or(
        ne(analyticsEvents.visitorHash, SHARED_IDENTIFIERS.visitorHash),
        ne(analyticsEvents.sessionHash, SHARED_IDENTIFIERS.sessionHash)
      )
    ),
    and(
      inArray(analyticsEvents.eventType, ['link_click', 'qr_scan']),
      or(hasQuery('destination'), present('referrerUrl'), present('utmSource'))
    ),
    and(eq(analyticsEvents.eventType, 'form_submission'), present('submissionId'))
  )
}

/** One page of candidate rows of an app, in id order, after a cursor. */
const listUnminimisedEvents =
  (db: PortableDb, dialect: Dialect) =>
  (
    page: UnminimisedEventsPage
  ): Effect.Effect<readonly AnalyticsEventRow[], AnalyticsDatabaseError> =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(analyticsEvents)
        .where(
          and(
            inArray(analyticsEvents.appName, [page.appName, 'default']),
            ...(page.afterId === undefined ? [] : [gt(analyticsEvents.id, page.afterId)]),
            mayCarryExcludedFields(dialect)
          )
        )
        .orderBy(asc(analyticsEvents.id))
        .limit(page.limit)
      return rows.map((row) => ({
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
    })

/** Overwrite one row's identifiers and properties; its other columns are kept. */
const rewriteEvent =
  (db: PortableDb, dialect: Dialect) =>
  (write: MinimisedEventWrite): Effect.Effect<void, AnalyticsDatabaseError> =>
    wrap(async () => {
      await db
        .update(analyticsEvents)
        .set({
          visitorHash: write.visitorHash,
          sessionHash: write.sessionHash,
          properties: dialect.sql.bindJsonb(write.properties) as never,
        })
        .where(eq(analyticsEvents.id, write.id))
    })

/** The two repository members, spread into `AnalyticsRepositoryLive`. */
export const minimisationMembers = { listUnminimisedEvents, rewriteEvent }
