/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import { subscribe as subscribeIslandEvent } from '../../runtime/event-bus'

interface RefreshChannelsParams {
  /**
   * Bound DB table name, or undefined for a system source. Gates the
   * crud-success channel: a system-source grid observes its rows through an
   * endpoint and mutates nothing, so there is no write to hear about.
   */
  readonly table: string | undefined
  /** Component id (`props.id`) a sibling action names when it asks for a re-read. */
  readonly sourceId: string | undefined
  readonly onRefresh: () => void
}

/**
 * The two out-of-band channels that ask this grid to re-read, keyed on
 * different things on purpose.
 *
 * **`sovrium:crud-success`** (PG-04 / [internal ref]) is fired by a
 * sibling crud-form — a quick-edit drawer, say — after a successful mutation,
 * and is matched by TABLE NAME so that unrelated grids on the same page do not
 * refetch. The match is case-insensitive, forgiving casing drift between the
 * schema and the runtime payload.
 *
 * **`sovrium:refetch`** ([internal ref]-…-ACTION-EFFECTS) is fired by a
 * sibling fetch action's `onSuccess.refetch`, which names this grid by its
 * COMPONENT id. Keying on the id rather than a table is what lets it compose
 * with a system-source binding too, where there is no table to name — the
 * refresh invalidates whichever query backs the grid.
 */
export function useGridRefreshChannels({
  table,
  sourceId,
  onRefresh,
}: RefreshChannelsParams): void {
  useEffect(() => {
    if (!table) return undefined
    const targetTable = table.toLowerCase()
    return subscribeIslandEvent('sovrium:crud-success', (detail) => {
      if (detail.table.toLowerCase() !== targetTable) return
      onRefresh()
    })
  }, [table, onRefresh])

  useEffect(() => {
    if (!sourceId) return undefined
    return subscribeIslandEvent('sovrium:refetch', (detail) => {
      if (detail.id !== sourceId) return
      onRefresh()
    })
  }, [sourceId, onRefresh])
}
