/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The parts the mirrored shadcn/ui sidebar blocks that FOLD, FLOAT or stand on
 * the RIGHT compose from (`sidebar-02`, `-04`, `-05`, `-07`, `-08`,
 * `-12`, `-14`, `-15`, and the frame of `dashboard-01`).
 *
 * Unlike the frame in `navigation-block-kit.ts`, these use the `sidebar`
 * component's own shell: `collapsible`, `variant`, `side`, `railHandle`,
 * `trigger`, and its `header` and `footer` slots. So the header and footer sit
 * inside the folding sidebar, and fold with it.
 *
 * The demo content is shadcn's own (Acme Inc, the Playground / Models /
 * Documentation / Settings sections, three projects, the `shadcn` account), so
 * a block reads as the block it mirrors until its fragment is edited.
 */

import type { BlockNode } from './block-kit'

export type ShellGroups = readonly Readonly<Record<string, unknown>>[]

export interface ShellOptions {
  readonly collapsible?: 'none' | 'icon' | 'offcanvas'
  readonly variant?: 'sidebar' | 'floating' | 'inset'
  readonly side?: 'left' | 'right'
  readonly railHandle?: boolean
  readonly header?: readonly BlockNode[]
  readonly footer?: readonly BlockNode[]
  readonly groups?: ShellGroups
  readonly children?: readonly BlockNode[]
  readonly extra?: string
  /** The phone menu button's name; two sidebars on one page need two names. */
  readonly drawerLabel?: string
}

/** What every folding sidebar block says about how it behaves. */
export const SHELL_NOTES: readonly string[] = [
  'Place it on a page with `component: <name>`. It fills the page: the sidebar and the main region beside it.',
  'Colours come from the `sidebar` roles of your `design`, so the block follows it without edits.',
  'The fold is remembered in the `sidebar_state` cookie, so a reload serves the page already folded. Control or Command with B folds it too.',
  'Below the medium breakpoint the navigation folds into a sheet a menu button opens. Edit `groups` in the installed fragment to list your own pages.',
]

/** The options that pass through as they are, when set. */
const PASSED = ['collapsible', 'variant', 'side', 'header', 'footer', 'groups', 'children'] as const

/** Whether the sidebar folds, and so draws its trigger. */
const folds = (options: ShellOptions): boolean =>
  options.collapsible !== undefined && options.collapsible !== 'none'

/** The `sidebar` component with its shell keys, folding into a drawer on a phone. */
export const shellSidebar = (options: ShellOptions): BlockNode => ({
  type: 'sidebar',
  drawer: { below: 'md', label: options.drawerLabel ?? 'Menu' },
  ...Object.fromEntries(
    PASSED.filter((key) => options[key] !== undefined).map((key) => [key, options[key]])
  ),
  ...(folds(options) ? { trigger: { label: 'Toggle sidebar' } } : {}),
  ...(options.railHandle === true ? { railHandle: true } : {}),
  ...(options.extra === undefined ? {} : { props: { className: options.extra } }),
})

const SHELL_HEADER_PADDING = {
  left: 'pr-4 pl-11',
  right: 'pr-11 pl-4',
  both: 'px-11',
} as const

/**
 * The bar across the top of the inset. The sidebar's own fold trigger is drawn
 * at the top of the inset, beside the sidebar's edge, so the bar is the
 * trigger's height and leaves it room on that side.
 */
export const shellHeader = (
  children: readonly BlockNode[],
  side: 'left' | 'right' | 'both' = 'left'
): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className: `flex h-11 shrink-0 items-center gap-2 border-b border-border ${SHELL_HEADER_PADDING[side]}`,
  },
  children,
})

/** `SidebarInset`; the `inset` variant raises it as a rounded panel on the sidebar ground. */
export const shellInset = (children: readonly BlockNode[], inset = false): BlockNode => ({
  type: 'container',
  element: 'div',
  props: {
    className: inset
      ? 'm-2 flex min-w-0 flex-1 flex-col rounded-xl bg-background shadow-sm md:ml-0'
      : 'flex min-w-0 flex-1 flex-col bg-background',
  },
  children,
})

/** `SidebarProvider`: the sidebar and the inset side by side, stacked on a phone. */
export const shellLayout = (children: readonly BlockNode[], inset = false): BlockNode => ({
  type: 'flex',
  props: {
    className:
      `flex min-h-svh w-full flex-col items-stretch md:flex-row ${inset ? 'bg-sidebar' : ''}`.trim(),
  },
  children,
})

type Section = readonly [label: string, icon: string, slug: string, pages: readonly string[]]

/** shadcn's `NavMain` demo sections. */
export const PLATFORM: readonly Section[] = [
  ['Playground', 'square-terminal', 'playground', ['History', 'Starred', 'Settings']],
  ['Models', 'bot', 'models', ['Genesis', 'Explorer', 'Quantum']],
  ['Documentation', 'book-open', 'docs', ['Introduction', 'Get Started', 'Tutorials', 'Changelog']],
  ['Settings', 'settings-2', 'settings', ['General', 'Team', 'Billing', 'Limits']],
]

type Entry = readonly [label: string, icon: string, href: string]

/** shadcn's `NavProjects` demo entries. */
export const PROJECTS: readonly Entry[] = [
  ['Design Engineering', 'frame', '/projects/design-engineering'],
  ['Sales & Marketing', 'chart-pie', '/projects/sales-marketing'],
  ['Travel', 'map', '/projects/travel'],
]

/** shadcn's `NavSecondary` demo entries. */
export const SECONDARY: readonly Entry[] = [
  ['Support', 'life-buoy', '/support'],
  ['Feedback', 'send', '/feedback'],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/** `NavMain`: each section a row that unfolds its pages; the first starts open. */
export const platformGroup = (label = 'Platform'): Readonly<Record<string, unknown>> => ({
  label,
  items: PLATFORM.map(([title, icon, slug, pages], index) => ({
    label: title,
    icon,
    ...(index === 0 ? { defaultExpanded: true } : {}),
    children: pages.map((page) => ({ label: page, href: `/${slug}/${slugOf(page)}` })),
  })),
})

/** `NavProjects`: a row per project, each with its "More" control. */
export const projectsGroup = (): Readonly<Record<string, unknown>> => ({
  label: 'Projects',
  action: { icon: 'plus', label: 'New project', href: '/projects/new' },
  items: PROJECTS.map(([label, icon, href]) => ({
    label,
    icon,
    href,
    menuAction: { icon: 'ellipsis', label: `More for ${label}`, href },
  })),
})

/** `NavSecondary`: support and feedback, with no heading. */
export const secondaryGroup = (): Readonly<Record<string, unknown>> => ({
  items: SECONDARY.map(([label, icon, href]) => ({ label, icon, href })),
})

// ─── Rows the sidebar's groups cannot draw ─────────────────────────────────

/** A default-size sidebar row on a link (`SidebarMenuButton` drawn outside the groups). */
const ROW =
  'flex h-8 font-normal w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground no-underline outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:shrink-0'

/** A sidebar row linking somewhere, with an optional leading icon. */
export const rowLink = (label: string, href: string, iconName?: string): BlockNode => ({
  type: 'link',
  props: { href, className: ROW },
  children: [
    ...(iconName === undefined ? [] : [{ type: 'icon', props: { name: iconName, size: 16 } }]),
    { type: 'text', element: 'span', props: { className: 'truncate' }, content: label },
  ],
})

/** `SidebarGroup` wrapping a `Collapsible`: a heading that folds the rows under it. */
export const foldingGroup = (
  label: string,
  rows: readonly BlockNode[],
  defaultOpen = true
): BlockNode => ({
  type: 'collapsible',
  triggerLabel: label,
  ...(defaultOpen ? { defaultOpen: true } : {}),
  props: { className: 'w-full px-2 py-1 text-xs font-medium text-sidebar-foreground/70' },
  children: [
    {
      type: 'container',
      element: 'nav',
      props: { 'aria-label': label, className: 'flex w-full min-w-0 flex-col gap-1 pt-1' },
      children: rows,
    },
  ],
})

/** The sidebar's content column, for blocks whose content is authored rows. */
export const contentColumn = (children: readonly BlockNode[]): BlockNode => ({
  type: 'container',
  props: { className: 'flex w-full min-w-0 flex-col gap-2 p-2' },
  children,
})

/** A calendar the reader ticks on and off, as shadcn's `sidebar-12` lists them. */
const calendarRow = (id: string, label: string, checked: boolean): BlockNode => ({
  type: 'flex',
  props: { className: 'flex h-8 items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent' },
  children: [
    { type: 'checkbox', checked, props: { id, name: id } },
    { type: 'label', text: label, for: id },
  ],
})

type CalendarList = readonly [title: string, entries: readonly string[]]

const CALENDARS: readonly CalendarList[] = [
  ['My Calendars', ['Personal', 'Work', 'Family']],
  ['Favorites', ['Holidays', 'Birthdays']],
  ['Other', ['Travel', 'Reminders', 'Deadlines']],
]

/** `sidebar-12`'s content: a month to pick from, then the calendars in folding groups. */
export const calendarSidebarContent = (name: string): readonly BlockNode[] => [
  {
    type: 'calendar',
    props: { className: 'mx-auto bg-transparent [--cell-size:2.1rem]' },
  },
  { type: 'separator' },
  ...CALENDARS.map(([title, entries], groupIndex) =>
    foldingGroup(
      title,
      entries.map((label, index) =>
        calendarRow(
          `${name}-${slugOf(title)}-${slugOf(label)}`,
          label,
          groupIndex === 0 && index < 2
        )
      )
    )
  ),
]
