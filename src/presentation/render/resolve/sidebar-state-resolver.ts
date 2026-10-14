/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Page } from '@/domain/models/app/pages'

/** The cookie a folded sidebar is remembered in (shadcn/ui's name), written by the fold runtime. */
const SIDEBAR_STATE_COOKIE = 'sidebar_state'

type Node = Readonly<Record<string, unknown>>

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A sidebar whose fold survives a reload: it folds, and its `persist` is not `none`. */
const remembersFold = (node: Node): boolean =>
  node['type'] === 'sidebar' &&
  (node['collapsible'] === 'icon' || node['collapsible'] === 'offcanvas') &&
  node['persist'] !== 'none'

/**
 * The side whose top corner a sidebar's phone menu button is drawn at, or
 * `undefined` when it draws none there: a SHELL sidebar (it folds, stands on
 * the right, or is framed) that folds into a drawer.
 */
const cornerSide = (node: Node): string | undefined => {
  if (node['type'] !== 'sidebar' || !isNode(node['drawer'])) return undefined
  const folds = node['collapsible'] === 'icon' || node['collapsible'] === 'offcanvas'
  const framed = node['variant'] !== undefined && node['variant'] !== 'sidebar'
  const side = node['side'] === 'right' ? 'right' : 'left'
  return folds || framed || side === 'right' ? side : undefined
}

/** How many corner menu buttons each side already holds, in document order. */
type Slots = Readonly<Record<string, number>>

interface Stamped {
  readonly components: readonly unknown[]
  readonly slots: Slots
  /** Whether a node took a stamp, so an unstamped page is served as it came. */
  readonly stamped: boolean
}

/** The node's own stamps: its fold, and its corner slot past the first. */
const ownStamps = (folded: boolean, slot: number): Record<string, unknown> => ({
  ...(folded ? { _collapsed: true } : {}),
  ...(slot > 0 ? { _drawerSlot: slot } : {}),
})

/** The node's children walked after it, or `undefined` when it has none. */
const walkChildren = (component: Node, collapsed: boolean, slots: Slots): Stamped | undefined =>
  Array.isArray(component['children'])
    ? stampAll(component['children'], collapsed, slots)
    : undefined

/** The corner slot a node takes on its side, and the count it leaves behind. */
const takeSlot = (
  side: string | undefined,
  slots: Slots
): { readonly slot: number; readonly afterSelf: Slots } => {
  if (side === undefined) return { slot: 0, afterSelf: slots }
  const slot = slots[side] ?? 0
  return { slot, afterSelf: { ...slots, [side]: slot + 1 } }
}

/** One node stamped: its fold, its corner slot, and its children walked after it. */
function stampNode(component: Node, collapsed: boolean, slots: Slots): Stamped {
  const { slot, afterSelf } = takeSlot(cornerSide(component), slots)
  const inner = walkChildren(component, collapsed, afterSelf)
  const folded = collapsed && remembersFold(component)
  const children = inner === undefined ? {} : { children: inner.components }
  return {
    stamped: folded || slot > 0 || inner?.stamped === true,
    components: [{ ...component, ...children, ...ownStamps(folded, slot) }],
    slots: inner?.slots ?? afterSelf,
  }
}

/** Stamp every sidebar in a component list, nested children included, in document order. */
const stampAll = (components: readonly unknown[], collapsed: boolean, slots: Slots): Stamped =>
  components.reduce<Stamped>(
    (acc, component) => {
      const next = isNode(component)
        ? stampNode(component, collapsed, acc.slots)
        : { components: [component], slots: acc.slots, stamped: false }
      return {
        components: [...acc.components, ...next.components],
        slots: next.slots,
        stamped: acc.stamped || next.stamped,
      }
    },
    { components: [], slots, stamped: false }
  )

/**
 * Serve a folded sidebar folded: the state cookie the fold runtime writes is
 * read here, on the server, so a reader who folded the navigation is sent a
 * page whose sidebar is already folded — no expanded first paint that snaps
 * shut once a script runs.
 *
 * The same walk numbers the phone menu buttons drawn at one corner: a second
 * shell sidebar folding into a drawer on the same side (a page's own sidebar
 * beside an app sidebar) takes the next slot along that corner rather than the
 * first one's place, so neither button covers the other.
 */
export function resolveSidebarState(
  page: Page,
  cookies: Readonly<Record<string, string>> | undefined
): Page {
  const collapsed = cookies?.[SIDEBAR_STATE_COOKIE] === 'false'
  if (page.components === undefined) return page
  const walked = stampAll(page.components, collapsed, {})
  return walked.stamped ? { ...page, components: walked.components as Page['components'] } : page
}
