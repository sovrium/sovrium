/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  type ActivityLogOutput,
  ForbiddenError,
  ListActivityLogs,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Hono } from 'hono'

/**
 * Activity log API response type
 *
 * Maps application ActivityLogOutput to API JSON response format.
 * Uses snake_case for table_name to match API conventions.
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly organizationId: string | undefined
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly table_name: string
  readonly recordId: string
}

/**
 * Map ActivityLogOutput to API response format
 */
function mapToApiResponse(log: ActivityLogOutput): ActivityLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    organizationId: log.organizationId,
    userId: log.userId,
    action: log.action,
    table_name: log.tableName,
    recordId: log.recordId,
  }
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
    const { session } = (c as ContextWithSession).var

    if (!session) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
    }

    const program = ListActivityLogs({
      userId: session.userId,
      organizationId: session.activeOrganizationId ?? undefined,
    }).pipe(Effect.provide(ListActivityLogsLayer))

    try {
      const logs = await Effect.runPromise(program)
      return c.json(logs.map(mapToApiResponse), 200)
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return c.json({ error: 'Forbidden', message: error.message }, 403)
      }
      return c.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  }) as T
}
