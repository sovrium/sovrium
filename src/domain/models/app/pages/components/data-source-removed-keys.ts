/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The keys a component's `dataSource` no longer accepts, and what replaces
 * each.
 *
 * `targetId` named a data source so the `filter` page action could reach it.
 * Nothing ever read either half: no handler dispatched a `filter` action and no
 * resolver looked a data source up by `targetId`. A control narrows a data
 * component through its `publishes` on a shared-filter channel the component
 * subscribes to, so the key is refused with that pointer.
 */

/** A component's own `dataSource`, at any depth of a page or a component template. */
const COMPONENT_DATA_SOURCE = /(^|\.)(components|children)\[\d+\]\.dataSource$/

/** Keys removed from a component's `dataSource`. */
const REMOVED_ON_DATA_SOURCE: ReadonlyMap<string, string> = new Map([
  [
    'targetId',
    '`dataSource.targetId` has been removed: nothing ever read it. To narrow this component from a control, give the control `publishes: { bindTo: <channel>, field, operator }` and subscribe the component with `dataSource.bindTo: <channel>` and `sharedFilter: {}`.',
  ],
])

/**
 * The migration message for a removed `dataSource` key, or `undefined` when
 * this module has nothing to say about it.
 *
 * @param path - Dotted path of the node holding the key, e.g.
 *   `pages[0].components[2].dataSource`.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRemovedDataSourceKey = (
  path: string,
  key: string
): string | undefined =>
  COMPONENT_DATA_SOURCE.test(path) ? REMOVED_ON_DATA_SOURCE.get(key) : undefined

/** Every removed key, for the test that pins each message. @internal */
export const REMOVED_DATA_SOURCE_KEYS: readonly string[] = [...REMOVED_ON_DATA_SOURCE.keys()]
