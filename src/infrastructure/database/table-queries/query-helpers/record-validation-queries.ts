/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { getExistingColumnNames } from '@/infrastructure/database/sql/dialect-introspection'
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
}): Effect.Effect<boolean, DatabaseError> {
  const { session, tableName, recordId, isAdmin = false } = config
  return Effect.gen(function* () {
    // Check which of deleted_at / owner_id exist (dialect-aware introspection)
    const columns = yield* Effect.tryPromise({
      try: () => getExistingColumnNames(db, tableName, ['deleted_at', 'owner_id']),
      catch: (error) => new DatabaseError('Failed to check table columns', error),
    })

    const hasDeletedAt = columns.has('deleted_at')
    const hasOwnerId = columns.has('owner_id')

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
      try: () => executeRaw(db, query),
      catch: (error) => new DatabaseError('Failed to check record existence', error),
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
  DatabaseError
> {
  const { userId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => {
        const users = authUsersTable()
        return db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      },
      catch: (error) => new DatabaseError('Failed to get user', error),
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
