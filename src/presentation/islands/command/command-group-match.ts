/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How typing narrows the authored command groups where the list's own filter
 * is off (search mode): an item is kept when its label or its group's name
 * holds every typed word, and an item reading `$query` always is.
 */

import { actionMatchesQuery } from './command-actions-data'
import type { AuthoredCommandGroup, AuthoredCommandItem } from './command-groups'

/** Bare `$query`; a page's `$query.<name>` is resolved on the server and never reaches here. */
const QUERY_TERM = /\$query(?![.\w])/g

/**
 * The item as drawn for the words typed so far, or `undefined` when it is not
 * drawn. `replace` takes a FUNCTION so a `$&` among the words stays literal.
 */
export const itemForQuery = (
  item: AuthoredCommandItem,
  query: string
): AuthoredCommandItem | undefined => {
  const words = query.trim()
  const href =
    item.href === undefined
      ? {}
      : { href: item.href.replace(QUERY_TERM, () => encodeURIComponent(words)) }
  if (item.label.search(QUERY_TERM) === -1) return { ...item, ...href }
  if (words.length > 0)
    return { ...item, ...href, label: item.label.replace(QUERY_TERM, () => words) }
  return item.emptyLabel === undefined ? undefined : { ...item, ...href, label: item.emptyLabel }
}

/** Whether an item reads the typed words back (`$query`), and so matches any of them. */
const readsQuery = (item: AuthoredCommandItem): boolean => item.label.search(QUERY_TERM) !== -1

/** Whether typing keeps an item: its label or its group's name holds every typed word. */
export const keptByQuery = (item: AuthoredCommandItem, group: string, query: string): boolean =>
  readsQuery(item) || actionMatchesQuery(`${item.label} ${group}`, query.trim())

/**
 * Whether the typed words find an authored item on their own merits: one that
 * reads them back matches anything, so it is not counted as a match.
 */
export const groupsMatchQuery = (groups: readonly AuthoredCommandGroup[], query: string): boolean =>
  query.trim().length > 0 &&
  groups.some((group) =>
    group.items.some((item) => !readsQuery(item) && keptByQuery(item, group.label, query))
  )
