/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { getDb } from '@/infrastructure/database/drizzle/db-bun'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'

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

/**
 * The stored header set as an object. The column holds JSON text on SQLite and
 * comes back from PostgreSQL as that text too, so it is parsed here: the read
 * routes redact a header set by name, which an unparsed string slips past.
 * Text that does not parse is returned as it came.
 */
const headersOf = (stored: unknown): unknown => {
  if (typeof stored !== 'string') return stored
  try {
    return JSON.parse(stored) as unknown
  } catch {
    return stored
  }
}

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
  requestHeaders: headersOf(row.request_headers),
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

  // `executeRaw` runs `.execute()` on PostgreSQL and `.all()` on SQLite, which
  // has no `.execute()`: the log reads on both engines, as `logDelivery` writes.
  const pageResult = await executeRaw(
    getDb(),
    sql`
    SELECT id, webhook_name, table_name, event, url, status, http_status,
           attempt_count, error, response_body, duration_ms,
           requested_at, completed_at, payload, request_headers
    FROM _webhook_deliveries
    WHERE table_name = ${tableName} AND webhook_name = ${webhookName}${cursorClause}${statusClause}
    ORDER BY id DESC
    LIMIT ${limit}
  `
  )
  const rows = rowsOf<RawDeliveryRow>(pageResult)
  const deliveries = rows.map(mapRow)

  // COUNT(*) without the PG-only `::int` cast — both dialects return an
  // integer-typed value from COUNT(*) natively; the cast was a defensive
  // type-coercion that breaks SQLite's parser (`near "::"`).
  const countResult = await executeRaw(
    getDb(),
    sql`
    SELECT COUNT(*) AS count
    FROM _webhook_deliveries
    WHERE table_name = ${tableName} AND webhook_name = ${webhookName}${statusClause}
  `
  )
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
  const result = await executeRaw(
    getDb(),
    sql`
    SELECT id, webhook_name, table_name, event, url, status, http_status,
           attempt_count, error, response_body, duration_ms,
           requested_at, completed_at, payload, request_headers
    FROM _webhook_deliveries
    WHERE id = ${deliveryId}
      AND table_name = ${tableName}
      AND webhook_name = ${webhookName}
    LIMIT 1
  `
  )
  const row = rowsOf<RawDeliveryRow>(result)[0]
  return row === undefined ? undefined : mapRow(row)
}

/**
 * The outbox delivery id a delivery-log row settled, so a manual retry re-sends
 * under the delivery's own `X-Sovrium-Delivery-Id`. `undefined` for a test send
 * and for a row written before the outbox existed.
 */
export const getDeliveryOutboxId = async (logId: number): Promise<string | undefined> => {
  const rows = await executeRaw(
    getDb(),
    sql`SELECT delivery_id FROM _webhook_deliveries WHERE id = ${logId} LIMIT 1`
  )
  const value = rows[0]?.['delivery_id']
  return typeof value === 'string' && value !== '' ? value : undefined
}
