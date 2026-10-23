/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import type { ViewLayout } from './view-layout'

/** One view of the table, as `GET /api/tables/:table/views` lists it. */
export interface ListedView extends ViewLayout {
  readonly id: string | number
  readonly name: string
  readonly isDefault?: boolean
  /** The view's filter node, as the reader may see it. */
  readonly filters?: unknown
}

/** The table's views the reader may open: the default one first, then in declaration order. */
async function fetchViews(table: string): Promise<readonly ListedView[]> {
  const response = await fetch(`/api/tables/${encodeURIComponent(table)}/views`, {
    credentials: 'same-origin',
  })
  if (!response.ok) return []
  const listed = (await response.json()) as unknown
  if (!Array.isArray(listed)) return []
  const views = listed as readonly ListedView[]
  return [
    ...views.filter((view) => view.isDefault === true),
    ...views.filter((view) => view.isDefault !== true),
  ]
}

/**
 * The table's views, read once per visit and shared by every reader of them on
 * the page: the switcher draws them, and a grid the server could not tell its
 * default view waits on them before its first read (`useAwaitingDefaultView`).
 * Not read at all when `enabled` is false.
 */
export function useTableViews(table: string, enabled = true) {
  return useQuery({
    queryKey: ['data-table-views', table],
    queryFn: () => fetchViews(table),
    staleTime: Infinity,
    enabled,
  })
}

/**
 * Whether a grid that opens on its table's DEFAULT view must still hold its
 * first read: it draws a switcher, reads through no configured view, the reader
 * picked none, and either the view list has not answered yet or it names a
 * default the switcher is about to select. Reading the table-wide page in that
 * window would be a read the grid immediately throws away for the view's.
 */
export function useAwaitingDefaultView(params: {
  readonly table: string
  readonly hasSwitcher: boolean
  readonly opensOnDefault: boolean
  /** The default the server already resolved (`null`: none): nothing to wait for. */
  readonly listedDefault: string | null | undefined
}): boolean {
  const waits =
    params.hasSwitcher &&
    params.table !== '' &&
    params.opensOnDefault &&
    params.listedDefault === undefined
  const views = useTableViews(params.table, waits)
  if (!waits) return false
  if (views.isPending) return true
  return (views.data ?? []).some((view) => view.isDefault === true)
}
