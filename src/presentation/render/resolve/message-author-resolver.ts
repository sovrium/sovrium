/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A run of consecutive `message` turns by ONE author prints the author once.
 *
 * A group is not a key the author writes: it is consecutive siblings sharing an
 * `author`, which only a pass over the sibling list can see — a renderer sees
 * one component. So this pass marks every turn that continues the previous
 * sibling's author with the render-time field {@link AUTHOR_CONTINUED_KEY}, and
 * the message renderer leaves the name (and the avatar) off those turns. The
 * same shape `resolvePageToc` uses to hand its renderer what one node cannot see.
 */
export const AUTHOR_CONTINUED_KEY = 'authorContinued'

const authorOf = (node: Component | string | undefined): string | undefined => {
  if (typeof node !== 'object' || node.type !== 'message') return undefined
  const { author } = node as { readonly author?: unknown }
  return typeof author === 'string' ? author : undefined
}

/** Mark the continuing turns of one sibling list, recursing into each child's own children. */
function markSiblings(
  siblings: ReadonlyArray<Component | string>
): ReadonlyArray<Component | string> {
  return siblings.map((node, index) => {
    if (typeof node !== 'object') return node
    const author = authorOf(node)
    const continued = author !== undefined && authorOf(siblings[index - 1]) === author
    const children = Array.isArray(node.children) ? markSiblings(node.children) : node.children
    return {
      ...node,
      ...(children === node.children ? {} : { children }),
      ...(continued ? { [AUTHOR_CONTINUED_KEY]: true } : {}),
    } as Component
  })
}

/** True when any node of the tree is a `message`, so a page without one is left untouched. */
const hasMessage = (nodes: ReadonlyArray<Component | string>): boolean =>
  nodes.some(
    (node) =>
      typeof node === 'object' &&
      (node.type === 'message' || (Array.isArray(node.children) && hasMessage(node.children)))
  )

/** Mark every message turn that continues the previous turn's author. */
export function groupMessageAuthors(components: Page['components']): Page['components'] {
  if (!components || !hasMessage(components)) return components
  return markSiblings(components) as Page['components']
}
