/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildFlexClasses, buildGridClasses } from './class-builders'

/** The layout components a card's children may be wrapped in, and the classes each lays out with. */
const LAYOUT_CLASSES: Readonly<
  Record<string, (props?: Record<string, unknown>) => string | undefined>
> = {
  flex: buildFlexClasses,
  grid: buildGridClasses,
}

/**
 * One card child: a layout component (`flex`, `grid`) gains `layoutClassName`,
 * the classes its own `props` lay it out with as on a page, the author's
 * `className` after them, and its children are resolved the same way. Every
 * other child is returned as it came.
 */
function resolveChild(child: unknown): unknown {
  if (typeof child !== 'object' || child === null) return child
  const entry = child as Readonly<Record<string, unknown>>
  const build = typeof entry['type'] === 'string' ? LAYOUT_CLASSES[entry['type']] : undefined
  if (build === undefined) return child
  const props = (entry['props'] ?? {}) as Record<string, unknown>
  const author = typeof props['className'] === 'string' ? props['className'] : undefined
  return {
    ...entry,
    layoutClassName: [build(props), author].filter(Boolean).join(' '),
    ...(Array.isArray(entry['children']) && { children: entry['children'].map(resolveChild) }),
  }
}

/**
 * A card template (a gallery `galleryCard`) whose layout children carry the
 * classes they lay out with, resolved here on the server: the island reads the
 * string and draws it, so the layout class builders stay out of its payload.
 *
 * @param card - The card template as the page config declares it, if any.
 */
export const resolveCardLayoutClasses = <T>(card: T): T => {
  if (typeof card !== 'object' || card === null) return card
  const template = card as Readonly<Record<string, unknown>>
  const { children } = template
  return Array.isArray(children)
    ? ({ ...template, children: children.map(resolveChild) } as T)
    : card
}
