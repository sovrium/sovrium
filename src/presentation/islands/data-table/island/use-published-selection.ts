/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { useLazySharedFilterPublisher } from '../../hooks/use-lazy-shared-filter-publisher'
import type { DataTableInstance } from './table-features'
import type { SharedFilterPublisherConfig } from '../../hooks/use-shared-filter-publisher'

/**
 * Publish the records a reader selects in the grid, on the channel its
 * `publishes` names: one id for a single selection, every id for several — an
 * `in` condition reads them as any of them. Clearing the selection withdraws
 * the contribution.
 *
 * Nothing is published until the selection first changes, so a page opening
 * with nothing selected does not make every subscriber read twice.
 */
export function usePublishedSelection(
  publishes: SharedFilterPublisherConfig | undefined,
  table: DataTableInstance,
  rowSelection: Readonly<Record<string, boolean>>
): void {
  const publish = useLazySharedFilterPublisher(publishes)
  const last = useRef('')
  useEffect(() => {
    if (publishes === undefined) return
    const ids = table
      .getSelectedRowModel()
      .rows.map((row) => String(row.original['id'] ?? ''))
      .filter((id) => id !== '')
    const signature = ids.join(',')
    if (signature === last.current) return
    last.current = signature
    publish(ids.length === 1 ? ids[0] : ids)
  }, [publishes, table, rowSelection, publish])
}
