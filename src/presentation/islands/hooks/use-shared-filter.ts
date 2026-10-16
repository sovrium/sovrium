/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  EMPTY_PARAMS,
  selectParams,
  subscribeSharedFilter,
  type PublishedValue,
} from '../runtime/shared-filter-channel'

/**
 * Cross-component shared filter / period binding subscriber
 *.
 *
 * The DYNAMIC counterpart to a system source's static `query`: a data source
 * carrying `bindTo` + `sharedFilter` listens on the CHANNEL `bindTo` names and
 * re-reads with what the channel's publishers hold merged into its request.
 * ONE channel can drive MANY subscribers (a DB-table grid + a system-source
 * grid both re-read on the shared change); each subscriber picks the subset it
 * consumes via `sharedFilter.params`.
 *
 * Inert (returns a stable empty bag) unless BOTH `bindTo` and `sharedFilter`
 * are present — mirroring how `pollIntervalMs` is silently ignored without
 * `refreshMode: poll`.
 *
 * ONE CHANNEL, MANY CONTRIBUTORS. Every publisher — a search box, a select, a
 * filter bar, a selection — contributes its own keys to one bag, MERGED rather
 * than replaced, which is what lets several controls narrow the same request.
 * A subscriber with `params` takes that subset of the bag (a control's
 * condition always rides along); one without takes the whole bag. An empty
 * published value withdraws its key.
 */

export interface SharedFilterBindingConfig {
  /** The channel this subscriber listens on. */
  readonly bindTo?: string
  /** Param mapping companion; presence (even `{}`) activates the binding. */
  readonly sharedFilter?: { readonly params?: readonly string[] }
}

/**
 * Subscribe to the `bindTo` publisher and return the merged request-param bag.
 * The result is stable between publisher changes so it can drive a query key
 * without spurious re-reads.
 */
export function useSharedFilter({
  bindTo,
  sharedFilter,
}: SharedFilterBindingConfig): Record<string, string> {
  const active = Boolean(bindTo) && sharedFilter !== undefined
  const [published, setPublished] = useState<PublishedValue | undefined>(undefined)
  // Stable identity for the params array so the merge memo only recomputes when
  // the publisher value (or the declared param set) actually changes.
  const paramsKey = sharedFilter?.params ? sharedFilter.params.join(',') : ''

  useEffect(() => {
    if (!active || bindTo === undefined) return undefined
    return subscribeSharedFilter(bindTo, setPublished)
  }, [active, bindTo])

  // `paramsKey` stands in for the `sharedFilter.params` array identity so the
  // merge only recomputes when the publisher value (or the param set) changes.
  const params = sharedFilter?.params
  return useMemo(() => {
    if (!active || published === undefined) return EMPTY_PARAMS
    return selectParams(published, params)
  }, [active, published, params, paramsKey])
}
