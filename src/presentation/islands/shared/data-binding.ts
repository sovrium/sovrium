/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Minimal shape a data-bound component's `dataSource` exposes for the guard. */
interface DataBoundSource {
  readonly table?: string
  readonly system?: unknown
}

/**
 * A list-family component is bound when its `dataSource` has either a DB table
 * OR a system read endpoint.
 *
 * Declared as a GENERIC type predicate (`dataSource is T`) so TS narrows the
 * caller's `dataSource` out of `… | undefined` at the call site — the populated
 * branch then reads the component-specific fields (`pagination`, `view`, …)
 * without a non-null assertion. Keeping it generic (rather than a plain boolean)
 * is what preserves the narrowing; a boolean return would reintroduce the
 * TS18048 "possibly undefined" errors each island originally worked around.
 */
export function hasDataBinding<T extends DataBoundSource>(
  dataSource: T | undefined
): dataSource is T {
  return Boolean(dataSource?.table) || Boolean(dataSource?.system)
}

/**
 * Resolve the rows a list-family island renders.
 *
 * `embedded` rows are handed in by a component that already fetched them — the
 * data-table's view switcher renders kanban / calendar / gallery over the rows
 * its grid is currently showing, so a runtime search or filter carries across
 * the switch instead of the view silently re-querying the whole table. When
 * they are present the embedder also omits `dataSource`, which disables the
 * island's own fetch, so `fetched` is empty rather than merely ignored.
 */
export function resolveIslandRecords<T>(
  embedded: readonly T[] | undefined,
  fetched: readonly T[] | undefined
): readonly T[] {
  return embedded ?? fetched ?? []
}
