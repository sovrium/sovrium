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
 * carrying `bindTo` + `sharedFilter` subscribes to a sibling PUBLISHER (a
 * `search-input` / selector / filter / period control whose component id equals
 * `bindTo`) and re-reads with the publisher's current value merged into its
 * request as the named param(s). ONE publisher can drive MANY sibling
 * subscribers (a DB-table grid + a system-source grid both re-read on the shared
 * change); each subscriber picks the subset of the published value it consumes
 * via `sharedFilter.params`.
 *
 * Inert (returns a stable empty bag) unless BOTH `bindTo` and `sharedFilter` are
 * present — mirroring how `pollIntervalMs` is silently ignored without
 * `refreshMode: poll`. A legacy `bindTo` WITHOUT `sharedFilter` keeps driving
 * client-side search (handled elsewhere), never a request param.
 *
 * It reuses — never reinvents — the existing publisher channels:
 *  - a scalar `search-input` publishes its value via the DOM `input` event on its
 *    `#<bindTo> input` (the same channel the legacy `useBoundQuery` reads), and
 *    via the `island:search` CustomEvent when it is an island;
 *  - a multi-param selector publishes a param BAG via the `island:system-query`
 *    CustomEvent (the channel the runs filter bar already dispatches);
 *  - a config `select` carrying `publishes: { bindTo, param }` contributes ONE
 *    key of a bag on that same event (`use-shared-filter-publisher.ts`).
 *
 * ONE CHANNEL, MANY CONTRIBUTORS. Bags arriving on a channel are MERGED rather
 * than replaced, which is what lets two sibling selects put both their params
 * into the SAME request.
 *
 * Mapping the published value to the merged request bag:
 *  - scalar value `v` + `params: [p1, p2]` -> `{ p1: v, p2: v }`
 *  - scalar value `v` + no `params`         -> `{}` (a scalar has no bag to merge)
 *  - bag value + `params: [k1]`             -> `{ k1: bag[k1] }` (a subset)
 *  - bag value + no `params`                -> the full bag verbatim
 * An empty published value clears the param (the key is dropped from the bag).
 */

export interface SharedFilterBindingConfig {
  /** The publisher component id this subscriber listens to. */
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
