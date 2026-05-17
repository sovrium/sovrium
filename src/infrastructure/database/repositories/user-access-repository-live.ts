/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  UserAccessDatabaseError,
  UserAccessRepository,
  type UserAccessRow,
} from '@/application/ports/repositories/user-access-repository'
import { db } from '@/infrastructure/database'
import { userAccess } from '@/infrastructure/database/drizzle/schema/user-access'

/**
 * Project a Drizzle row into the port's `UserAccessRow` shape. Centralised
 * so insert and list paths emit identical envelopes (and the route handler
 * can stay agnostic of Drizzle's `$inferSelect` typing).
 */
const shapeRow = (row: Readonly<typeof userAccess.$inferSelect>): UserAccessRow => ({
  id: row.id,
  userId: row.userId,
  tableSlug: row.tableSlug,
  recordIds: row.recordIds,
  role: row.role,
  createdAt: row.createdAt,
  createdBy: row.createdBy ?? undefined,
})

/**
 * User-Access Repository Implementation (Drizzle).
 *
 * Replaces the raw `bun:sql` access that previously lived in
 * `user-access-handlers.ts` (R-1 audit follow-up). The DDL is still
 * engine-managed via `schema-initializer.ts` — this layer just provides
 * type-safe inserts/selects against that schema.
 */
export const UserAccessRepositoryLive = Layer.succeed(UserAccessRepository, {
  insert: (input, createdBy) =>
    Effect.tryPromise({
      try: async () => {
        // We populate `createdAt` from the JS clock rather than relying
        // on the DDL's `DEFAULT NOW()`. Two reasons:
        //   1. The Z-2 spec asserts the returned `created_at` is bounded
        //      by the test process's `Date.now()` at request entry — a
        //      DB-clock-vs-host-clock skew (≤10ms in containerised
        //      Postgres) flips that assertion intermittently.
        //   2. The previous raw-SQL implementation paid ~50ms of
        //      connection-setup latency per call, which incidentally
        //      masked any clock skew. Reusing the pool removes that
        //      latency and exposes the timestamp ordering directly.
        // This is a *behaviour-preserving* tweak: the timestamp still
        // represents grant time within milliseconds of the request.
        const [row] = await db
          .insert(userAccess)
          .values({
            userId: input.userId,
            tableSlug: input.tableSlug,
            recordIds: [...input.recordIds],
            role: input.role,
            createdAt: new Date(),
            createdBy,
          })
          .returning()
        if (!row) {
          /* eslint-disable-next-line functional/no-throw-statements */
          throw new Error('user_access INSERT returned no rows')
        }
        return shapeRow(row)
      },
      catch: (cause) => new UserAccessDatabaseError({ cause }),
    }),

  list: (filter) =>
    Effect.tryPromise({
      try: async () => {
        const rows =
          filter.userId === undefined
            ? await db.select().from(userAccess).orderBy(asc(userAccess.createdAt))
            : await db
                .select()
                .from(userAccess)
                .where(eq(userAccess.userId, filter.userId))
                .orderBy(asc(userAccess.createdAt))
        return rows.map((row) => shapeRow(row))
      },
      catch: (cause) => new UserAccessDatabaseError({ cause }),
    }),
})
