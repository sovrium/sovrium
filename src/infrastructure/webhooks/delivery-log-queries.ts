/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { getDb } from '@/infrastructure/database/drizzle/db-bun'

/**
 * A single webhook delivery-log row, shaped for the API response.
 *
 * `status` is `success` / `failed` — the storage layer records exactly these
 * two values (see `table-webhook-dispatch.ts` `logDelivery`), so the wire
 * contract and the stored value coincide.
 */
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

/** Raw row shape returned by the `_webhook_deliveries` SELECT. */
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

/** Normalise a stored status to the API `success`/`failed` form. */
const toApiStatus = (status: string): 'success' | 'failed' =>
  status === 'success' ? 'success' : 'failed'

/** Map a raw `_webhook_deliveries` row to a {@link DeliveryLogEntry}. */
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

/**
 * Normalise a Drizzle `bun-sql` `execute()` result to a typed rows array.
 *
 * The `bun-sql` driver returns the result rows directly as an array; the
 * defensive `.rows` fallback covers any driver that wraps them.
 *
 * @public
 */
export const rowsOf = <T>(result: unknown): ReadonlyArray<T> => {
  if (Array.isArray(result)) return result as ReadonlyArray<T>
  const wrapped = (result as { rows?: ReadonlyArray<T> }).rows
  return wrapped ?? []
}

/** Options for {@link listDeliveries}. */
export interface ListDeliveriesOptions {
  readonly tableName: string
  readonly webhookName: string
  readonly limit: number
  /** Cursor: only rows with `id` strictly less than this value are returned. */
  readonly cursor: number | undefined
  /** Optional `success`/`failed` status filter. */
  readonly status: 'success' | 'failed' | undefined
}

/** Result of {@link listDeliveries} — a page plus paging metadata. */
export interface ListDeliveriesResult {
  readonly deliveries: ReadonlyArray<DeliveryLogEntry>
  readonly totalCount: number
  readonly nextCursor: string | undefined
}

/**
 * List delivery-log rows for a single table webhook, newest first.
 *
 * Cursor pagination is descending by `id`: a `cursor` of `N` returns rows with
 * `id < N`. `nextCursor` is the `id` of the last row in the page when a
 * further page may exist.
 *
 * @public
 */
export const listDeliveries = async (
  options: ListDeliveriesOptions
): Promise<ListDeliveriesResult> => {
  const { tableName, webhookName, limit, cursor, status } = options
  // The stored status column holds `success`/`failed` verbatim — the API
  // filter value and the storage value coincide, so no translation is needed.
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

  // COUNT(*) without the PG-only `::int` cast — both dialects return an
  // integer-typed value from COUNT(*) natively; the cast was a defensive
  // type-coercion that breaks SQLite's parser (`near "::"`).
  const countResult = await getDb().execute(sql`
    SELECT COUNT(*) AS count
    FROM _webhook_deliveries
    WHERE table_name = ${tableName} AND webhook_name = ${webhookName}${statusClause}
  `)
  const countRow = rowsOf<{ count: number }>(countResult)[0]
  const totalCount = toFiniteCount(countRow?.count)

  // A further page exists only when this page filled the limit AND more rows
  // remain beyond the last id returned.
  const lastRow = rows[rows.length - 1]
  const nextCursor =
    rows.length === limit && lastRow !== undefined && totalCount > rows.length
      ? String(lastRow.id)
      : undefined

  return { deliveries, totalCount, nextCursor }
}

/**
 * Fetch a single delivery-log row by id, scoped to a table webhook.
 *
 * Returns `undefined` when no row matches (the caller maps this to 404).
 *
 * @public
 */
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
