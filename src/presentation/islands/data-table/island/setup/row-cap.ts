/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTablePagination } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The rows per page a grid draws when its author declared none. */
export const DEFAULT_GRID_PAGE_SIZE = 25

/**
 * The page size the grid asks for: the declared one (25 by default), never
 * more than the binding's `limit` — a "latest five" grid asks for five rows,
 * not a page of 25 it would then have to hide.
 */
export function cappedPageSize(limit: number | undefined, pageSize: number | undefined): number {
  const size = pageSize ?? DEFAULT_GRID_PAGE_SIZE
  return limit === undefined ? size : Math.min(limit, size)
}

/** The total the pager counts: the stored rows, never more than the cap. */
export function cappedTotal(total: number, limit: number | undefined): number {
  return limit === undefined ? total : Math.min(total, limit)
}

/**
 * The rows of a page that fall under the cap. `offset` is how many capped rows
 * precede the first one held — the page index times the page size on a
 * numbered grid, 0 on a feed that accumulates every page it has loaded. The
 * server pages in whole page sizes, so the last page under a cap of 12 paged
 * by 5 comes back as rows 11–15 and is cut to 11–12 here.
 */
export function cappedRows<T>(
  rows: readonly T[],
  limit: number | undefined,
  offset: number
): readonly T[] {
  if (limit === undefined) return rows
  const room = Math.max(0, limit - offset)
  return rows.length > room ? rows.slice(0, room) : rows
}

/**
 * The pagination a grid numbers its pages by. A grid declaring no `pagination`
 * still pages: the bottom bar is part of every numbered grid. A page size
 * written on the binding (`dataSource.pagination.pageSize`) is a page size,
 * and the grid's own `pagination.pageSize` wins when both are written. A grid
 * fed from a system endpoint keeps no pagination of its own unless it declares
 * one, so it asks for the endpoint's first page.
 */
export function gridPagination(
  pagination: DataTablePagination | undefined,
  dataSource: {
    readonly system?: unknown
    readonly pagination?: { readonly pageSize?: number }
  }
): DataTablePagination | undefined {
  const bindingSize = dataSource.pagination?.pageSize
  const sized = bindingSize === undefined ? {} : { pageSize: bindingSize }
  if (pagination !== undefined) return { ...sized, ...pagination }
  return dataSource.system === undefined ? sized : undefined
}

/**
 * The pagination the grid draws a pager from: none when the cap fits on one
 * page, since there is nothing to page through and a pager would only count
 * past what the author allowed.
 */
export function pagerPagination(
  pagination: DataTablePagination | undefined,
  limit: number | undefined
): DataTablePagination | undefined {
  if (pagination === undefined || limit === undefined) return pagination
  return limit <= (pagination.pageSize ?? DEFAULT_GRID_PAGE_SIZE) ? undefined : pagination
}
