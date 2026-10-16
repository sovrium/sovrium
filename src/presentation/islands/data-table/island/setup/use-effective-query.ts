/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SetupContext } from './setup-params'
import type { EffectiveLayout } from './use-effective-layout'

export type EffectiveQuery = ReturnType<typeof useEffectiveQuery>

/**
 * The filter and sort the records request will carry: the binding's own
 * filter, and the sort a column-header click set. The schema's
 * `dataSource.sort` is the last fallback, applied inside the query hook itself.
 */
export function useEffectiveQuery(ctx: SetupContext, layout: EffectiveLayout) {
  const { filter } = ctx.params.dataSource
  return { filter, sorting: layout.tableState.sorting }
}
