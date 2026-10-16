/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent, param, when } from '@/library/manifest/block-kit'
import { stringParam } from '@/library/manifest/block-notes'
import { defineLibraryEntry } from '@/library/manifest/define'
import { crumbs, placeholderContent, userRow } from '@/library/manifest/navigation-block-kit'
import {
  platformGroup,
  SHELL_NOTES,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

/** A row of `size: lg`, as sidebar-07's header and footer draw them. */
const LARGE_ROW =
  'flex h-12 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm text-sidebar-foreground no-underline ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:no-underline focus-visible:ring-2 group-data-[collapsible=icon]/sidebar:size-8! group-data-[collapsible=icon]/sidebar:p-0! [&_svg]:size-4 [&_svg]:shrink-0'

/**
 * The identity row heading the sidebar: the app's mark, its name with the
 * release it runs, and the engine under it, linking to the console's home.
 * The release chip folds away when the app declares no version. The mark tile
 * is filled by the engine (`data-app-mark`): the app's `design.logo`, else a
 * monogram of its display name.
 */
const identityRow = (): BlockNode => ({
  type: 'link',
  props: { href: '/', className: LARGE_ROW },
  children: [
    {
      type: 'container',
      props: {
        className:
          'flex aspect-square size-8 flex-none items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground data-[app-mark=logo]:bg-transparent',
        'data-app-mark': 'tile',
      },
    },
    {
      type: 'flex',
      props: { className: 'flex min-w-0 flex-1 flex-col gap-0.5 leading-none' },
      children: [
        {
          type: 'flex',
          props: { className: 'flex min-w-0 items-center gap-1.5' },
          children: [
            {
              type: 'text',
              element: 'span',
              props: { className: 'truncate font-medium' },
              content: 'Acme Inc',
            },
            {
              type: 'text',
              element: 'span',
              props: {
                className:
                  "shrink-0 rounded-sm bg-sidebar-accent px-1 font-mono text-[10px] leading-4 text-sidebar-foreground/70 before:content-['v'] empty:hidden!",
              },
              content: '2.4.0',
            },
          ],
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'truncate text-xs text-sidebar-foreground/70' },
          content: 'Sovrium v0.37.0',
        },
      ],
    },
  ],
})

/**
 * The search control of the site header: a button that opens the page's
 * command menu. sidebar-16 draws a search field there; this is the same
 * control as a button, because the field it opens is the command menu's own.
 * No `⌘K` chip: base-nova's `Kbd` sets muted text on a muted ground, under
 * 4.5:1, and the shortcut opens the menu all the same. On a phone it is an
 * icon button, leaving the trail the width; its label names it at every width.
 */
const searchButton = (): BlockNode => ({
  type: 'button',
  variant: 'outline',
  props: {
    type: 'button',
    'aria-label': 'Search',
    'data-command-palette-trigger': 'true',
    className:
      'relative size-8 shrink-0 justify-center gap-2 rounded-md px-0 text-sm font-normal text-muted-foreground shadow-none sm:w-56 sm:justify-start sm:px-2',
  },
  children: [
    { type: 'icon', props: { name: 'search', size: 16 } },
    {
      type: 'text',
      element: 'span',
      props: { className: 'hidden flex-1 text-left sm:inline' },
      content: 'Search…',
    },
  ],
})

/**
 * The notice an operator without the write tier reads beside the search:
 * shown to whoever does NOT hold `edit-operations`, from `md` up.
 */
const readOnlyNotice = (text: string): readonly BlockNode[] =>
  when(text, {
    type: 'text',
    element: 'span',
    visibility: { unlessCapability: 'edit-operations' },
    props: { className: 'hidden text-xs text-muted-foreground md:inline' },
    content: text,
  })

/**
 * The account row with the operator's role after the name: `roleLabel` for an
 * operator holding `edit-operations`, `readOnlyRoleLabel` for anyone else.
 * Either badge is left out while its label is empty.
 */
const accountRow = (roleLabel: string, readOnlyRoleLabel: string): BlockNode => {
  const row = userRow('shadcn', 'm@example.com', 'CN')
  const children = row['children'] as readonly BlockNode[]
  const badges = [
    ...when(roleLabel, {
      type: 'badge',
      badgeVariant: 'secondary',
      visibility: { capability: 'edit-operations' },
      content: roleLabel,
    }),
    ...when(readOnlyRoleLabel, {
      type: 'badge',
      badgeVariant: 'outline',
      visibility: { unlessCapability: 'edit-operations' },
      content: readOnlyRoleLabel,
    }),
  ]
  return { ...row, children: [...children.slice(0, -1), ...badges, ...children.slice(-1)] }
}

/**
 * sidebar-16's site header, on sidebar-07's inset: held at the top while the
 * page scrolls, with the trail, the search and the scheme toggle. It leaves the
 * sidebar's fold trigger its room at the start.
 */
const siteHeader = (notice: string): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className:
      'sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background pr-4 pl-11',
  },
  children: [
    {
      ...crumbs([['Build Your Application', '/docs'], ['Data Fetching']]),
      // One row whatever the width: the trail never wraps, the first and the
      // last crumbs give way before the others, and below `sm` it keeps only
      // its root and the page the reader is on.
      props: {
        className:
          'min-w-0 flex-1 overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate [&_li:last-child]:min-w-0 [&_li:last-child]:shrink [&_li:last-child>*]:block [&_li:last-child>*]:truncate max-sm:[&_li:not(:first-child):not(:nth-last-child(-n+2))]:hidden',
      },
    },
    {
      type: 'container',
      props: { className: 'ml-auto flex items-center gap-2' },
      children: [
        searchButton(),
        ...readOnlyNotice(notice),
        { type: 'theme-toggle', variant: 'icon' },
      ],
    },
  ],
})

/** The console frame: sidebar-07 with sidebar-16's sticky site header. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'console-shell',
  shadcnBlock: null,
  title: 'Console shell',
  category: 'console',
  tags: ['shell', 'sidebar', 'navigation', 'app frame', 'collapsible', 'header', 'console'],
  description:
    'An operator console frame: a sidebar that collapses to icons, beside a content column whose header stays in view.',
  notes: [
    "No single shadcn counterpart: it is shadcn's `sidebar-07` (the sidebar that collapses to icons, the account at its foot) with the sticky site header of `sidebar-16` (the trail, a search control, the scheme toggle) across its content column.",
    'The frame fills the viewport and the content column scrolls on its own, so the sidebar and the header stay put while a long page moves.',
    'The sidebar heads with the app: its mark, its name, the release it runs (hidden when the app declares none) and the engine under it.',
    "The search control opens the page's command menu: pair it with the `command` block.",
    "Set `roleLabel` and `readOnlyRoleLabel` to show the operator's role after their name, and `readOnlyNotice` to tell an operator without `edit-operations` beside the search that they can only read. Each is left out while empty.",
    ...SHELL_NOTES,
  ],
  params: [
    stringParam(
      'roleLabel',
      "The badge after the operator's name when they hold `edit-operations`; empty leaves it out.",
      ''
    ),
    stringParam(
      'readOnlyRoleLabel',
      "The badge after the operator's name when they do not hold `edit-operations`; empty leaves it out.",
      ''
    ),
    stringParam(
      'readOnlyNotice',
      'The notice beside the search for an operator without `edit-operations`; empty leaves it out.',
      ''
    ),
  ],
  env: [],
  requires: [],
  build: ({ name, params }) => {
    const p = param(params)
    return asComponent(name, {
      type: 'flex',
      props: {
        className: 'flex h-svh w-full flex-col items-stretch overflow-hidden md:flex-row',
      },
      children: [
        shellSidebar({
          collapsible: 'icon',
          railHandle: true,
          header: [identityRow()],
          groups: [platformGroup()],
          footer: [accountRow(p('roleLabel'), p('readOnlyRoleLabel'))],
        }),
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-background' },
          children: [siteHeader(p('readOnlyNotice')), placeholderContent()],
        },
      ],
    })
  },
})
