/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNotNull, notInArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  CalendarFeedTokenDatabaseError,
  CalendarFeedTokenRepository,
  type CalendarFeedTokenRecord,
} from '@/application/ports/repositories/tables/calendar-feed-token-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { calendarFeedTokens as calendarFeedTokensPg } from '@/infrastructure/database/drizzle/schema/calendar-feed-tokens'
import { calendarFeedTokens as calendarFeedTokensSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/calendar-feed-tokens'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * Drizzle implementation of the calendar feed address port, resolved once per
 * dialect (`system.calendar_feed_tokens` on PostgreSQL, the flat
 * `system_calendar_feed_tokens` on SQLite).
 */
const calendarFeedTokens = resolveDialectSchema(calendarFeedTokensPg, calendarFeedTokensSqlite)

const wrap = makeDbWrap((cause) => new CalendarFeedTokenDatabaseError({ cause }))

/** Project a row onto the port's shape; the digest is dropped here, at the boundary. */
const decodeRow = (row: Readonly<Record<string, unknown>>): CalendarFeedTokenRecord => ({
  userId: String(row['userId']),
  tableName: String(row['tableName']),
  createdAt:
    row['createdAt'] instanceof Date ? row['createdAt'] : new Date(String(row['createdAt'])),
})

const firstOf = (
  rows: readonly Readonly<Record<string, unknown>>[]
): CalendarFeedTokenRecord | undefined => (rows[0] === undefined ? undefined : decodeRow(rows[0]))

export const CalendarFeedTokenRepositoryLive = Layer.succeed(CalendarFeedTokenRepository, {
  replace: ({ userId, tableName, tokenDigest }) =>
    wrap(async () => {
      // One statement, so two mints racing leave one row and one live address.
      const [row] = await db
        .insert(calendarFeedTokens)
        .values({ userId, tableName, tokenDigest, createdAt: new Date() })
        .onConflictDoUpdate({
          target: [calendarFeedTokens.userId, calendarFeedTokens.tableName],
          set: { tokenDigest, createdAt: new Date() },
        })
        .returning()
      return decodeRow(
        (row ?? { userId, tableName, createdAt: new Date() }) as Record<string, unknown>
      )
    }),

  find: (userId, tableName) =>
    wrap(() =>
      db
        .select()
        .from(calendarFeedTokens)
        .where(
          and(eq(calendarFeedTokens.userId, userId), eq(calendarFeedTokens.tableName, tableName))
        )
        .limit(1)
    ).pipe(Effect.map((rows) => firstOf(rows as readonly Record<string, unknown>[]))),

  findByDigest: (tokenDigest) =>
    wrap(() =>
      db
        .select()
        .from(calendarFeedTokens)
        .where(eq(calendarFeedTokens.tokenDigest, tokenDigest))
        .limit(1)
    ).pipe(Effect.map((rows) => firstOf(rows as readonly Record<string, unknown>[]))),

  revoke: (userId, tableName) =>
    wrap(() =>
      db
        .delete(calendarFeedTokens)
        .where(
          and(eq(calendarFeedTokens.userId, userId), eq(calendarFeedTokens.tableName, tableName))
        )
        .returning()
    ).pipe(Effect.map((rows) => rows.length > 0)),

  purgeTablesWithoutFeed: (keep) =>
    wrap(() =>
      keep.size === 0
        ? // Every row: `table_name` is never null, so this names them all.
          db.delete(calendarFeedTokens).where(isNotNull(calendarFeedTokens.tableName)).returning()
        : db
            .delete(calendarFeedTokens)
            .where(notInArray(calendarFeedTokens.tableName, [...keep]))
            .returning()
    ).pipe(Effect.map((rows) => rows.length)),
})
