/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'

/**
 * A `container` drawn as an HTML list nests the way HTML does: the direct
 * children of a `ul` or `ol` container are `li` containers, and an `li`
 * container sits only directly in a `ul` or `ol` one.
 *
 * ## Why refused rather than drawn
 *
 * The browser draws either mistake without complaint, and both are wrong in
 * the one place nobody looks: a screen reader announces a list of a number of
 * items that does not match what is on screen, or an item that belongs to no
 * list at all. Nothing on the page says why, so the config is refused where it
 * is read, with the path of the node to move.
 *
 * ## What counts as an item
 *
 * An `li` container, or a placement of a component template whose root is an
 * `li` container: the placement draws exactly that `li`, so a list may hold it,
 * and it may not sit outside one. A template ROOT that is an `li` is not judged
 * where it is declared; it is judged at each place it is placed. A placement
 * naming no template is left to the rule that refuses it.
 *
 * ## Why a walk of its own
 *
 * The rule is about a node's PARENT, which the shared located walk does not
 * carry. This walk descends every array and object value of the pages and the
 * templates, like that one, and tells a list container's own `children` (and
 * each `responsive` breakpoint's) apart from everything else under it.
 *
 * Runs at the one decode boundary every seam rides (`decodeAppConfigObject` →
 * `runSemanticChecks`), so boot, `sovrium validate` and a watch reload reach
 * the same verdict. Pure: no I/O.
 */

/** The element a node draws when it is a `container`, or `undefined`. */
const containerElementOf = (node: Raw): string | undefined =>
  node['type'] === 'container' && typeof node['element'] === 'string' ? node['element'] : undefined

/** The template name a node places, in the `component` or `$ref` form, or `undefined`. */
const placedNameOf = (node: Raw): string | undefined => {
  if (node['type'] !== undefined) return undefined
  const name = node['component'] ?? node['$ref']
  return typeof name === 'string' ? name : undefined
}

/** What the walk needs to know about the app: each template's root, by name. */
type TemplateRoots = ReadonlyMap<string, Raw>

/** Whether a node draws an `li`: an `li` container, or a placement of a template rooted on one. */
const drawsItem = (node: Raw, roots: TemplateRoots): boolean => {
  if (containerElementOf(node) === 'li') return true
  const placed = placedNameOf(node)
  const root = placed === undefined ? undefined : roots.get(placed)
  return root !== undefined && containerElementOf(root) === 'li'
}

/** Whether a node is a placement naming no declared template (judged by another rule). */
const placesUnknownTemplate = (node: Raw, roots: TemplateRoots): boolean => {
  const placed = placedNameOf(node)
  return placed !== undefined && !roots.has(placed)
}

/** How a list's refused child is named in the sentence. */
const describeChild = (child: unknown): string => {
  if (!isRecord(child)) return 'a text'
  const placed = placedNameOf(child)
  if (placed !== undefined) return `a placement of the template \`${placed}\``
  const element = containerElementOf(child)
  if (element !== undefined) return `a \`container\` drawn as "${element}"`
  return typeof child['type'] === 'string' ? `a \`${child['type']}\`` : 'a node'
}

const childPath = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`)

interface WalkContext {
  readonly roots: TemplateRoots
}

/** The refusal for a list's direct child that does not draw an `li`. */
const notAnItem = (
  child: unknown,
  path: string,
  list: string,
  ctx: WalkContext
): readonly string[] => {
  if (isRecord(child) && (drawsItem(child, ctx.roots) || placesUnknownTemplate(child, ctx.roots)))
    return []
  return [
    `${path}: a "${list}" container holds only "li" containers, and this is ${describeChild(child)}. Wrap it in a container with element "li", or move it out of the list.`,
  ]
}

/** The refusal for an `li` that is not a list's direct child. */
const strayItem = (node: Raw, path: string, ctx: WalkContext): readonly string[] =>
  drawsItem(node, ctx.roots)
    ? [
        `${path}: an "li" container must be a direct child of a "ul" or "ol" container, and this one is not. Place it inside a list, or draw it with another element.`,
      ]
    : []

/**
 * Where a node sits: directly in a list (`ul` / `ol`), anywhere else
 * (`outside`), at the root of a template (`template`, judged where it is
 * placed rather than where it is declared), or among a placement's slotted
 * components (`slot`, whose parent is wherever the template wrote its slot).
 */
type Parent = 'ul' | 'ol' | 'outside' | 'template' | 'slot'

const isList = (parent: Parent): parent is 'ul' | 'ol' => parent === 'ul' || parent === 'ol'

/** The list a node's own `children` sit in, or `outside`. */
const listOf = (node: Raw): Parent => {
  const element = containerElementOf(node)
  return element === 'ul' || element === 'ol' ? element : 'outside'
}

/** Every refusal under `value`, which sits under `parent`. */
const walk = (
  value: unknown,
  path: string,
  parent: Parent,
  ctx: WalkContext
): readonly string[] => {
  if (Array.isArray(value))
    return value.flatMap((item, index) => {
      const at = `${path}[${String(index)}]`
      return [
        ...(isList(parent) ? notAnItem(item, at, parent, ctx) : []),
        ...walk(item, at, parent, ctx),
      ]
    })
  if (!isRecord(value)) return []
  const own = parent === 'outside' ? strayItem(value, path, ctx) : []
  return [...own, ...descend(value, path, listOf(value), ctx)]
}

/**
 * The refusals under a node's values. Its `children` sit under `childParent`
 * (the list it is, or `outside`), and so do a list's `responsive` breakpoints'
 * `children`; a placement's `children` and `slots` fill the template's slots.
 */
const descend = (
  node: Raw,
  path: string,
  childParent: Parent,
  ctx: WalkContext
): readonly string[] => {
  const placement = placedNameOf(node) !== undefined
  return Object.entries(node).flatMap(([key, child]) => {
    const at = childPath(path, key)
    if (key === 'children') return walk(child, at, placement ? 'slot' : childParent, ctx)
    if (key === 'slots' && placement && isRecord(child))
      return Object.entries(child).flatMap(([name, items]) =>
        walk(items, childPath(at, name), 'slot', ctx)
      )
    if (key === 'responsive' && isList(childParent) && isRecord(child))
      return Object.entries(child).flatMap(([breakpoint, variant]) =>
        isRecord(variant) ? descend(variant, childPath(at, breakpoint), childParent, ctx) : []
      )
    return walk(child, at, 'outside', ctx)
  })
}

/** Each declared template's root node, by its name. */
const templateRootsOf = (components: unknown): TemplateRoots =>
  new Map(
    (Array.isArray(components) ? components : []).flatMap((template: unknown) =>
      isRecord(template) && typeof template['name'] === 'string'
        ? [[template['name'], template] as const]
        : []
    )
  )

/**
 * Every list container holding something other than an item, and every item
 * outside a list, in the pages and in the component templates.
 *
 * @param config - The parsed config object, before or after decoding.
 * @returns One message per misplaced node, naming its path; empty when every list nests.
 */
export const validateListNesting = (config: unknown): readonly string[] => {
  if (!isRecord(config)) return []
  const ctx: WalkContext = { roots: templateRootsOf(config['components']) }
  const templates = Array.isArray(config['components']) ? config['components'] : []
  return [
    ...walk(config['pages'], 'pages', 'outside', ctx),
    ...templates.flatMap((template, index) =>
      walk(template, `components[${String(index)}]`, 'template', ctx)
    ),
  ]
}
