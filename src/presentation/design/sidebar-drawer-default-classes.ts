/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui sidebar (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The phone drawer of a sidebar (`sidebar.drawer: { below }`), as a leaf module:
 * the menu button (`sidebar-trigger`), the inline body it hides and the modal
 * panel it opens. `sidebar-default-classes.ts` re-exports every computer here.
 */

import type { SidebarRailBreakpoint } from './sidebar-default-classes'

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR DRAWER — `sidebar.drawer: { below }`, and the docs navigation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The two breakpoint-keyed class lists a drawer needs.
 *
 * `body` takes the sidebar out of the layout below the breakpoint and `trigger`
 * takes the menu button out above it. Both are `display: none` rather than
 * off-screen: a role query, a screen reader and the tab order all skip a
 * `display: none` subtree, so "the sidebar is not here" is true for every
 * reader at once — and the breakpoint is a CSS media query rather than a
 * render-time decision, so one page narrowed or widened in place switches with
 * no reload.
 *
 * Spelled literally for the reason the rail's rows in `sidebar-default-classes.ts` are: the CSS compiler
 * harvests its candidates from the source text.
 */
const DRAWER_CLASSES: Record<
  SidebarRailBreakpoint,
  { readonly trigger: string; readonly body: string }
> = {
  sm: { trigger: 'sm:hidden', body: 'max-sm:hidden' },
  md: { trigger: 'md:hidden', body: 'max-md:hidden' },
  lg: { trigger: 'lg:hidden', body: 'max-lg:hidden' },
  xl: { trigger: 'xl:hidden', body: 'max-xl:hidden' },
  '2xl': { trigger: '2xl:hidden', body: 'max-2xl:hidden' },
}

/**
 * The menu button (`sidebar-trigger`): base-nova's ghost button carrying the
 * panel glyph. It keeps its visible name (`drawer.label`) beside the glyph,
 * where base-nova's trigger is a glyph alone.
 */
const SIDEBAR_DRAWER_TRIGGER_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[icon=inline-start]:pl-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/**
 * The drawer panel: a native modal `<dialog>` pinned to the start edge at full
 * height, 18 rem wide as base-nova's mobile sidebar is, on the sidebar ground,
 * over base-nova's sheet scrim.
 *
 * Open, it is a column — header, then the navigation's own node filling the
 * rest — so the sidebar keeps its desktop anatomy inside: the close button and
 * the footer stay in view and only the groups scroll. `open:flex` rather than
 * `flex`, because a display class would override the user agent's `display:
 * none` on a CLOSED dialog.
 *
 * `m-0` and `max-h-none` undo the user-agent centring of a modal dialog; the
 * width leaves a strip of the page visible beside the panel, which is both the
 * reader's cue that the page is still there and the backdrop they tap to leave.
 */
const SIDEBAR_DRAWER_PANEL_CLASS =
  'm-0 h-full max-h-none w-72 max-w-[85vw] flex-col overflow-hidden open:flex border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-lg backdrop:bg-black/10'

/** Compute the className for the menu button: shown only below the breakpoint. */
export const computeSidebarDrawerTriggerClasses = (below: SidebarRailBreakpoint): string =>
  `${SIDEBAR_DRAWER_TRIGGER_CLASS} ${DRAWER_CLASSES[below].trigger}`

/**
 * Compute the className for the inline sidebar body: out of the layout below
 * the breakpoint, and `display: contents` at and above it — the wrapper exists
 * only so the drawer has one node to lift its children from, so it must not
 * become a box of its own that re-flows what the sidebar laid out before it.
 */
export const computeSidebarDrawerBodyClasses = (below: SidebarRailBreakpoint): string =>
  `contents ${DRAWER_CLASSES[below].body}`

/** Compute the className for the drawer panel (`<dialog>`). */
export const computeSidebarDrawerPanelClasses = (): string => SIDEBAR_DRAWER_PANEL_CLASS

/**
 * The drawer's header row: its close button at the end edge, above the
 * navigation, on the sidebar ground.
 */
export const computeSidebarDrawerHeaderClasses = (): string =>
  'flex shrink-0 items-center justify-end p-2'

/**
 * The node the navigation moves into: the rest of the panel's height. A
 * sidebar's surface fills it and scrolls its own groups; anything taller with
 * no scroller of its own (the docs navigation) scrolls here.
 */
export const computeSidebarDrawerContentClasses = (): string =>
  'flex min-h-0 flex-1 flex-col overflow-y-auto'

/**
 * The rule above a sidebar's footer, drawn only inside the drawer (`in-[dialog]`):
 * in a full-height panel the footer can sit right under the last entry, and the
 * rule sets the reader's account apart from the navigation. Inline, the footer
 * is pinned at the panel's foot and needs none. base-nova's `SidebarSeparator`.
 */
export const computeSidebarDrawerSeparatorClasses = (): string =>
  'mx-2 hidden h-px shrink-0 bg-sidebar-border in-[dialog]:block'
