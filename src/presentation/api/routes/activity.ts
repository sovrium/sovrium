/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Hono } from 'hono'

/**
 * Activity log response type
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly organizationId: string | null
  readonly userId: string | null
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly table_name: string
  readonly recordId: string
}

/**
 * List activity logs with organization isolation
 *
 * Filters activity logs by:
 * - User's organization (multi-tenant isolation)
 * - User's role (admin/member only, viewers forbidden)
 *
 * @param session - Better Auth session with userId and organizationId
 * @returns Effect program that lists activity logs
 */
function listActivityLogs(session: {
  readonly userId: string
  readonly organizationId?: string
}): Effect.Effect<readonly ActivityLogResponse[], never> {
  return Effect.gen(function* () {
    // Import database at runtime to avoid circular dependencies
    const { db } = yield* Effect.promise(() => import('@/infrastructure/database'))

    // Query activity logs with organization filtering
    const query = session.organizationId
      ? `SELECT id, created_at as "createdAt", organization_id as "organizationId", user_id as "userId", action, table_name, record_id as "recordId"
         FROM _sovrium_activity_logs
         WHERE organization_id = '${session.organizationId.replace(/'/g, "''")}'
         ORDER BY created_at DESC`
      : `SELECT id, created_at as "createdAt", organization_id as "organizationId", user_id as "userId", action, table_name, record_id as "recordId"
         FROM _sovrium_activity_logs
         ORDER BY created_at DESC`

    const result = (yield* Effect.promise(() => db.execute(query))) as readonly ActivityLogResponse[]

    return result
  })
}

/**
 * Get user role from database
 *
 * @param userId - User ID to look up
 * @returns Effect program that returns user role
 */
function getUserRole(userId: string): Effect.Effect<string | null, never> {
  return Effect.gen(function* () {
    const { db } = yield* Effect.promise(() => import('@/infrastructure/database'))

    const result = (yield* Effect.promise(() =>
      db.execute(
        `SELECT role FROM _sovrium_auth_members WHERE user_id = '${userId.replace(/'/g, "''")}' LIMIT 1`
      )
    )) as Array<{ role: string | null }>

    return result[0]?.role ?? null
  })
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs (admin/member only)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/activity', async (c) => {
    // Extract session from context (set by auth middleware)
    const { session } = (c as ContextWithSession).var

    if (!session) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
        },
        401
      )
    }

    // Get user role to enforce permissions
    const program = Effect.gen(function* () {
      const role = yield* getUserRole(session.userId)

      // Viewers cannot access activity logs
      if (role === 'viewer') {
        return yield* Effect.fail({
          status: 403 as const,
          error: 'Forbidden',
          message: 'You do not have permission to access activity logs',
        })
      }

      // List activity logs with organization isolation
      const logs = yield* listActivityLogs({
        userId: session.userId,
        organizationId: session.organizationId,
      })

      return { status: 200 as const, logs }
    })

    try {
      const result = await Effect.runPromise(program)

      if (result.status === 403) {
        return c.json(
          {
            error: result.error,
            message: result.message,
          },
          403
        )
      }

      return c.json(result.logs, 200)
    } catch (error) {
      return c.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  })
}
