/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDataTableState } from '../../../hooks/use-data-table-state'
import { cappedPageSize } from './row-cap'
import type { SetupContext } from './setup-params'

export type EffectiveLayout = ReturnType<typeof useEffectiveLayout>

/**
 * The table state the grid draws from: its page size and its row height, both
 * as the author declared them — the page never larger than the binding's
 * `limit`. A reader's resizes and toggles last for the
 * visit only — nothing about how she looked at the grid is stored.
 */
export function useEffectiveLayout(ctx: SetupContext) {
  const tableState = useDataTableState({
    initialPageSize: cappedPageSize(
      ctx.params.dataSource.limit,
      ctx.params.paginationConfig?.pageSize
    ),
    initialRowHeight: ctx.params.initialRowHeight,
  })

  return { tableState }
}
