/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, between, count, eq, inArray } from 'drizzle-orm'
import { Effect } from 'effect'
import { AnalyticsDatabaseError } from '@/application/ports/repositories/analytics/analytics-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { analyticsEvents as analyticsEventsPg } from '@/infrastructure/database/drizzle/schema/analytics-events'
import { analyticsEvents as analyticsEventsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/analytics-events'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { CountEventsByNameParams } from '@/application/ports/repositories/analytics/analytics-repository'

const analyticsEvents = resolveDialectSchema(analyticsEventsPg, analyticsEventsSqlite)

const wrap = makeDbWrap((error) => new AnalyticsDatabaseError({ cause: error }))

/**
 * How many events of one type each of `names` recorded in `[from, to]`, as ONE
 * `GROUP BY event_name` query on both engines. The app scope matches the other
 * analytics reads (the app's own name and the `default` one), and the bounds
 * are bound parameters (S3). No name, no query.
 */
export const countEventsByName = (
  params: CountEventsByNameParams
): Effect.Effect<ReadonlyMap<string, number>, AnalyticsDatabaseError> =>
  params.names.length === 0
    ? Effect.succeed(new Map())
    : wrap(async () => {
        const rows = await db
          .select({ name: analyticsEvents.eventName, count: count() })
          .from(analyticsEvents)
          .where(
            and(
              inArray(analyticsEvents.appName, [params.appName, 'default']),
              eq(analyticsEvents.eventType, params.eventType),
              inArray(analyticsEvents.eventName, [...params.names]),
              between(analyticsEvents.timestamp, params.from, params.to)
            )
          )
          .groupBy(analyticsEvents.eventName)
        return new Map(
          rows.flatMap((row) =>
            row.name === null ? [] : [[row.name, toFiniteCount(row.count)] as const]
          )
        )
      })
