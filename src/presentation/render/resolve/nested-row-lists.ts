/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A data-bound list inside the ROW of another list.
 *
 * An outer list expands its `children` template once per record. One of those
 * children may be a list of its own — "the members of this team" — whose
 * `children` are a second template, waiting for ITS rows. Two things keep that
 * inner list its own:
 *
 *  - **Substitution stops at it** (`'stop-at-nested-rows'`). The outer record
 *    still fills the inner list's own binding (`filter: [{ value: '$record.id' }]`
 *    is how a row narrows its children), its props and its content, but never
 *    its row template: an inner `$record.email` consumed by the outer record —
 *    which has no such field — drew one row with nothing in it.
 *  - **It is read after the outer rows are drawn** ({@link resolveRowNestedLists}).
 *    Each copy is resolved by the same resolver a list at the top of the page
 *    goes through, so its own filter, its reader's grants and its empty message
 *    apply in every outer row.
 *
 * Only a list that draws rows on the server from a `children` template stops
 * the walk. Any other binding under a row — a record-bound form, an island that
 * fetches for itself — is substituted and left as before.
 */

import { isListIslandMode } from '@/presentation/render/registry/list-island-mode'
import { isComponentReferenceNode } from './component-reference'
import { SINGLE_RECORD_NOT_FOUND, UNAUTHORIZED } from './data-source-contracts'
import type { DataSourceSectionResult } from './data-source-contracts'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A node that draws rows of its own, on the server, from its `children`
 * template — a container of cards bound to a table. A grid, a drawer and an
 * island binding (whose island owns the fetch) do not. The one predicate both
 * the nested walk (`data-source-resolver.ts`) and a row's substitution depth ask.
 */
export function drawsOwnRows(node: Component): boolean {
  const binding = node.dataSource as
    { readonly mode?: string; readonly table?: unknown } | undefined
  const children = node.children as readonly unknown[] | undefined
  return (
    binding !== undefined &&
    node.type !== 'table' &&
    node.type !== 'sheet' &&
    (binding.mode === undefined || binding.mode === 'list') &&
    typeof binding.table === 'string' &&
    children !== undefined &&
    children.length > 0 &&
    !isListIslandMode(node)
  )
}

type Resolve = (node: Component) => Promise<DataSourceSectionResult>
type Entry = Component | string
type Sentinel = typeof UNAUTHORIZED | typeof SINGLE_RECORD_NOT_FOUND

const isSentinel = (value: unknown): value is Sentinel =>
  value === UNAUTHORIZED || value === SINGLE_RECORD_NOT_FOUND

/** One entry of an expanded row: a nested row list read, a layout node walked. */
async function resolveEntry(entry: Entry, resolve: Resolve): Promise<Entry | Sentinel> {
  if (typeof entry === 'string' || isComponentReferenceNode(entry)) return entry
  const node = entry as Component
  if (drawsOwnRows(node)) return (await resolve(node)) as Entry | Sentinel
  if (node.dataSource !== undefined) return entry
  return (await resolveRowNestedLists(node, resolve)) as Entry | Sentinel
}

/**
 * The host with every data-bound list in its expanded rows read for itself,
 * at any depth below the rows. The host comes back by reference when it holds
 * none; a page-level answer (`UNAUTHORIZED`, a missing record) wins.
 */
export async function resolveRowNestedLists(
  host: DataSourceSectionResult,
  resolve: Resolve
): Promise<DataSourceSectionResult> {
  if (isSentinel(host) || isComponentReferenceNode(host)) return host
  const children = (host as Component).children as readonly Entry[] | undefined
  if (children === undefined || children.length === 0) return host
  const resolved = await Promise.all(children.map((entry) => resolveEntry(entry, resolve)))
  const sentinel = resolved.find(isSentinel)
  if (sentinel !== undefined) return sentinel
  return resolved.every((entry, index) => entry === children[index])
    ? host
    : ({ ...(host as Component), children: resolved } as Component)
}
