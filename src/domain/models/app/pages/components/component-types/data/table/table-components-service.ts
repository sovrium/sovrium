/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Locating `type: 'table'` components in a RAW parsed config.
 *
 * A board, a calendar and a grid of the same records are three components,
 * and the raw-config sweeps that cross-check a grid's field references need to
 * find every grid — which is what these walkers do.
 */

/**
 * The two keys the `rowColorField` EXISTENCE rule reads.
 *
 * Structural rather than `DataTable`: the rule runs against the RAW parsed
 * config (post-decode, pre-typing), and a decoded `DataTable` is assignable to
 * this shape too, so both callers use one function.
 */
export interface DataTableRowColorBinding {
  readonly dataSource?: { readonly table?: string }
  readonly rowColorField?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Collect every `type: 'table'` component anywhere in a parsed config.
 *
 * A deep walk rather than a `pages[].components[]` sweep on purpose: a
 * data-table can sit inside a container, a tab panel or a split pane, and a
 * shallow walk would silently exempt exactly the nested surfaces an author is
 * most likely to get wrong.
 *
 * ONE walk, several typed façades — every raw-config sweep reads a different
 * handful of keys off the same components, and a second traversal is how two
 * sweeps end up disagreeing about which surfaces they cover.
 */
export function collectDataTableComponents(config: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(config)) return config.flatMap(collectDataTableComponents)
  if (!isRecord(config)) return []
  const self = config['type'] === 'table' ? [config] : []
  return [...self, ...Object.values(config).flatMap(collectDataTableComponents)]
}

/** Every data-table in a raw config, typed for the `rowColorField` EXISTENCE rule. */
export function collectDataTableRowColorBindings(
  config: unknown
): readonly DataTableRowColorBinding[] {
  return collectDataTableComponents(config) as readonly DataTableRowColorBinding[]
}
