/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
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
 * The release chip folds away when the app declares no version.
 */
const identityRow = (): BlockNode => ({
  type: 'link',
  props: { href: '/', className: LARGE_ROW },
  children: [
    {
      type: 'container',
      props: {
        className:
          'flex aspect-square size-8 flex-none items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground',
        'aria-hidden': 'true',
      },
      children: [{ type: 'icon', props: { name: 'gallery-vertical-end', size: 16 } }],
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
 * 4.5:1, and the shortcut opens the menu all the same.
 */
const searchButton = (): BlockNode => ({
  type: 'button',
  variant: 'outline',
  props: {
    type: 'button',
    'aria-label': 'Search',
    'data-command-palette-trigger': 'true',
    className:
      'relative h-8 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal text-muted-foreground shadow-none sm:w-56',
  },
  children: [
    { type: 'icon', props: { name: 'search', size: 16 } },
    { type: 'text', element: 'span', props: { className: 'flex-1 text-left' }, content: 'Search…' },
  ],
})

/**
 * sidebar-16's site header, on sidebar-07's inset: held at the top while the
 * page scrolls, with the trail, the search and the scheme toggle. It leaves the
 * sidebar's fold trigger its room at the start.
 */
const siteHeader = (): BlockNode => ({
  type: 'container',
  element: 'header',
  props: {
    className:
      'sticky top-0 z-10 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background pr-4 pl-11',
  },
  children: [
    {
      ...crumbs([['Build Your Application', '/docs'], ['Data Fetching']]),
      // One row whatever the width: the trail never wraps, and the FIRST crumb
      // is the one that gives way, so the page the reader is on stays whole.
      props: {
        className:
          'min-w-0 flex-1 overflow-hidden [&_ol]:min-w-0 [&_ol]:flex-nowrap [&_li]:shrink-0 [&_li:first-child]:min-w-0 [&_li:first-child]:shrink [&_li:first-child>*]:block [&_li:first-child>*]:truncate',
      },
    },
    {
      type: 'container',
      props: { className: 'ml-auto flex items-center gap-2' },
      children: [searchButton(), { type: 'theme-toggle', variant: 'icon' }],
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
    ...SHELL_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(name, {
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
          footer: [userRow('shadcn', 'm@example.com', 'CN')],
        }),
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex min-w-0 flex-1 flex-col overflow-y-auto bg-background' },
          children: [siteHeader(), placeholderContent()],
        },
      ],
    }),
})
