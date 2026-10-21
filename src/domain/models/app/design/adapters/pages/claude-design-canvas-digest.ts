/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Claude Design page adapter, digest half: what a LOCKED node of a board
 * (a template placement, an island) draws inside, as one document the page
 * import only ever compares with the same digest of an unedited export
 * (`page-merge-digest-service.ts`). The canvas parse reads a locked node's
 * box and its slotted page nodes; everything else it draws is this digest.
 *
 * A board may be a prototype built over the export, which only ADDS: its own
 * markup, handlers, state and accessibility attributes, `{{holes}}`, links
 * wired to other boards. None of that is compared — its attributes are left
 * out, its wrappers are read through — and the digest says it is additive, so
 * an element the prototype added beside the export's is set aside too.
 *
 * Pure: the same element always gives the same digest.
 */

import type { HtmlElementNode, HtmlNode } from '@/domain/kernel/sanitize/html-element-tree'

/** The type of a page node a placement draws in one of its slots, or `undefined`. */
export type SlottedTypeOf = (element: HtmlElementNode) => string | undefined

/** The elements a board holds that are never drawn content. */
const UNDRAWN_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'helmet',
  'link',
  'meta',
  'template',
])

/**
 * The state attributes a prototype sets or removes on the export's markup,
 * the inline `style` it sizes its stand-ins with, and the `href` it wires to
 * another board: the export draws every link `#`.
 */
const PROTOTYPE_STATE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href',
  'style',
  'data-open',
  'data-state',
  'disabled',
  'hidden',
  'checked',
  'value',
  'tabindex',
])

/**
 * Whether an attribute is one no digest compares: a stamp the export writes,
 * or the PROTOTYPE LAYER a canvas may add over the export without editing it —
 * an event handler, a state or accessibility attribute, a `data-proto-*`
 * marker, a `{{hole}}` its logic fills.
 */
const isUncomparedAttribute = (name: string, value: string): boolean =>
  name.startsWith('data-kit') ||
  name.startsWith('data-sovrium-') ||
  name.startsWith('data-proto') ||
  name.startsWith('aria-') ||
  name.startsWith('on') ||
  PROTOTYPE_STATE_ATTRIBUTES.has(name) ||
  value.includes('{{')

/**
 * Whether an element is the prototype layer's own markup, never the export's:
 * a `proto-*` class, a prototype loop or condition, an element carrying
 * nothing but `data-proto-*` markers and handlers. It
 * is set aside and what it wraps is read, since a prototype wraps the
 * export's own markup as often as it adds its own.
 */
const isPrototypeMarkup = (element: HtmlElementNode): boolean => {
  const names = Object.keys(element.attributes)
  return (
    element.tag.startsWith('sc-') ||
    (element.attributes['class'] ?? '').split(/\s+/).some((token) => token.startsWith('proto-')) ||
    (names.some((name) => name.startsWith('data-proto')) &&
      names.every((name) => name.startsWith('data-proto') || name.startsWith('on')))
  )
}

/** An element's compared attributes, sorted, so a digest never depends on their order. */
const drawnAttributesOf = (element: HtmlElementNode): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(element.attributes)
      .filter(([name, value]) => !isUncomparedAttribute(name, value))
      .toSorted(([a], [b]) => a.localeCompare(b))
  )

/**
 * What a locked node draws inside, as an import compares it: each element's
 * tag, attributes and children, each text run trimmed, and each page node a
 * placement draws in a slot standing in by its type alone (it is read as a
 * node of its own).
 */
const lockedDrawingOf = (slotted: SlottedTypeOf, nodes: readonly HtmlNode[]): readonly unknown[] =>
  nodes.flatMap((node): readonly unknown[] => {
    if (node.kind === 'text') {
      const text = node.text.trim()
      return text === '' ? [] : [text]
    }
    if (UNDRAWN_TAGS.has(node.tag)) return []
    // The prototype's own wrapper is set aside, what it wraps kept.
    if (isPrototypeMarkup(node)) return lockedDrawingOf(slotted, node.children)
    const type = slotted(node)
    if (type !== undefined) return [{ slotted: type }]
    // A session template's text is filled from the signed-in person, never drawn.
    const children =
      node.attributes['data-session-template'] === undefined
        ? node.children
        : node.children.filter((child) => child.kind !== 'text')
    return [
      {
        tag: node.tag,
        attributes: drawnAttributesOf(node),
        children: lockedDrawingOf(slotted, children),
      },
    ]
  })

/**
 * A locked node's digest: its own attributes, then what it draws inside. It
 * is ADDITIVE: a prototype may add its own markup over a board without
 * editing the export, which the comparison sets aside.
 *
 * @param element - the locked node's element.
 * @param slotted - the type of a slotted page node, which stands in by it alone.
 */
export const lockedDigestOf = (element: HtmlElementNode, slotted: SlottedTypeOf): string =>
  JSON.stringify({
    additive: true,
    attributes: drawnAttributesOf(element),
    children: lockedDrawingOf(slotted, element.children),
  })
