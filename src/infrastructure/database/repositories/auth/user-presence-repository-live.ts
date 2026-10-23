/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { inArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  UserPresenceDatabaseError,
  UserPresenceRepository,
} from '@/application/ports/repositories/auth/user-presence-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { userPresence as userPresencePg } from '@/infrastructure/database/drizzle/schema/user-presence'
import { userPresence as userPresenceSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-presence'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * Drizzle implementation of the last-seen port, resolved once per dialect
 * (`system.user_presence` on PostgreSQL, the flat `system_user_presence` on SQLite).
 */
const userPresence = resolveDialectSchema(userPresencePg, userPresenceSqlite)

const wrap = makeDbWrap((cause) => new UserPresenceDatabaseError({ cause }))

export const UserPresenceRepositoryLive = Layer.succeed(UserPresenceRepository, {
  recordLastSeen: (userId, at) =>
    wrap(() =>
      db
        .insert(userPresence)
        .values({ userId, lastSeenAt: at })
        .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: at } })
    ).pipe(Effect.asVoid),

  lastSeenOf: (userIds) =>
    userIds.length === 0
      ? Effect.succeed([])
      : wrap(() =>
          db
            .select()
            .from(userPresence)
            .where(inArray(userPresence.userId, [...userIds]))
        ).pipe(
          Effect.map((rows) =>
            (rows as readonly Record<string, unknown>[]).map((row) => ({
              userId: String(row['userId']),
              lastSeenAt:
                row['lastSeenAt'] instanceof Date
                  ? row['lastSeenAt']
                  : new Date(String(row['lastSeenAt'])),
            }))
          )
        ),
})
