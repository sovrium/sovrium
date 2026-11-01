/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { entryAsComponent, rewriteComponent, type ComponentEntry } from './component-rewrite'
import type { Page } from '@/domain/models/app/pages'

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

const authorOf = (node: ComponentEntry | undefined): string | undefined => {
  if (typeof node !== 'object') return undefined
  const component = entryAsComponent(node)
  if (component.type !== 'message') return undefined
  const { author } = component
  return typeof author === 'string' ? author : undefined
}

/** Mark the continuing turns of one sibling list, recursing into each child's own children. */
function markSiblings(siblings: ReadonlyArray<ComponentEntry>): ReadonlyArray<ComponentEntry> {
  return siblings.map((node, index) => {
    if (typeof node !== 'object') return node
    const component = entryAsComponent(node)
    const author = authorOf(node)
    const continued = author !== undefined && authorOf(siblings[index - 1]) === author
    const children = Array.isArray(component.children)
      ? markSiblings(component.children)
      : component.children
    return rewriteComponent(component, {
      ...(children === component.children ? {} : { children }),
      ...(continued ? { [AUTHOR_CONTINUED_KEY]: true } : {}),
    })
  })
}

/** True when any node of the tree is a `message`, so a page without one is left untouched. */
const hasMessage = (nodes: ReadonlyArray<ComponentEntry>): boolean =>
  nodes.some((node) => {
    if (typeof node !== 'object') return false
    const { type, children } = entryAsComponent(node)
    return type === 'message' || (Array.isArray(children) && hasMessage(children))
  })

/** Mark every message turn that continues the previous turn's author. */
export function groupMessageAuthors(components: Page['components']): Page['components'] {
  if (!components || !hasMessage(components)) return components
  return markSiblings(components) as Page['components']
}
