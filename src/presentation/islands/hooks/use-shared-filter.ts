/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo, useState } from 'react'

/**
 * Cross-component shared filter / period binding subscriber
 *.
 *
 * The DYNAMIC counterpart to a system source's static `query`: a data source
 * carrying `bindTo` + `sharedFilter` subscribes to a sibling PUBLISHER (a
 * `searchInput` / selector / filter / period control whose component id equals
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
 *  - a scalar `searchInput` publishes its value via the DOM `input` event on its
 *    `#<bindTo> input` (the same channel the legacy `useBoundQuery` reads), and
 *    via the `island:search` CustomEvent when it is an island;
 *  - a multi-param selector publishes a param BAG via the `island:system-query`
 *    CustomEvent (the channel the runs filter bar already dispatches).
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

/** The raw value a publisher last published — a scalar input or a param bag. */
type PublishedValue =
  | { readonly kind: 'scalar'; readonly value: string }
  | { readonly kind: 'bag'; readonly value: Record<string, string> }

/** Stable empty reference so an inert subscriber never churns its query key. */
const EMPTY_PARAMS: Record<string, string> = {}

/**
 * Map a published value + the subscriber's param selection to a request bag.
 *
 * Empty values are KEPT in the bag (e.g. `{ automationName: '' }` after a clear):
 * the merged bag becomes the subscriber's query key, so retaining the cleared key
 * keeps the state structurally DISTINCT from the never-touched initial state and
 * forces a re-read (the global cache would otherwise serve the stale prior page
 * for a key that reverted to the initial empty one). The fetch layer drops empty
 * values from the actual request URL — `buildSystemQueryString` already does for
 * the system path; `fetchTableRecords` does for the DB-table path.
 */
function selectParams(
  published: PublishedValue,
  params: readonly string[] | undefined
): Record<string, string> {
  if (published.kind === 'scalar') {
    // A scalar publisher maps its value onto each named param; without params it
    // has no bag to merge.
    if (params === undefined || params.length === 0) return EMPTY_PARAMS
    return Object.fromEntries(params.map((p) => [p, published.value]))
  }
  // A bag publisher: pick the declared subset (or the full bag when no params).
  const bag = published.value
  const keys = params !== undefined && params.length > 0 ? params : Object.keys(bag)
  return Object.fromEntries(keys.map((k) => [k, bag[k] ?? ''] as const))
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

    // Param-bag publisher (a multi-param selector island).
    const onSystemQuery = (e: Event): void => {
      const detail = (e as CustomEvent).detail as
        { params?: Record<string, string>; sourceId?: string } | undefined
      if (detail?.params === undefined || detail.sourceId !== bindTo) return
      setPublished({ kind: 'bag', value: detail.params })
    }
    document.addEventListener('island:system-query', onSystemQuery)

    // Scalar publisher via the island:search event (a search-input island).
    const onSearch = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { query?: string; sourceId?: string } | undefined
      if (detail?.query === undefined || detail.sourceId !== bindTo) return
      setPublished({ kind: 'scalar', value: detail.query })
    }
    document.addEventListener('island:search', onSearch)

    // Scalar publisher via the DOM input of a static `searchInput` (the channel
    // the legacy `useBoundQuery` reads): listen for its `input` event directly.
    const container = document.getElementById(bindTo)
    const input = container?.querySelector('input') ?? document.querySelector(`#${bindTo} input`)
    const onInput = (e: Event): void =>
      setPublished({ kind: 'scalar', value: (e.target as HTMLInputElement).value })
    input?.addEventListener('input', onInput)
    // Capture a value the publisher already holds when this subscriber mounts
    // (e.g. the input was filled before this lazy island hydrated) so the binding
    // is robust against the hydration race — without it, an early `input` event
    // would be missed and the param never forwarded.
    if (input instanceof HTMLInputElement && input.value !== '') {
      setPublished({ kind: 'scalar', value: input.value })
    }

    return () => {
      document.removeEventListener('island:system-query', onSystemQuery)
      document.removeEventListener('island:search', onSearch)
      input?.removeEventListener('input', onInput)
    }
  }, [active, bindTo])

  // `paramsKey` stands in for the `sharedFilter.params` array identity so the
  // merge only recomputes when the publisher value (or the param set) changes.
  const params = sharedFilter?.params
  return useMemo(() => {
    if (!active || published === undefined) return EMPTY_PARAMS
    return selectParams(published, params)
  }, [active, published, params, paramsKey])
}
