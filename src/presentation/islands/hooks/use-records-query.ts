/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createRecordsClient } from '@/presentation/api/client'
import { fetchSystemEndpoint, fetchSystemDetailEndpoint } from './use-system-source-fetch'
import type { FetchResult } from './use-system-source-fetch'
import type { TableRecord } from '../shared/types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

/**
 * Shared single-page records query for the list-family data components
 * (gallery / kanban / calendar / timeline / list).
 *
 * These components all render their rows up-front (a card grid, kanban columns,
 * calendar cells, a time axis, a `<ul>`) rather than paginating client-side, so
 * they share ONE fetch shape: request a large single page and normalize it to
 * `{ records, total }`. Each component used to inline a byte-identical copy of
 * the param-builders + DB-table fetch + the `useQuery` body, differing only in
 * its query-key prefix; this module is the single source of truth they now all
 * consume.
 *
 * Two bindings are supported (mutually exclusive):
 *  - `dataSource.table` → the DB-table records API (`/api/tables/:t/records`),
 *    flattening each record's `fields` onto the top level;
 *  - `dataSource.system` → a named system READ endpoint via the shared
 *    `fetchSystemEndpoint` (the CAP-1 runtime root) — read-only, no writes.
 *
 * Each component keeps its OWN row→view mapping local (card / event / column /
 * item builders); this hook only owns the fetch + envelope normalization.
 */

// Re-exported so consumers can type the query result without reaching into the
// system-source fetch module (the canonical home of `FetchResult`).
export type { FetchResult }

// ---------------------------------------------------------------------------
// API client (singleton)
// ---------------------------------------------------------------------------

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

// ---------------------------------------------------------------------------
// Filter / sort param translation
// ---------------------------------------------------------------------------

const DOMAIN_TO_API_OPERATOR: Record<string, string> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  contains: 'contains',
}

/** Translate domain filters to the records-API `{ and: [...] }` JSON param. */
export function buildFilterParam(filters: readonly DataFilter[] | undefined): string | undefined {
  if (!filters || filters.length === 0) return undefined
  const conditions = filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
  return JSON.stringify({ and: conditions })
}

/** Translate domain sorts to the records-API `field:direction,…` param. */
export function buildSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

// ---------------------------------------------------------------------------
// Data source shape + page size
// ---------------------------------------------------------------------------

/**
 * The data-source shape shared by the list-family components: a DB-table OR a
 * system read-endpoint binding, with optional schema-driven filter / sort.
 * `view` is carried for parity with richer components but is not used by the
 * single-page fetch.
 */
export interface RecordsDataSource {
  /** DB-table binding — ABSENT for a system-source binding. */
  readonly table?: string
  /**
   * System read-endpoint binding (CAP-1). When present, rows come from
   * `system.endpoint` (+ `system.query`) via the shared system-source fetch
   * instead of the DB-table records API. Mutually exclusive with `table`.
   */
  readonly system?: SystemSource
  readonly view?: string
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
}

/** Single-page request size — list-family components render all rows up-front. */
export const RECORDS_PAGE_SIZE = 100

// ---------------------------------------------------------------------------
// DB-table fetch
// ---------------------------------------------------------------------------

/** Fetch one page of DB-table records and flatten `record.fields` to the top level. */
async function fetchTableRecords(
  table: string,
  sortParam: string | undefined,
  filterParam: string | undefined
): Promise<FetchResult> {
  const query = {
    page: '1',
    limit: String(RECORDS_PAGE_SIZE),
    ...(sortParam && { sort: sortParam }),
    ...(filterParam && { filter: filterParam }),
  }

  const res = await apiClient.api.tables[':tableId'].records.$get({
    param: { tableId: table },
    query,
  })

  if (!res.ok) {
    const body = await res.text()
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch records: ${String(res.status)} ${body}`)
  }

  const json = (await res.json()) as {
    records?: readonly (TableRecord & { fields?: TableRecord })[]
    total?: number
    pagination?: { total?: number }
  }

  // Flatten: merge record.fields into top-level.
  const rawRecords = json.records ?? []
  const flatRecords: readonly TableRecord[] = rawRecords.map((r) => {
    const { fields, ...rest } = r
    return { ...rest, ...(fields ?? {}) }
  })

  return {
    records: flatRecords,
    total: json.total ?? json.pagination?.total ?? rawRecords.length,
  }
}

// ---------------------------------------------------------------------------
// Records query hook
// ---------------------------------------------------------------------------

/**
 * Fetch one page of records for a list-family component.
 *
 * `keyPrefix` namespaces the TanStack query key per component (e.g. `'gallery'`,
 * `'kanban'`) so two components on the same endpoint never share a cache entry.
 * With a `dataSource.system` binding the rows come from the named read endpoint;
 * otherwise from the DB-table records API. The query is disabled until a binding
 * is present.
 */
export function useRecordsQuery(
  keyPrefix: string,
  dataSource: RecordsDataSource | undefined
): UseQueryResult<FetchResult> {
  const system = dataSource?.system
  const table = dataSource?.table
  const filterParam = buildFilterParam(dataSource?.filter)
  const sortParam = buildSortParam(dataSource?.sort)

  // System-source binding: the query key is endpoint-shaped (with the static
  // query) so two components on the same endpoint with different `system.query`
  // never share a cache entry.
  const queryKey = system
    ? [`${keyPrefix}-system-rows`, system.endpoint, system.query, sortParam]
    : [`${keyPrefix}-records`, table, filterParam, sortParam]

  return useQuery({
    queryKey,
    enabled: Boolean(system) || Boolean(table),
    queryFn: (): Promise<FetchResult> => {
      // System source: fetch the read endpoint and normalize its rows envelope.
      if (system) {
        return fetchSystemEndpoint({
          system,
          pagination: { pageIndex: 0, pageSize: RECORDS_PAGE_SIZE },
          sortParam,
        })
      }
      if (!table) return Promise.resolve({ records: [], total: 0 })
      return fetchTableRecords(table, sortParam, filterParam)
    },
  })
}

// ---------------------------------------------------------------------------
// Single-record (detail) query — CAP-2
// ---------------------------------------------------------------------------

/**
 * The single-record counterpart to `RecordsDataSource`: a record-bound
 * component's `dataSource` shape. `system` (a detail-endpoint binding) is the
 * client-fetching variant this hook serves; the DB-table single-record path
 * (`{ table, mode: single, param }`) is resolved SERVER-side and is left
 * intact — this hook never touches it.
 */
export interface RecordDataSource {
  /** DB-table single-record binding — resolved server-side, NOT fetched here. */
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  /** System detail-endpoint binding (CAP-2) — the client-fetching variant. */
  readonly system?: SystemDetailSource
}

/**
 * Fetch ONE record for a record-bound component from a system DETAIL endpoint.
 *
 * The sibling of `useRecordsQuery` (rows) for SINGLE records: with a
 * `dataSource.system` binding the record comes from a named detail endpoint —
 * `id` injected into the `:param` slot — via the shared `fetchSystemDetailEndpoint`
 * (reusing the same credentialed fetch the rows path uses). The query is disabled
 * until BOTH a system binding and a record id are present. `keyPrefix` namespaces
 * the cache key per consuming island so two components on the same endpoint never
 * collide. The DB-table single-record path stays server-resolved and is untouched.
 */
export function useRecordQuery(
  keyPrefix: string,
  dataSource: RecordDataSource | undefined,
  id: string | undefined
): UseQueryResult<TableRecord | undefined> {
  const system = dataSource?.system
  return useQuery({
    queryKey: [`${keyPrefix}-system-detail`, system?.endpoint, id, system?.query],
    enabled: Boolean(system) && Boolean(id),
    queryFn: (): Promise<TableRecord | undefined> =>
      system && id ? fetchSystemDetailEndpoint(system, id) : Promise.resolve(undefined),
  })
}
