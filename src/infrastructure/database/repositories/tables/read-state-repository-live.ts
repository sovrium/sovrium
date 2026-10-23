/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ReadStateDatabaseError,
  ReadStateRepository,
  type ReadPosition,
} from '@/application/ports/repositories/tables/read-state-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { readState as readStatePg } from '@/infrastructure/database/drizzle/schema/read-state'
import { readState as readStateSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/read-state'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * Drizzle implementation of the read-state port, resolved once per dialect
 * (`system.read_state` on PostgreSQL, the flat `system_read_state` on SQLite).
 */
const readState = resolveDialectSchema(readStatePg, readStateSqlite)

const wrap = makeDbWrap((cause) => new ReadStateDatabaseError({ cause }))

const toPosition = (row: Readonly<Record<string, unknown>>): ReadPosition => ({
  tableName: String(row['tableName']),
  recordId: String(row['recordId']),
  lastReadAt:
    row['lastReadAt'] instanceof Date ? row['lastReadAt'] : new Date(String(row['lastReadAt'])),
})

export const ReadStateRepositoryLive = Layer.succeed(ReadStateRepository, {
  markRead: ({ userId, tableName, recordId, at }) =>
    wrap(() =>
      // One statement, so two marks racing leave one row.
      db
        .insert(readState)
        .values({ userId, tableName, recordId, lastReadAt: at })
        .onConflictDoUpdate({
          target: [readState.userId, readState.tableName, readState.recordId],
          set: { lastReadAt: at },
        })
    ).pipe(Effect.asVoid),

  positionsOf: ({ userId, tableName, recordIds }) =>
    recordIds.length === 0
      ? Effect.succeed([])
      : wrap(() =>
          db
            .select()
            .from(readState)
            .where(
              and(
                eq(readState.userId, userId),
                eq(readState.tableName, tableName),
                inArray(readState.recordId, [...recordIds])
              )
            )
        ).pipe(Effect.map((rows) => (rows as readonly Record<string, unknown>[]).map(toPosition))),

  listForUser: (userId) =>
    wrap(() =>
      db
        .select()
        .from(readState)
        .where(eq(readState.userId, userId))
        .orderBy(asc(readState.tableName), asc(readState.recordId))
    ).pipe(Effect.map((rows) => (rows as readonly Record<string, unknown>[]).map(toPosition))),
})
