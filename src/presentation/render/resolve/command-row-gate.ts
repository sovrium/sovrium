/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `visibility` of a `command`'s authored groups and items, judged by the
 * gate that judges components.
 *
 * A command group or item takes the struct a component takes, and it is
 * answered the same way: a row whose conditions do not hold is REMOVED before
 * the palette's config is serialised, never hidden in the browser. The palette
 * is an island, so a client-side filter would still ship the gated row's label
 * and address in `data-island-props` to every reader — the leak exclusion
 * exists to stop.
 *
 * The predicate is the caller's: each pruning pass hands in the rule it already
 * applies to a component node, so a row and a component can never disagree
 * about a gate. A group left with no item is removed with it, as typing hides a
 * group left with no match. Returns the SAME node when nothing is dropped.
 */

type Row = Readonly<Record<string, unknown>>

const rowsOf = (value: unknown): readonly Row[] =>
  Array.isArray(value) ? (value as readonly Row[]) : []

/** Keep, in a `command` node's `groups`, only the groups and items `admits` keeps. */
export function gateCommandRows(node: object, admits: (row: unknown) => boolean): object {
  const { type, groups } = node as { readonly type?: unknown; readonly groups?: unknown }
  if (type !== 'command' || !Array.isArray(groups)) return node
  const gated = rowsOf(groups)
    .filter(admits)
    .map((group) => {
      const items = rowsOf(group['items'])
      const kept = items.filter(admits)
      return kept.length === items.length ? group : { ...group, items: kept }
    })
    .filter((group) => rowsOf(group['items']).length > 0)
  const unchanged =
    gated.length === groups.length && gated.every((group, index) => group === groups[index])
  return unchanged ? node : { ...(node as Row), groups: gated }
}
