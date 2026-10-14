/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  brandRow,
  buttonLink,
  crumbs,
  insetHeader,
  OWN_GLYPH_ONLY,
  placeholderContent,
  ROW_CLASS,
  SIDEBAR_NOTES,
  sidebarContentRows,
  sidebarFrame,
  sidebarInset,
  sidebarLayout,
} from '@/library/manifest/navigation-block-kit'
import type { BlockNode } from '@/library/manifest/block-kit'

type Section = readonly [title: string, slug: string, entries: readonly string[]]

const SECTIONS: readonly Section[] = [
  ['Getting Started', 'getting-started', ['Installation', 'Project Structure']],
  ['Build Your Application', 'build', ['Routing', 'Data Fetching', 'Rendering', 'Caching']],
  ['API Reference', 'api', ['Components', 'File Conventions', 'Functions', 'CLI']],
  ['Architecture', 'architecture', ['Accessibility', 'Fast Refresh', 'Supported Browsers']],
]

const slugOf = (label: string): string => label.toLowerCase().replaceAll(' ', '-')

/**
 * One section: shadcn's `SidebarMenuItem` holding a row, drawn as shadcn's
 * `SidebarMenuButton`, that opens the section's pages as a dropdown menu.
 * A `container` cannot be a `ul`/`li`, so the list roles carry the semantics.
 * The trigger keeps the menu's own `dropdown-menu-trigger` slot: the dropdown
 * draws its trigger itself and takes no other part name for it.
 */
const sectionMenu = ([label, section, entries]: Section): BlockNode => ({
  type: 'container',
  props: {
    'data-slot': 'sidebar-menu-item',
    role: 'listitem',
    className: 'group/menu-item relative',
  },
  children: [
    {
      type: 'dropdown-menu',
      triggerLabel: label,
      props: { className: `${ROW_CLASS} ${OWN_GLYPH_ONLY}` },
      menuItems: entries.map((entryLabel) => ({
        label: entryLabel,
        action: { type: 'navigate', path: `/docs/${section}/${slugOf(entryLabel)}` },
      })),
      children: [
        { type: 'text', element: 'span', props: { className: 'truncate' }, content: label },
        { type: 'icon', props: { name: 'ellipsis', size: 16, className: 'ml-auto' } },
      ],
    },
  ],
})

/** shadcn's `SidebarGroup` > `SidebarMenu`: the sections as one menu list. */
const sectionGroup = (): BlockNode => ({
  type: 'container',
  props: { 'data-slot': 'sidebar-group', className: 'relative flex w-full min-w-0 flex-col' },
  children: [
    {
      type: 'container',
      props: {
        'data-slot': 'sidebar-menu',
        role: 'list',
        className: 'flex w-full min-w-0 flex-col gap-0',
      },
      children: SECTIONS.map(sectionMenu),
    },
  ],
})

/** shadcn's opt-in card at the foot of the sidebar. */
const optInCard = (): BlockNode => ({
  type: 'card',
  props: { className: 'gap-2 p-4 shadow-none' },
  children: [
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm font-medium text-card-foreground' },
      content: 'Subscribe to our newsletter',
    },
    {
      type: 'text',
      element: 'p',
      props: { className: 'text-sm text-muted-foreground' },
      content: 'Get the release notes when a new version ships.',
    },
    buttonLink('Subscribe', '/newsletter', { extra: 'mt-2 w-full' }),
  ],
})

/** shadcn/ui's `sidebar-06`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-06',
  shadcnBlock: 'sidebar-06',
  title: 'Sidebar 06',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'app frame', 'dropdown', 'menu', 'shadcn'],
  description: 'A sidebar with submenus as dropdowns.',
  notes: [
    'Each section is a row that opens its pages as a menu, rather than listing them in the sidebar. A card at the foot of the sidebar points to the newsletter sign-up: change its link to your own page.',
    ...SIDEBAR_NOTES.filter((note) => !note.startsWith('Entries mark')),
    'Edit the sections and their pages in the installed fragment. A row that opens a menu is not marked current: the page it leads to is in the menu.',
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      sidebarLayout([
        sidebarFrame(sidebarContentRows('Sections', [sectionGroup()]), {
          header: [brandRow('Documentation', 'v1.0.0', 'gallery-vertical-end', '/docs')],
          footer: [optInCard()],
        }),
        sidebarInset([
          insetHeader([crumbs([['Build Your Application', '/docs/build'], ['Data Fetching']])]),
          placeholderContent(),
        ]),
      ])
    ),
})
