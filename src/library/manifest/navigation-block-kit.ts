/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parts the navigation blocks and the mirrored shadcn/ui sidebar blocks
 * (`sidebar-01`, `-03`, `-06`, `-10`, `-13`, `-16`) compose from.
 *
 * Each helper returns plain config built from existing component types and
 * shadcn's token utilities, spelled the way base-nova's `ui/sidebar.tsx`,
 * `ui/button.tsx` and `ui/breadcrumb.tsx` spell them, so a block reads as the
 * shadcn block it mirrors and follows whatever `design` the app declares.
 *
 * WHAT IS COMPOSED RATHER THAN NATIVE: the `sidebar` component draws the
 * content of shadcn's Sidebar — its groups, rows, badges and nested lists —
 * at the non-collapsing default. Shadcn's `SidebarHeader` and `SidebarFooter`
 * sit above and below that content, and the `sidebar` component draws its
 * authored children only AFTER its groups, so the frame around them is a
 * container on the sidebar ground: the header, the `sidebar` (the content),
 * then the footer, in reading order.
 */

import type { BlockNode } from './block-kit'

/** What every mirrored sidebar block says about how it behaves. */
export const SIDEBAR_NOTES: readonly string[] = [
  'Place it on a page with `component: <name>`. It fills the page: the sidebar on the left, the main region beside it.',
  'Colours come from the `sidebar` roles of your `design` (`sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border`, `sidebar-primary`), so the block follows it without edits.',
  'Entries mark themselves current from the request path. Edit `groups` in the installed fragment to list your own pages.',
  'Below the medium breakpoint the navigation folds into a sheet a menu button opens, and the header and footer rows of the sidebar are left out. There is no collapse toggle: from the medium breakpoint up the sidebar stays open.',
]

// ─── Buttons drawn on links ────────────────────────────────────────────────

/** base-nova's `buttonVariants` base: a link drawn as shadcn's Button. */
const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap no-underline transition-all outline-none select-none hover:no-underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0'

const BUTTON_VARIANT = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground',
  outline: 'border-border bg-background text-foreground hover:bg-muted hover:text-foreground',
  ghost: 'text-foreground hover:bg-muted hover:text-foreground',
} as const

const BUTTON_SIZE = {
  default: 'h-8 px-2.5',
  lg: 'h-9 px-2.5',
  icon: 'size-8',
} as const

export type ShadcnButtonVariant = keyof typeof BUTTON_VARIANT

/**
 * A link drawn as shadcn's Button. A `button` has no DOM `href`, so anything
 * that GOES somewhere is a `link` wearing the button's classes.
 */
export const buttonLink = (
  label: string,
  href: string,
  options: {
    readonly variant?: ShadcnButtonVariant
    readonly size?: Exclude<keyof typeof BUTTON_SIZE, 'icon'>
    readonly extra?: string
  } = {}
): BlockNode => ({
  type: 'link',
  props: {
    href,
    className:
      `${BUTTON_BASE} ${BUTTON_VARIANT[options.variant ?? 'default']} ${BUTTON_SIZE[options.size ?? 'default']} ${options.extra ?? ''}`.trim(),
  },
  content: label,
})

/** A square ghost Button on a link, named for a reader who sees only its glyph. */
export const iconButtonLink = (iconName: string, label: string, href: string): BlockNode => ({
  type: 'link',
  props: {
    href,
    'aria-label': label,
    className: `${BUTTON_BASE} ${BUTTON_VARIANT.ghost} ${BUTTON_SIZE.icon}`,
  },
  children: [{ type: 'icon', props: { name: iconName, size: 16 } }],
})

// ─── Sidebar frame ─────────────────────────────────────────────────────────

/**
 * The sidebar ground: base-nova's `Sidebar` at 16rem with the `sidebar`
 * variant's edge. Below the medium breakpoint the frame is a band across the
 * top holding the drawer's menu button, because the `sidebar` inside folds
 * into a sheet there.
 */
const FRAME_CLASS =
  'flex w-full flex-none flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:w-64 md:border-r md:border-b-0'

/** `SidebarHeader` / `SidebarFooter`: a padded column, folded away on a phone. */
const EDGE_CLASS = 'hidden flex-col gap-2 p-2 md:flex'

/** A row of `size: lg` — the brand, a switcher, the account. */
const LARGE_ROW_CLASS =
  'flex h-12 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground no-underline ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-0! [&_svg]:size-4 [&_svg]:shrink-0'

/** A default-size row drawn outside the `sidebar` component. */
export const ROW_CLASS =
  'flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0'

/**
 * Appended to a row that opens a menu: the menu trigger draws its own chevron
 * as its last direct child, and a sidebar row shows only the glyph the block
 * composed (shadcn's chevrons-up-down or ellipsis).
 */
export const OWN_GLYPH_ONLY = '[&>svg]:hidden'

export type SidebarGroups = readonly Readonly<Record<string, unknown>>[]

/**
 * The `sidebar` component as shadcn's `SidebarContent`: the groups, scrolling
 * inside the frame, folding into a drawer below the medium breakpoint.
 */
export const sidebarContent = (groups: SidebarGroups, extra = ''): BlockNode => ({
  type: 'sidebar',
  drawer: { below: 'md', label: 'Menu' },
  props: { className: `min-h-0 flex-1 overflow-y-auto ${extra}`.trim() },
  groups,
})

/**
 * The same content box holding authored rows instead of `groups` — for rows the
 * groups cannot draw, such as a row opening a menu. They sit in a named `nav`
 * and fold into the drawer with the rest.
 */
export const sidebarContentRows = (label: string, rows: readonly BlockNode[]): BlockNode => ({
  type: 'sidebar',
  drawer: { below: 'md', label: 'Menu' },
  props: { className: 'min-h-0 flex-1 overflow-y-auto' },
  children: [
    {
      type: 'container',
      element: 'nav',
      props: { 'aria-label': label, className: 'flex w-full min-w-0 flex-col p-2' },
      children: rows,
    },
  ],
})

/** `SidebarHeader` or `SidebarFooter`. */
export const sidebarEdge = (children: readonly BlockNode[], extra = ''): BlockNode => ({
  type: 'container',
  props: { className: `${EDGE_CLASS} ${extra}`.trim() },
  children,
})

/** The whole sidebar: an optional header, the content, an optional footer. */
export const sidebarFrame = (
  content: BlockNode,
  edges: { readonly header?: readonly BlockNode[]; readonly footer?: readonly BlockNode[] } = {},
  extra = ''
): BlockNode => ({
  type: 'container',
  element: 'aside',
  props: { className: `${FRAME_CLASS} ${extra}`.trim() },
  children: [
    ...(edges.header === undefined ? [] : [sidebarEdge(edges.header)]),
    content,
    ...(edges.footer === undefined ? [] : [sidebarEdge(edges.footer)]),
  ],
})

/** The square mark at the start of a large row, on the sidebar's primary. */
const mark = (iconName: string): BlockNode => ({
  type: 'container',
  props: {
    className:
      'flex aspect-square size-8 flex-none items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
    'aria-hidden': 'true',
  },
  children: [{ type: 'icon', props: { name: iconName, size: 16 } }],
})

/** Two stacked lines: a medium title and a quiet second line. */
const twoLines = (title: string, subtitle: string): BlockNode => ({
  type: 'flex',
  props: { className: 'flex min-w-0 flex-1 flex-col gap-0.5 leading-none' },
  children: [
    { type: 'text', element: 'span', props: { className: 'truncate font-medium' }, content: title },
    { type: 'text', element: 'span', props: { className: 'truncate text-xs' }, content: subtitle },
  ],
})

/** The brand row of a `SidebarHeader`: a mark, the name and a second line, linking home. */
export const brandRow = (
  title: string,
  subtitle: string,
  iconName: string,
  href = '/'
): BlockNode => ({
  type: 'link',
  props: { href, className: LARGE_ROW_CLASS },
  children: [mark(iconName), twoLines(title, subtitle)],
})

export type SwitcherItem = readonly [label: string, path: string]

/**
 * A large row that opens a menu — shadcn's version and team switchers. The
 * trigger is composed, so its accessible name stays `label`.
 */
export const switcherRow = (
  label: string,
  row: { readonly title: string; readonly subtitle: string; readonly icon: string },
  items: readonly SwitcherItem[]
): BlockNode => ({
  type: 'dropdown-menu',
  triggerLabel: label,
  props: { className: `${LARGE_ROW_CLASS} ${OWN_GLYPH_ONLY}` },
  menuItems: items.map(([itemLabel, path]) => ({
    label: itemLabel,
    action: { type: 'navigate', path },
  })),
  children: [
    mark(row.icon),
    twoLines(row.title, row.subtitle),
    { type: 'icon', props: { name: 'chevrons-up-down', size: 16, className: 'ml-auto' } },
  ],
})

/** shadcn's `NavUser`: the account at the foot of the sidebar, opening its menu. */
export const userRow = (name: string, email: string, initials: string): BlockNode => ({
  type: 'dropdown-menu',
  triggerLabel: 'Account',
  props: { className: `${LARGE_ROW_CLASS} ${OWN_GLYPH_ONLY}` },
  menuItems: [
    { label: 'Account', icon: 'badge-check', action: { type: 'navigate', path: '/account' } },
    { label: 'Billing', icon: 'credit-card', action: { type: 'navigate', path: '/billing' } },
    {
      label: 'Notifications',
      icon: 'bell',
      action: { type: 'navigate', path: '/notifications' },
    },
    { separator: true },
    { label: 'Log out', icon: 'log-out', action: { type: 'auth', method: 'logout' } },
  ],
  children: [
    { type: 'avatar', label: name, initials, size: 'default', shape: 'square' },
    twoLines(name, email),
    { type: 'icon', props: { name: 'chevrons-up-down', size: 16, className: 'ml-auto' } },
  ],
})

/** A search box in the sidebar header (`SidebarInput`). */
export const sidebarSearch = (placeholder: string, extra = ''): BlockNode => ({
  type: 'search-input',
  scope: 'page',
  placeholder,
  props: { 'aria-label': 'Search', className: `w-full ${extra}`.trim() },
})

// ─── The inset beside the sidebar ──────────────────────────────────────────

export type Crumb = readonly [label: string, href?: string]

/** The trail in the inset's header, a chevron between crumbs. */
export const crumbs = (items: readonly Crumb[]): BlockNode => ({
  type: 'breadcrumb',
  separator: '›',
  breadcrumbItems: items.map(([label, href]) => (href === undefined ? { label } : { label, href })),
})

/** The bar across the top of the inset: 64px with a hairline under it. */
export const insetHeader = (children: readonly BlockNode[], extra = ''): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className: `flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 ${extra}`.trim(),
  },
  children,
})

/** A quiet placeholder tile, as shadcn's blocks draw the content they leave to you. */
export const tile = (extra: string): BlockNode => ({
  type: 'container',
  props: { className: `rounded-xl bg-muted/50 ${extra}`.trim() },
})

/** shadcn's demo content: three tiles over a tall one. */
export const placeholderContent = (): BlockNode => ({
  type: 'flex',
  props: { className: 'flex flex-1 flex-col gap-4 p-4' },
  children: [
    {
      type: 'grid',
      props: { className: 'grid auto-rows-min gap-4 md:grid-cols-3' },
      children: [tile('aspect-video'), tile('aspect-video'), tile('aspect-video')],
    },
    tile('min-h-96 flex-1'),
  ],
})

/** `SidebarInset`: the main region beside the sidebar. */
export const sidebarInset = (children: readonly BlockNode[], extra = ''): BlockNode => ({
  type: 'container',
  element: 'div',
  props: { className: `flex min-w-0 flex-1 flex-col bg-background ${extra}`.trim() },
  children,
})

/**
 * `SidebarProvider`: the sidebar and its inset side by side, stacked on a phone,
 * as tall as the viewport unless a header above it takes part of it.
 */
export const sidebarLayout = (
  children: readonly BlockNode[],
  minHeight = 'min-h-svh'
): BlockNode => ({
  type: 'flex',
  props: {
    className: `flex ${minHeight} w-full flex-col items-stretch md:flex-row`,
  },
  children,
})
