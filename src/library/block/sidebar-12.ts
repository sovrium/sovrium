/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  buttonLink,
  crumbs,
  placeholderContent,
  userRow,
} from '@/library/manifest/navigation-block-kit'
import {
  calendarSidebarContent,
  contentColumn,
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

/** shadcn/ui's `sidebar-12`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-12',
  shadcnBlock: 'sidebar-12',
  title: 'Sidebar 12',
  category: 'shadcn',
  tags: ['sidebar', 'calendar', 'date', 'checkbox', 'shadcn'],
  description: 'A sidebar with a calendar.',
  notes: [
    'The account heads the sidebar. Under it, a month to pick a day from, then three folding groups of calendars, each ticked on or off; a "New calendar" button sits at the foot.',
    'The day calendar picks a date in the page; wire it to your own view by giving it a `name` inside a form, or replace the demo calendars with your own.',
    ...SHELL_NOTES,
  ],
  params: [],
  env: [],
  requires: [],
  build: ({ name }) =>
    asComponent(
      name,
      shellLayout([
        shellSidebar({
          collapsible: 'offcanvas',
          header: [userRow('shadcn', 'm@example.com', 'CN')],
          children: [contentColumn(calendarSidebarContent(name))],
          footer: [
            buttonLink('New calendar', '/calendars/new', {
              variant: 'ghost',
              extra: 'w-full justify-start',
            }),
          ],
        }),
        shellInset([shellHeader([crumbs([['October 2026']])]), placeholderContent()]),
      ])
    ),
})
