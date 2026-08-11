/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

/**
 * Shared system read-endpoint fetch (CAP-1 runtime root).
 *
 * The canonical "rows-envelope" read path for every rows-oriented data-bound
 * component (data-table + the list family: kanban / calendar / gallery / list /
 * data-timeline). It was first proven inline in `use-data-table-query.ts`; this
 * module extracts it verbatim so each list component speaks the SAME envelope
 * contract instead of re-implementing the fetch / normalization per island.
 *
 * Envelope contract (mirrors `SystemSourceSchema`):
 *  - fetch `system.endpoint` (merging `system.query` static params + any dynamic
 *    external-filter params + the read-side page / sort / search params) instead
 *    of `/api/tables/:t/records`;
 *  - normalize the `{ [rowsKey]: [...rows] }` response to `{ records, total }`:
 *    rows are read at `rowsKey` (default `'items'`), each row's id is mapped onto
 *    the canonical `id` key from `idKey` (default `'id'`), and `total` comes from
 *    `totalKey` when numeric (else rows length);
 *  - a system source is a READ source — write surfaces never accept it.
 *
 * Specialized sources (`chart` series-shaped / `kpi` scalar-shaped) keep their
 * own fetch helpers and deliberately do NOT use this module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
}

/**
 * Minimal pagination shape the system fetch needs (`pageIndex` is 0-based; the
 * endpoint receives the 1-based `page`). Decoupled from TanStack's
 * `PaginationState` so the list family (which has no TanStack table state) can
 * reuse the fetch with a plain `{ pageIndex: 0 }`.
 */
export interface SystemPagination {
  readonly pageIndex: number
  readonly pageSize?: number
}

/** The read-side params used to build a system-endpoint request. */
export interface SystemQueryInput {
  readonly system: SystemSource
  /** Dynamic params from an external filter bar (merged over `system.query`). */
  readonly systemQuery?: Record<string, string>
  readonly pagination: SystemPagination
  readonly sortParam?: string
  readonly globalFilter?: string
}

export interface SystemFetchQuery extends SystemQueryInput {
  /**
   * The component id (`searchSourceId`). A NAMED grid bound to the
   * automation-runs endpoint opts into the localized run-status label mapping
   * below; anonymous sources (no `id`) keep their raw endpoint values so a
   * generic system source is never transformed.
   */
  readonly sourceId?: string
}

// ---------------------------------------------------------------------------
// Run-status localization (gated — inert without a NAMED runs grid)
// ---------------------------------------------------------------------------

/**
 * Localized run-status labels for the automation-runs read endpoint.
 *
 * The runs API surfaces the engine's terminal status verbatim
 * (`completed` / `failed` / `completed-with-errors`). When a NAMED directory
 * binds to that endpoint, the `status` field is mapped to its operator-facing
 * label here so the directory renders a readable status pill without a
 * server change or a per-column value-map in config. Gated on a NAMED source +
 * the runs endpoint so a generic / anonymous system source keeps its raw values
 * untouched.
 */
const RUN_STATUS_LABELS: Record<string, string> = {
  completed: 'Success',
  failed: 'Failed',
  'completed-with-errors': 'Partial',
}

function localizeRunStatusRows(
  endpoint: string,
  sourceId: string | undefined,
  rows: readonly TableRecord[]
): readonly TableRecord[] {
  if (!sourceId || !endpoint.includes('/automations/runs')) return rows
  return rows.map((row) => {
    const raw = row['status']
    if (typeof raw !== 'string') return row
    const label = RUN_STATUS_LABELS[raw]
    return label ? { ...row, status: label } : row
  })
}

// ---------------------------------------------------------------------------
// Query string + envelope normalization
// ---------------------------------------------------------------------------

/**
 * Build the merged query string for a system-endpoint request: static
 * `system.query` params first, then dynamic external-filter params (empty value
 * clears a param), then the read-side page / sort / search params.
 */
export function buildSystemQueryString({
  system,
  systemQuery,
  pagination,
  sortParam,
  globalFilter,
}: SystemQueryInput): string {
  const params = new URLSearchParams()
  // Static query params merged into every request (e.g. { status: 'failed' }).
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  // Dynamic params from an external filter bar override the static ones. Empty
  // values clear the param (e.g. the automation filter back to "Toutes").
  Object.entries(systemQuery ?? {}).forEach(([key, value]) => {
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- URLSearchParams.delete, not a Drizzle query builder
    if (value === '') params.delete(key)
    else params.set(key, value)
  })
  // Read-side params (endpoint-side / forwarded): page, sort, search.
  params.set('page', String(pagination.pageIndex + 1))
  if (pagination.pageSize) params.set('limit', String(pagination.pageSize))
  if (sortParam) params.set('sort', sortParam)
  if (globalFilter) params.set('q', globalFilter)
  return params.toString()
}

/**
 * Parse a system-endpoint response envelope into `{ records, total }`: rows are
 * read at `rowsKey`, each row's id normalized onto the canonical `id` key,
 * run-status localized for a named runs grid, and `total` taken from `totalKey`
 * when numeric (else rows length).
 */
export function parseSystemEnvelope(
  system: SystemSource,
  sourceId: string | undefined,
  json: Record<string, unknown>
): FetchResult {
  const rowsKey = system.rowsKey ?? 'items'
  const idKey = system.idKey ?? 'id'
  const rawRows = Array.isArray(json[rowsKey]) ? (json[rowsKey] as readonly TableRecord[]) : []
  // Normalize each row's id onto the canonical `id` key so row identity +
  // row-click actions resolve uniformly.
  const idMapped: readonly TableRecord[] = rawRows.map((row) =>
    idKey === 'id' ? row : { ...row, id: row[idKey] }
  )
  const records = localizeRunStatusRows(system.endpoint, sourceId, idMapped)
  const totalRaw = system.totalKey ? json[system.totalKey] : undefined
  const total = typeof totalRaw === 'number' ? totalRaw : records.length
  return { records, total }
}

/**
 * Fetch one page of rows from a system read endpoint and normalize the
 * `{ [rowsKey]: [...] }` envelope to the consumer's `{ records, total }` shape.
 * Sends the session cookie so admin read endpoints authorize the request.
 */
export async function fetchSystemEndpoint({
  system,
  systemQuery,
  sourceId,
  pagination,
  sortParam,
  globalFilter,
}: SystemFetchQuery): Promise<FetchResult> {
  const suffix = buildSystemQueryString({
    system,
    systemQuery,
    pagination,
    sortParam,
    globalFilter,
  })
  const url = `${system.endpoint}${suffix ? `?${suffix}` : ''}`
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    const body = await res.text()
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch system rows: ${res.status} ${body}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemEnvelope(system, sourceId, json)
}

// ---------------------------------------------------------------------------
// Single-record DETAIL fetch (CAP-2)
// ---------------------------------------------------------------------------

/**
 * The single-record counterpart to the rows-envelope fetch above. Where the
 * rows fetch extracts an ARRAY at `rowsKey`, the detail fetch injects a bound
 * record id into the endpoint's `:param` placeholder and extracts exactly ONE
 * record at `recordKey` (or the whole body when `recordKey` is omitted). It
 * reuses the SAME credentialed `fetch` discipline so admin detail endpoints
 * authorize the request. Mirrors `SystemDetailSourceSchema`.
 */

/**
 * Build the detail-endpoint URL: substitute `id` into the endpoint's `:param`
 * placeholder (default `:id`) and append any static `system.query` params.
 */
export function buildDetailEndpointUrl(system: SystemDetailSource, id: string): string {
  const placeholder = `:${system.param ?? 'id'}`
  const path = system.endpoint.includes(placeholder)
    ? system.endpoint.replace(placeholder, encodeURIComponent(id))
    : system.endpoint
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${path}${suffix ? `?${suffix}` : ''}`
}

/**
 * Parse a detail-endpoint response into a single record: read it at `recordKey`
 * (fallback the whole body), then normalize its id onto the canonical `id` key
 * from `idKey` (default `'id'`) so downstream field lookups resolve uniformly.
 */
export function parseSystemDetailEnvelope(
  system: SystemDetailSource,
  json: Record<string, unknown>
): TableRecord {
  const raw = system.recordKey !== undefined ? json[system.recordKey] : json
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as TableRecord
  const idKey = system.idKey ?? 'id'
  return idKey === 'id' ? record : { ...record, id: record[idKey] }
}

/**
 * Fetch ONE record from a system detail endpoint (the bound id injected into the
 * `:param` slot) and normalize it to a single record. Sends the session cookie
 * so admin detail endpoints authorize the request.
 */
export async function fetchSystemDetailEndpoint(
  system: SystemDetailSource,
  id: string
): Promise<TableRecord> {
  const url = buildDetailEndpointUrl(system, id)
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    const body = await res.text()
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch system record: ${res.status} ${body}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemDetailEnvelope(system, json)
}
