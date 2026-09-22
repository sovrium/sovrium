/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRealtimeSubscription } from '../../../hooks/use-realtime-subscription'
import { useGridRefresh, useSortRefusal } from '../../../hooks/use-sort-refusal'
import { useGridRefreshChannels } from '../use-refresh-channels'
import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'
import type { RecordsQuery } from './use-records-query'

export type RefreshWiring = ReturnType<typeof useRefreshWiring>

/**
 * Everything that decides when the grid re-reads, and what happens when a read
 * is refused.
 *
 * A sort is adopted optimistically: the header click writes state, and that
 * state feeds the request. That makes the adoption REVERSIBLE — a read that
 * fails puts the previous sort back, so the last good page returns from cache
 * and `aria-sort` stops claiming an ordering the server refused.
 */
export function useRefreshWiring(
  ctx: SetupContext,
  layout: EffectiveLayout,
  records: RecordsQuery
) {
  const { queryKey } = records.query

  const sortRefusal = useSortRefusal(records.query.isError, records.query.error, layout.tableState)

  const handleRefresh = useGridRefresh(ctx.queryClient, queryKey, sortRefusal.clearReadError)

  // The two out-of-band "re-read now" channels — a sibling crud-form's
  // `sovrium:crud-success` (matched by table name) and a sibling fetch action's
  // `sovrium:refetch` (matched by component id). See `useGridRefreshChannels`
  // for why the two key on different things.
  useGridRefreshChannels({
    table: ctx.params.dataSource.table,
    sourceId: ctx.params.searchSourceId,
    onRefresh: handleRefresh,
  })

  // Realtime mode: subscribe to live change events for the bound table. Each
  // `change` event invalidates the query, triggering a re-fetch that re-applies
  // the server-side `dataSource.filter`/`sort` — no client-side predicate.
  const connectionStatus = useRealtimeSubscription({
    // Realtime is a DB-table-only feature; a system source never enables it.
    enabled: !ctx.isSystemSource && ctx.params.dataSource.refreshMode === 'realtime',
    table: ctx.tableKey,
    onChange: handleRefresh,
  })

  return { sortRefusal, handleRefresh, connectionStatus, queryKey }
}
