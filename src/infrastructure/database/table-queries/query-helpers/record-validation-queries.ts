/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { getExistingColumnNames } from '@/infrastructure/database/sql/dialect-introspection'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

function buildRecordCheckQuery(params: {
  readonly tableName: string
  readonly recordId: string
  readonly userId: string
  readonly hasDeletedAt: boolean
  readonly hasOwnerId: boolean
  readonly isAdmin: boolean
}) {
  const { tableName, recordId, userId, hasDeletedAt, hasOwnerId, isAdmin } = params
  const shouldFilterOwner = hasOwnerId && !isAdmin

  if (hasDeletedAt && shouldFilterOwner) {
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL AND (owner_id = ${userId} OR owner_id IS NULL)`
  }
  if (hasDeletedAt) {
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL`
  }
  if (shouldFilterOwner) {
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND (owner_id = ${userId} OR owner_id IS NULL)`
  }
  return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId}`
}

export function checkRecordExists(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly isAdmin?: boolean
}): Effect.Effect<boolean, SessionContextError> {
  const { session, tableName, recordId, isAdmin = false } = config
  return Effect.gen(function* () {
    const columns = yield* Effect.tryPromise({
      try: () => getExistingColumnNames(db, tableName, ['deleted_at', 'owner_id']),
      catch: (error) => new SessionContextError('Failed to check table columns', error),
    })

    const hasDeletedAt = columns.has('deleted_at')
    const hasOwnerId = columns.has('owner_id')

    const query = buildRecordCheckQuery({
      tableName,
      recordId,
      userId: session.userId,
      hasDeletedAt,
      hasOwnerId,
      isAdmin,
    })
    const result = yield* Effect.tryPromise({
      try: () => executeRaw(db, query),
      catch: (error) => new SessionContextError('Failed to check record existence', error),
    })

    return result.length > 0
  })
}

export function getUserById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<
  | {
      readonly id: string
      readonly role: string | undefined
    }
  | undefined,
  SessionContextError
> {
  const { userId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
      catch: (error) => new SessionContextError('Failed to get user', error),
    })

    if (result.length === 0 || !result[0]) {
      return undefined
    }

    return {
      id: result[0].id,
      role: result[0].role ?? undefined,
    }
  })
}
