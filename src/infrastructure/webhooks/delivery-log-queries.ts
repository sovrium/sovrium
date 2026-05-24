/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@/infrastructure/database/drizzle/db-bun'

export interface DeliveryLogEntry {
  readonly id: string
  readonly webhookName: string
  readonly tableName: string
  readonly event: string
  readonly url: string
  readonly status: 'success' | 'failed'
  readonly httpStatus: number | undefined
  readonly attemptCount: number
  readonly error: string | undefined
  readonly responseBody: string | undefined
  readonly duration: number
  readonly requestedAt: string
  readonly completedAt: string
  readonly payload: unknown
  readonly requestHeaders: unknown
}

interface RawDeliveryRow {
  readonly id: number
  readonly webhook_name: string
  readonly table_name: string
  readonly event: string
  readonly url: string
  readonly status: string
  readonly http_status: number | null
  readonly attempt_count: number
  readonly error: string | null
  readonly response_body: string | null
  readonly duration_ms: number | null
  readonly requested_at: string
  readonly completed_at: string
  readonly payload: unknown
  readonly request_headers: unknown
}

const toApiStatus = (status: string): 'success' | 'failed' =>
  status === 'success' ? 'success' : 'failed'

const mapRow = (row: RawDeliveryRow): DeliveryLogEntry => ({
  id: String(row.id),
  webhookName: row.webhook_name,
  tableName: row.table_name,
  event: row.event,
  url: row.url,
  status: toApiStatus(row.status),
  httpStatus: row.http_status ?? undefined,
  attemptCount: row.attempt_count,
  error: row.error ?? undefined,
  responseBody: row.response_body ?? undefined,
  duration: row.duration_ms ?? 0,
  requestedAt: new Date(row.requested_at).toISOString(),
  completedAt: new Date(row.completed_at).toISOString(),
  payload: row.payload,
  requestHeaders: row.request_headers,
})

export const rowsOf = <T>(result: unknown): ReadonlyArray<T> => {
  if (Array.isArray(result)) return result as ReadonlyArray<T>
  const wrapped = (result as { rows?: ReadonlyArray<T> }).rows
  return wrapped ?? []
}

export interface ListDeliveriesOptions {
  readonly tableName: string
  readonly webhookName: string
  readonly limit: number
  readonly cursor: number | undefined
  readonly status: 'success' | 'failed' | undefined
}

export interface ListDeliveriesResult {
  readonly deliveries: ReadonlyArray<DeliveryLogEntry>
  readonly totalCount: number
  readonly nextCursor: string | undefined
}

export const listDeliveries = async (
  options: ListDeliveriesOptions
): Promise<ListDeliveriesResult> => {
  const { tableName, webhookName, limit, cursor, status } = options
  const cursorClause = cursor === undefined ? sql`` : sql` AND id < ${cursor}`
  const statusClause = status === undefined ? sql`` : sql` AND status = ${status}`

  const pageResult = await getDb().execute(sql`
    SELECT id, webhook_name, table_name, event, url, status, http_status,
           attempt_count, error, response_body, duration_ms,
           requested_at, completed_at, payload, request_headers
    FROM _webhook_deliveries
    WHERE table_name = ${tableName} AND webhook_name = ${webhookName}${cursorClause}${statusClause}
    ORDER BY id DESC
    LIMIT ${limit}
  `)
  const rows = rowsOf<RawDeliveryRow>(pageResult)
  const deliveries = rows.map(mapRow)

  const countResult = await getDb().execute(sql`
    SELECT COUNT(*) AS count
    FROM _webhook_deliveries
    WHERE table_name = ${tableName} AND webhook_name = ${webhookName}${statusClause}
  `)
  const countRow = rowsOf<{ count: number }>(countResult)[0]
  const totalCount = Number(countRow?.count ?? 0)

  const lastRow = rows[rows.length - 1]
  const nextCursor =
    rows.length === limit && lastRow !== undefined && totalCount > rows.length
      ? String(lastRow.id)
      : undefined

  return { deliveries, totalCount, nextCursor }
}

export const getDelivery = async (input: {
  readonly tableName: string
  readonly webhookName: string
  readonly deliveryId: number
}): Promise<DeliveryLogEntry | undefined> => {
  const { tableName, webhookName, deliveryId } = input
  const result = await getDb().execute(sql`
    SELECT id, webhook_name, table_name, event, url, status, http_status,
           attempt_count, error, response_body, duration_ms,
           requested_at, completed_at, payload, request_headers
    FROM _webhook_deliveries
    WHERE id = ${deliveryId}
      AND table_name = ${tableName}
      AND webhook_name = ${webhookName}
    LIMIT 1
  `)
  const row = rowsOf<RawDeliveryRow>(result)[0]
  return row === undefined ? undefined : mapRow(row)
}
