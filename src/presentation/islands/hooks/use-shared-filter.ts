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
 * The contributions a DOM publisher already holds on this channel when a
 * subscriber mounts.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * A NATIVE select (`select.native` + `publishes`) is live from FIRST PAINT —
 * that is the whole point of [internal ref] — while this subscriber is a lazily
 * hydrated island. So an operator who picks a filter during that window
 * dispatches into a channel nobody is listening on yet and the selection is
 * silently lost: the grid keeps showing everything while the control reads
 * "member".
 *
 * The fix is the one this hook already applies to a static `search-input` a few
 * lines below — capture what the DOM publisher is holding at mount rather than
 * relying on having heard its event.
 *
 * ─── WHY IT IS NOT LIMITED TO A `<select>` ──────────────────────────────────
 *
 * A `filter-bar` hits the same window from the OTHER side, and deterministically
 * rather than occasionally. It publishes its INITIAL conditions the moment it
 * mounts, and its chunk is a few KB against the data-table's several hundred —
 * so the bar has almost always finished publishing before the grid's listener
 * exists. Waiting for an event that was already sent leaves a page whose bar
 * shows a chip and whose grid shows everything, on every load rather than on a
 * slow one.
 *
 * So a publisher may also HOLD its current contribution in the DOM, on any
 * element carrying `data-publishes-bind-to` + `data-publishes-param`. The
 * filter-bar renders that element both server-side (so a grid mounting before
 * the bar still sees the opening conditions) and inside the mounted island (so
 * it stays current after the reader edits the set). The event channel remains
 * the live path; this is only the late-join capture.
 *
 * The attribute is compared in JS rather than interpolated into the selector:
 * `bindTo` is author-supplied config, and a channel named `a"]` would otherwise
 * build a broken (or hostile) selector.
 *
 * An empty selection is skipped, exactly as the input capture skips `''` — an
 * untouched filter must not force a re-read on mount.
 */
function readDomPublisherContributions(bindTo: string): Record<string, string> {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-publishes-bind-to]'))
    .filter((element) => element.getAttribute('data-publishes-bind-to') === bindTo)
    .reduce<Record<string, string>>((bag, element) => {
      const param = element.getAttribute('data-publishes-param')
      const value = readPublishedDomValue(element)
      if (param === null || value === '') return bag
      return { ...bag, [param]: value }
    }, {})
}

/**
 * What one DOM publisher is currently holding.
 *
 * A `<select>` reports its selection (a MULTIPLE one joined by commas, the
 * shape a repeated query param already collapses to); an `<input>` — the
 * filter-bar's hidden expression carrier — reports its value. Anything else
 * contributes nothing rather than the string `"undefined"`.
 */
function readPublishedDomValue(element: HTMLElement): string {
  if (element instanceof HTMLSelectElement) {
    return element.multiple
      ? Array.from(element.selectedOptions)
          .map((option) => option.value)
          .join(',')
      : element.value
  }
  return element instanceof HTMLInputElement ? element.value : ''
}

/**
 * Fold a DOM publisher's mount-time contributions into the published value,
 * leaving it untouched when there are none — so a subscriber whose channel has
 * no DOM publisher keeps its `undefined` initial state and does not re-read.
 */
function mergeDomPublisherSeed(
  previous: PublishedValue | undefined,
  bindTo: string
): PublishedValue | undefined {
  const seeded = readDomPublisherContributions(bindTo)
  if (Object.keys(seeded).length === 0) return previous
  return {
    kind: 'bag',
    value: previous?.kind === 'bag' ? { ...previous.value, ...seeded } : seeded,
  }
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
      const contributed = detail.params
      // MERGE, never replace. A channel has MANY contributors — a runs
      // directory drives one grid from two selectors, each publishing only its
      // own `param` — so replacing would let the last control touched erase
      // every sibling's contribution, and the two params could never arrive in
      // the same request. A publisher that sends its whole bag every time (the
      // runs filter bar) is unaffected: merging its complete bag over the
      // previous one is the same value.
      setPublished((prev) => ({
        kind: 'bag',
        value: prev?.kind === 'bag' ? { ...prev.value, ...contributed } : contributed,
      }))
    }
    document.addEventListener('island:system-query', onSystemQuery)

    // Scalar publisher via the island:search event (a search-input island).
    const onSearch = (e: Event): void => {
      const detail = (e as CustomEvent).detail as { query?: string; sourceId?: string } | undefined
      if (detail?.query === undefined || detail.sourceId !== bindTo) return
      setPublished({ kind: 'scalar', value: detail.query })
    }
    document.addEventListener('island:search', onSearch)

    // Scalar publisher via the DOM input of a static `search-input` (the channel
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

    // The same late-join capture for a publisher that HOLDS its contribution in
    // the DOM — an island-less native select (usable from first paint, so it
    // misses far more than an input can) or a filter-bar (which publishes its
    // opening conditions before this subscriber's listener exists). Merged
    // rather than assigned, for the reason `onSystemQuery` merges: a channel
    // has many contributors.
    setPublished((prev) => mergeDomPublisherSeed(prev, bindTo))

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
