/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A node `key` names ONE node of its page.
 *
 * A key is what a design tool matches a drawn node back to after a move, so
 * two nodes of one page sharing a key would make that match a guess. The rule
 * is page-wide — one node cannot see its siblings, let alone a node three
 * containers away — so it is checked here, over every node the identity walker
 * reaches (`node-identity.ts`), rather than on the field. The same key on two
 * pages is fine: a key is unique within its page only.
 */

import { nodeIdsOf, type IdentifiablePage } from './node-identity'

/** The slice of the app the rule reads. */
interface AppForNodeKeys {
  readonly pages?: readonly IdentifiablePage[] | undefined
}

/** The first key used twice on one page, with the two pointers that carry it. */
const firstDuplicateKey = (
  page: IdentifiablePage
): { readonly key: string; readonly first: string; readonly second: string } | undefined => {
  const keyed = nodeIdsOf(page).flatMap((identity) =>
    identity.key === undefined ? [] : [{ key: identity.key, pointer: identity.pointer }]
  )
  return keyed.reduce<{ key: string; first: string; second: string } | undefined>(
    (found, entry, index) => {
      if (found !== undefined) return found
      const earlier = keyed.slice(0, index).find((other) => other.key === entry.key)
      return earlier === undefined
        ? undefined
        : { key: entry.key, first: earlier.pointer, second: entry.pointer }
    },
    undefined
  )
}

/**
 * Every page's node keys are unique within that page.
 *
 * @returns `true`, or a message naming the page, the key and both nodes.
 */
export const validateAllPageNodeKeys = (app: AppForNodeKeys): true | string => {
  const failure = (app.pages ?? []).reduce<string | undefined>((message, page) => {
    if (message !== undefined) return message
    const duplicate = firstDuplicateKey(page)
    return duplicate === undefined
      ? undefined
      : `Page "${page.name}" uses the node key "${duplicate.key}" twice, at ${duplicate.first} and ${duplicate.second}. A key names one node of its page: rename one of them.`
  }, undefined)
  return failure ?? true
}
