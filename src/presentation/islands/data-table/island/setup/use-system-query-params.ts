/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { useIslandSystemQuery } from '../../../hooks/use-island-system-query'
import { useSharedFilter } from '../../../hooks/use-shared-filter'
import type { SetupContext } from './setup-params'

export type SystemQueryParams = ReturnType<typeof useSystemQueryParams>

/**
 * The dynamic query params a grid sends with its read.
 *
 * Two channels feed a system source: the legacy grid-scoped filter bar, keyed
 * on this grid's component id, and the config shared-filter publisher named by
 * `bindTo`. Only one is ever active per grid, so merging is a no-op for the
 * inactive channel. A DB-table grid uses `sharedFilterParams` on its own, as
 * raw query params.
 */
export function useSystemQueryParams(ctx: SetupContext) {
  const { dataSource, searchSourceId } = ctx.params

  const legacySystemQuery = useIslandSystemQuery(searchSourceId)

  // Cross-component shared-filter binding: when this grid's data source carries
  // `bindTo` + `sharedFilter`, subscribe to the named sibling publisher and
  // re-read with its value merged into the request. The binding lives on
  // `system` (system source) or on the DB-table data source.
  const sharedFilterParams = useSharedFilter({
    bindTo: dataSource.system?.bindTo ?? dataSource.bindTo,
    sharedFilter: dataSource.system?.sharedFilter ?? dataSource.sharedFilter,
  })

  const systemQuery = useMemo(
    () => ({ ...legacySystemQuery, ...sharedFilterParams }),
    [legacySystemQuery, sharedFilterParams]
  )

  return { systemQuery, sharedFilterParams }
}
