/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the footer badge goes on a page laid out as a window-high shell.
 *
 * `badge: { placement: footer }` draws the badge as a `<footer>` line after
 * `<main>`. On a page whose content is a shell exactly one window high — a
 * `flex h-screen overflow-hidden` row of a sidebar column beside an inset that
 * scrolls on its own — that line lands BELOW the shell: the document grows a
 * second scroll that shows the badge alone under an app already filling the
 * window. So on such a page the footer closes the scrolling inset instead: it
 * is the inset's last child, in its flow, reached by scrolling the inset to its
 * end, below its last content and overlapping nothing.
 *
 * Decided here, at render time, rather than in CSS or in the browser:
 *  - CSS cannot move an element into another one — a `:has()` rule can restyle
 *    the line after `<main>`, but only by pinning it over the shell (it would
 *    cover the inset's last row) or by squeezing the shell below a window high
 *    (it would stop being the window-high layout its author wrote);
 *  - the badge is pure SSR with no client script, and stays so.
 *
 * The shell is recognised the way its author wrote it, on its unprefixed
 * utility classes: a window-high height (`h-screen`, `h-dvh`, `h-svh`,
 * `h-lvh`) with its overflow clipped (`overflow-hidden`, `overflow-clip`). Its
 * inset is the outermost descendant that scrolls vertically (`overflow-auto`,
 * `overflow-y-auto`, `overflow-scroll`, `overflow-y-scroll`) — the one that
 * grows (`flex-1`, `grow`) when a sidebar scrolls too, else the last. The page
 * is read with its references already resolved — a file `$ref` when the config
 * is loaded, a component-template `$ref` (`app.components`) before the page is
 * rendered — so a shell placed from a shared file or template is recognised as
 * one written inline. A page with no such shell keeps its footer after
 * `<main>`.
 */

import type { BadgePlacement } from './badge-placement'

/**
 * The render-time marker the container renderer reads to close the inset with
 * the footer badge. Private to the renderer, like `_openDrawerDispatchedById`.
 */
export const BADGE_FOOTER_KEY = '_badgeFooter'

type Node = Readonly<Record<string, unknown>>

const WINDOW_HIGH: ReadonlySet<string> = new Set(['h-screen', 'h-dvh', 'h-svh', 'h-lvh'])
const CLIPPED: ReadonlySet<string> = new Set(['overflow-hidden', 'overflow-clip'])
const SCROLLS: ReadonlySet<string> = new Set([
  'overflow-auto',
  'overflow-y-auto',
  'overflow-scroll',
  'overflow-y-scroll',
])
const GROWS: ReadonlySet<string> = new Set(['flex-1', 'grow', 'flex-grow', 'flex-auto'])

/** A node's unprefixed utility classes — a `max-md:` variant is not the base layout. */
const classesOf = (node: Node): ReadonlySet<string> => {
  const props = node['props'] as Node | undefined
  const className = props?.['className']
  return new Set(typeof className === 'string' ? className.split(/\s+/) : [])
}

const hasAny = (classes: ReadonlySet<string>, wanted: ReadonlySet<string>): boolean =>
  [...wanted].some((name) => classes.has(name))

const isShell = (node: Node): boolean => {
  const classes = classesOf(node)
  return hasAny(classes, WINDOW_HIGH) && hasAny(classes, CLIPPED)
}

const scrolls = (node: Node): boolean => hasAny(classesOf(node), SCROLLS)

/** A node's component children, its text children left out. */
const childrenOf = (node: Node): readonly Node[] => {
  const { children } = node
  return Array.isArray(children)
    ? children.filter((child): child is Node => typeof child === 'object' && child !== null)
    : []
}

/** The outermost scrolling descendants of a node, in document order. */
const outermostScrollers = (node: Node): readonly Node[] =>
  childrenOf(node).flatMap((child) => (scrolls(child) ? [child] : outermostScrollers(child)))

/** The first window-high shell of a list of nodes, depth first. */
const firstShell = (nodes: readonly Node[]): Node | undefined =>
  nodes.reduce<Node | undefined>(
    (found, node) => found ?? (isShell(node) ? node : firstShell(childrenOf(node))),
    undefined
  )

/** The shell's scrolling inset — see the module note — or nothing. */
export function findShellInset(nodes: readonly unknown[]): Node | undefined {
  const objects = nodes.filter((node): node is Node => typeof node === 'object' && node !== null)
  const shell = firstShell(objects)
  if (shell === undefined) return undefined
  const scrollers = outermostScrollers(shell)
  return scrollers.find((scroller) => hasAny(classesOf(scroller), GROWS)) ?? scrollers.at(-1)
}

/** A copy of `node` whose `target` descendant carries the marker. */
const markWithin = (node: unknown, target: Node): unknown => {
  if (node === target) return { ...target, [BADGE_FOOTER_KEY]: true }
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as Node
  if (!Array.isArray(children)) return node
  return { ...node, children: children.map((child: unknown) => markWithin(child, target)) }
}

/**
 * The page's components with the shell inset marked to close with the footer
 * badge, or `undefined` when the page is no window-high shell — the footer then
 * stays after `<main>`.
 */
export function markShellInsetForBadge<T>(components: readonly T[]): readonly T[] | undefined {
  const inset = findShellInset(components)
  if (inset === undefined) return undefined
  return components.map((component) => markWithin(component, inset) as T)
}

/** Whether a component is the inset marked to close with the footer badge. */
export const closesWithBadge = (component: unknown): boolean =>
  typeof component === 'object' &&
  component !== null &&
  (component as Node)[BADGE_FOOTER_KEY] === true

/**
 * Where a page's footer badge goes: on a window-high shell, into its inset —
 * the page's components marked and no footer after `<main>` — else unchanged.
 */
export function placeFooterBadge<P extends { readonly components: readonly unknown[] }>(
  page: P,
  placement: BadgePlacement | undefined
): { readonly page: P; readonly badgePlacement: BadgePlacement | undefined } {
  const marked = placement === 'footer' ? markShellInsetForBadge(page.components) : undefined
  return marked === undefined
    ? { page, badgePlacement: placement }
    : { page: { ...page, components: marked }, badgePlacement: undefined }
}
