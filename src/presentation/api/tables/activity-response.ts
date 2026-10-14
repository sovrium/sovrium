/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The wire shape of the activity log routes: one entry as the API answers it,
 * with its actor projected for the reader, and the pagination of a list.
 */

import { projectActivityActor } from './activity-reader-gate'
import type { ActivityLogOutput } from '@/application/use-cases/list-activity-logs'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * User metadata in activity log API response. `email` is present for an admin
 * reader and on the reader's own entries only.
 */
interface ActivityLogResponseUser {
  readonly id: string
  readonly name: string
  readonly email?: string
}

/**
 * Activity log API response type
 *
 * Maps application ActivityLogOutput to API JSON response format.
 * Uses camelCase for all fields per API conventions.
 * user is null for system-logged activities (no user_id).
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly recordId: string
  readonly user: ActivityLogResponseUser | null
}

/**
 * Pagination metadata for list responses
 */
interface PaginationMeta {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

/**
 * Parsed and validated pagination parameters
 */
export interface PaginationParams {
  readonly page: number
  readonly pageSize: number
}

/**
 * Map ActivityLogOutput to API response format
 */
function mapToApiResponse(c: Context, app: App, log: ActivityLogOutput): ActivityLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user: projectActivityActor(c, app, log.user),
  }
}

/**
 * Parse and validate pagination query parameters
 *
 * Returns undefined if parameters are invalid.
 */
export function parsePaginationParams(
  pageParam: string | undefined,
  pageSizeParam: string | undefined
): PaginationParams | undefined {
  const page = pageParam === undefined ? 1 : parseInt(pageParam, 10)
  const pageSize = pageSizeParam === undefined ? 50 : parseInt(pageSizeParam, 10)

  if (isNaN(page) || page < 1) return undefined
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) return undefined

  return { page, pageSize }
}

/**
 * Build the paginated response from one page of activity and the count of
 * every admitted entry the filters match.
 */
export function buildPaginatedResponse(
  c: Context,
  app: App,
  {
    activities: logs,
    total,
  }: { readonly activities: readonly ActivityLogOutput[]; readonly total: number },
  params: PaginationParams
): { activities: readonly ActivityLogResponse[]; pagination: PaginationMeta } {
  const { page, pageSize } = params
  const pagination: PaginationMeta = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
  return { activities: logs.map((log) => mapToApiResponse(c, app, log)), pagination }
}
