/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { MAX_PAGE_SIZE } from '@/domain/kernel/sql/page-window'
import { createRecordsClient, createViewRecordsClient } from '@/presentation/api/client'
import type { TableRecord } from './types'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

/**
 * The records API as the list-family islands read it: the client singletons,
 * the filter and sort parameter builders, one page fetch flattened to
 * top-level fields, and the retry rules a refused or rate-limited read follows.
 */

// ---------------------------------------------------------------------------
// API client (singleton)
// ---------------------------------------------------------------------------

const apiOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const apiClient = createRecordsClient(apiOrigin)
const viewsClient = createViewRecordsClient(apiOrigin)

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

/**
 * Domain filters as records-API CONDITIONS, before they are wrapped.
 *
 * Exported beside {@link buildFilterParam} because one consumer needs the
 * leaves rather than the finished param: the record picker MERGES the author's
 * conditions with its own search condition into a single `and` group, and
 * re-deriving the operator translation on its side would be a second copy of
 * this table — the exact drift the shared picker modules exist to prevent.
 */
export function toApiConditions(
  filters: readonly DataFilter[] | undefined
): readonly Readonly<Record<string, unknown>>[] {
  if (!filters || filters.length === 0) return []
  return filters.map((f) => ({
    field: f.field,
    operator: DOMAIN_TO_API_OPERATOR[f.operator] ?? f.operator,
    value: f.value,
  }))
}

/** Translate domain sorts to the records-API `field:direction,…` param. */
export function buildSortParam(sort: readonly DataSort[] | undefined): string | undefined {
  if (!sort || sort.length === 0) return undefined
  return sort.map((s) => `${s.field}:${s.direction}`).join(',')
}

/**
 * Request size when a binding declares no `limit` of its own — and the largest
 * page the records API will serve.
 *
 * It IS the server's ceiling, read from the dependency-free kernel constant
 * rather than repeated, so it cannot drift from the server, and the kernel module pulls in nothing a client chunk would pay for.
 */
export const RECORDS_PAGE_SIZE = MAX_PAGE_SIZE

// ---------------------------------------------------------------------------
// DB-table fetch
// ---------------------------------------------------------------------------

/**
 * Everything one page request needs. An object rather than five positional
 * arguments: `sortParam` and `filterParam` are both optional strings and sit
 * next to each other, so a transposed pair would typecheck and quietly filter
 * by the sort expression.
 */
interface TablePageRequest {
  readonly table: string
  /** One of the table's declared views: the page is read through its route. */
  readonly view: string | undefined
  readonly sortParam: string | undefined
  readonly filterParam: string | undefined
  /** Params a shared-filter publisher contributes beside the filter. */
  readonly extraParams: Readonly<Record<string, string>>
  /** Zero-based; the records API counts pages from one. */
  readonly pageIndex: number
  readonly pageSize: number
}

/**
 * The statuses with which the records API REFUSES a read: not signed in (401),
 * not allowed (403), or — the anti-enumeration answer for a table the reader
 * may not know about — not found (404).
 */
const REFUSED_READ_STATUSES: ReadonlySet<number> = new Set([401, 403, 404])

/** The HTTP status a failed read carried on its `cause`, when it got a response. */
const readStatus = (error: unknown): unknown =>
  error instanceof Error
    ? (error.cause as { readonly status?: unknown } | undefined)?.status
    : undefined

/**
 * Whether a records query failed because the reader may not read the table,
 * as opposed to a fault. A refusal is an ANSWER: asking again returns it
 * again, and a surface shown to a visitor who may not read a table has nothing
 * of that table to show — which is what an empty read already says, without
 * telling the visitor the table exists.
 */
export function isRefusedRead(error: unknown): boolean {
  const status = readStatus(error)
  return typeof status === 'number' && REFUSED_READ_STATUSES.has(status)
}

/**
 * The island QueryClient's two retries, withheld from a read refused with 429:
 * it is not worth asking again before its `Retry-After`, and asking at once
 * only spends the budget and holds the view empty for the length of the
 * backoff. The view offers its own Retry instead (`RateLimitedNotice`). This
 * module keeps its own copy of the rule so the many islands that read through
 * it do not each pay for the notice.
 */
export const retryUnlessRateLimited = (failureCount: number, error: Error): boolean =>
  readStatus(error) !== 429 && failureCount < 2

/** {@link retryUnlessRateLimited}, also withheld from a refused read, which is answered, not failed. */
export const retryUnlessAnswered = (failureCount: number, error: Error): boolean =>
  !isRefusedRead(error) && retryUnlessRateLimited(failureCount, error)

/** One page of DB-table records, flattened; a `FetchResult` without the system-only keys. */
export interface TablePage {
  readonly records: readonly TableRecord[]
  readonly total: number
}

/** Fetch one page of DB-table records and flatten `record.fields` to the top level. */
export async function fetchTableRecords({
  table,
  view,
  sortParam,
  filterParam,
  extraParams,
  pageIndex,
  pageSize,
}: TablePageRequest): Promise<TablePage> {
  const query = {
    ...extraParams,
    page: String(pageIndex + 1),
    limit: String(pageSize),
    ...(sortParam && { sort: sortParam }),
    ...(filterParam && { filter: filterParam }),
  }

  const res =
    view === undefined
      ? await apiClient.api.tables[':tableId'].records.$get({ param: { tableId: table }, query })
      : await viewsClient.api.tables[':tableId'].views[':viewId'].records.$get({
          param: { tableId: table, viewId: view },
          query,
        })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to fetch records: ${String(res.status)} ${body}`, {
      cause: { status: res.status },
    })
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
