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
 * 4.5:1, and the shortcut opens the menu all the same. In a bar narrower than
 * 42rem — a phone, or a tablet beside the expanded sidebar — it is an icon
 * button, leaving the trail the width (a query on the header, `@container`,
 * not on the window); its label names it at every width.
 */
const searchButton = (): BlockNode => ({
  type: 'button',
  variant: 'outline',
  props: {
    type: 'button',
    'aria-label': 'Search',
    'data-command-palette-trigger': 'true',
    className:
      'relative size-8 shrink-0 justify-center gap-2 rounded-md px-0 text-sm font-normal text-muted-foreground shadow-none @2xl:w-56 @2xl:justify-start @2xl:px-2',
  },
  children: [
    { type: 'icon', props: { name: 'search', size: 16 } },
    {
      type: 'text',
      element: 'span',
      props: { className: 'hidden flex-1 text-left @2xl:inline' },
      content: 'Search…',
    },
  ],
})

/**
 * The notice an operator without the write tier reads beside the search:
 * shown to whoever does NOT hold `edit-operations`. The sentence needs the
 * room of a wide screen (from 1440px); from `md` up to there the bar says it
 * in two words (`shortText`), so a page that adds facts beside the trail
 * still leaves the reader told. It stays on one line in the 48px bar: when the
 * bar runs short it ends in an ellipsis. A page that adds facts beside the
 * trail gets the two words at every width: the facts are what that page is
 * read for, and the sentence would take the room they need.
 */
const readOnlyNotice = (text: string, shortText: string): readonly BlockNode[] => [
  ...when(text, {
    type: 'text',
    element: 'span',
    visibility: { unlessCapability: 'edit-operations' },
    props: {
      className:
        'hidden min-w-0 truncate text-xs text-muted-foreground min-[90rem]:block [header>:nth-child(3)>&]:hidden',
    },
    content: text,
  }),
  ...when(shortText, {
    type: 'text',
    element: 'span',
    visibility: { unlessCapability: 'edit-operations' },
    props: {
      className:
        'hidden shrink-0 text-xs whitespace-nowrap text-muted-foreground md:block min-[90rem]:hidden min-[90rem]:[header>:nth-child(3)>&]:block',
    },
    content: shortText,
  }),
]

/**
 * The account row: shadcn's NavUser — the avatar, the operator's name over
 * their email, the menu's chevron at the row's end, in shadcn's 48px row. The
 * role rides on the name's line as a small badge — `roleLabel` for an operator
 * holding `edit-operations`, `readOnlyRoleLabel` for anyone else, either left
 * out while its label is empty — so the block stays two lines. The name gives
 * way first, then the badge; the email truncates on its own line.
 */
const ROLE_BADGE = { className: 'h-4 max-w-[60%] shrink truncate px-1.5 text-[10px]' } as const

const accountRow = (roleLabel: string, readOnlyRoleLabel: string): BlockNode => {
  const row = userRow('shadcn', 'm@example.com', 'CN')
  const children = row['children'] as readonly BlockNode[]
  const [avatar, names, chevron] = children
  const [name, email] = names?.['children'] as readonly BlockNode[]
  const badges = [
    ...when(roleLabel, {
      type: 'badge',
      badgeVariant: 'secondary',
      visibility: { capability: 'edit-operations' },
      props: ROLE_BADGE,
      content: roleLabel,
    }),
    ...when(readOnlyRoleLabel, {
      type: 'badge',
      badgeVariant: 'outline',
      visibility: { unlessCapability: 'edit-operations' },
      props: ROLE_BADGE,
      content: readOnlyRoleLabel,
    }),
  ]
  const named = {
    ...names,
    props: { className: 'grid min-w-0 flex-1 gap-0.5 text-left text-sm leading-tight' },
    children: [
      {
        type: 'flex',
        props: { className: 'flex min-w-0 items-center gap-1.5' },
        children: [{ ...name, props: { className: 'min-w-0 truncate font-medium' } }, ...badges],
      },
      { ...email, props: { className: 'truncate text-xs text-sidebar-foreground/70' } },
    ],
  } as BlockNode
  const chevronProps = chevron?.['props'] as Readonly<Record<string, unknown>>
  return {
    ...row,
    children: [
      avatar,
      named,
      {
        ...chevron,
        props: {
          ...chevronProps,
          className: 'ml-auto shrink-0 group-data-[collapsible=icon]/sidebar:hidden',
        },
      },
    ] as BlockNode[],
  }
}

/**
 * sidebar-16's site header, on sidebar-07's inset: held at the top while the
 * page scrolls, with the trail, the search and the scheme toggle. It leaves the
 * sidebar's fold trigger its room at the start. It is 48px tall, border
 * included: shadcn's site-header height (`h-12`).
 */
const siteHeader = (notice: string, shortNotice: string): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className:
      '@container sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background pr-4 pl-11',
  },
  children: [
    {
      ...crumbs([['Build Your Application', '/docs'], ['Data Fetching']]),
      // One row whatever the width: the trail never wraps, the first and the
      // last crumbs give way before the others, and below `sm` it keeps only
      // its root and the page the reader is on. It takes its own width and no
      // more, so whatever a page adds beside it grows into the rest, and when
      // the bar runs short it is the trail that gives way: the controls keep
      // their width, so they never run past the bar's end.
      props: {
        className:
          'min-w-0 flex-initial overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate [&_li:last-child]:min-w-0 [&_li:last-child]:shrink [&_li:last-child>*]:block [&_li:last-child>*]:truncate max-sm:[&_li:not(:first-child):not(:nth-last-child(-n+2))]:hidden',
      },
    },
    {
      type: 'container',
      props: { className: 'ml-auto flex shrink-0 items-center gap-2' },
      children: [
        searchButton(),
        ...readOnlyNotice(notice, shortNotice),
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
    "Set `roleLabel` and `readOnlyRoleLabel` to show the operator's role under their name, on its own line above their email, and `readOnlyNotice` to tell an operator without `edit-operations` beside the search, on a wide screen, that they can only read — with `readOnlyShortNotice` saying it in a word or two on a narrower one. Each is left out while empty.",
    ...SHELL_NOTES,
  ],
  params: [
    stringParam(
      'roleLabel',
      "The badge under the operator's name when they hold `edit-operations`; empty leaves it out.",
      ''
    ),
    stringParam(
      'readOnlyRoleLabel',
      "The badge under the operator's name when they do not hold `edit-operations`; empty leaves it out.",
      ''
    ),
    stringParam(
      'readOnlyNotice',
      'The notice beside the search for an operator without `edit-operations`, from 1440px up; empty leaves it out.',
      ''
    ),
    stringParam(
      'readOnlyShortNotice',
      'The same notice in a word or two, from `md` up to 1440px; empty leaves it out.',
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
        {
          ...shellSidebar({
            collapsible: 'icon',
            railHandle: true,
            // The site header is 48px (`h-12`), not the kit's 44px bar: the
            // fold controls stand 10px down so they sit on its centre.
            extra: '[--sidebar-trigger-top:0.625rem]',
            header: [identityRow()],
            groups: [platformGroup()],
            footer: [accountRow(p('roleLabel'), p('readOnlyRoleLabel'))],
          }),
          // A console brings its own navigation, so the app's content swap stays off.
          clientSideNavigation: false,
        },
        {
          type: 'container',
          element: 'div',
          // The one scroll region. `relative` makes it the containing block of
          // every absolutely positioned descendant — an `sr-only` label above
          // all — so none resolves against the document and lengthens the
          // window behind the column, a second scroll past the page's end.
          props: {
            className: 'relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-background',
          },
          children: [
            siteHeader(p('readOnlyNotice'), p('readOnlyShortNotice')),
            placeholderContent(),
          ],
        },
      ],
    })
  },
})
