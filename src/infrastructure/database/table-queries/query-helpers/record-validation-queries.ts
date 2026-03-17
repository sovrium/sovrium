/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Build SQL query to check record existence with optional deleted_at filter and owner_id check
 * Admins bypass owner_id filtering to access all records
 *
 * owner_id filtering logic:
 * - Records with owner_id = NULL are accessible to all users (unowned records)
 * - Records with owner_id = <userId> are accessible only to that user (owned records)
 * - Admins can access all records regardless of owner_id
 */
function buildRecordCheckQuery(params: {
  readonly tableName: string
  readonly recordId: string
  readonly userId: string
  readonly hasDeletedAt: boolean
  readonly hasOwnerId: boolean
  readonly isAdmin: boolean
}) {
  const { tableName, recordId, userId, hasDeletedAt, hasOwnerId, isAdmin } = params
  // Admins bypass owner_id filtering
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

/**
 * Check if a record exists in the given table (with owner_id isolation for non-admins)
 * Admins can access all records regardless of owner_id
 */
export function checkRecordExists(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly isAdmin?: boolean
}): Effect.Effect<boolean, SessionContextError> {
  const { session, tableName, recordId, isAdmin = false } = config
  return Effect.gen(function* () {
    // Check if table has deleted_at column
    const columnsResult = yield* Effect.tryPromise({
      try: () =>
        db.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name IN ('deleted_at', 'owner_id')`
        ),
      catch: (error) => new SessionContextError('Failed to check table columns', error),
    })

    const columns = columnsResult as readonly Record<string, unknown>[]
    const hasDeletedAt = columns.some((row) => row.column_name === 'deleted_at')
    const hasOwnerId = columns.some((row) => row.column_name === 'owner_id')

    // Check if record exists (with owner_id check for multi-tenancy isolation, bypassed for admins)
    const query = buildRecordCheckQuery({
      tableName,
      recordId,
      userId: session.userId,
      hasDeletedAt,
      hasOwnerId,
      isAdmin,
    })
    const result = yield* Effect.tryPromise({
      try: () => db.execute(query),
      catch: (error) => new SessionContextError('Failed to check record existence', error),
    })

    return result.length > 0
  })
}

/**
 * Get user by ID
 */
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
