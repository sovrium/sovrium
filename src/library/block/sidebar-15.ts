/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { asComponent } from '@/library/manifest/block-kit'
import { defineLibraryEntry } from '@/library/manifest/define'
import {
  crumbs,
  placeholderContent,
  switcherRow,
  userRow,
} from '@/library/manifest/navigation-block-kit'
import {
  calendarSidebarContent,
  contentColumn,
  platformGroup,
  projectsGroup,
  SHELL_NOTES,
  shellHeader,
  shellInset,
  shellLayout,
  shellSidebar,
} from '@/library/manifest/sidebar-shell-block-kit'

/** shadcn/ui's `sidebar-15`, composed in config. */
export const entry = defineLibraryEntry({
  kind: 'block',
  slug: 'sidebar-15',
  shadcnBlock: 'sidebar-15',
  title: 'Sidebar 15',
  category: 'shadcn',
  tags: ['sidebar', 'navigation', 'two sidebars', 'right', 'calendar', 'shadcn'],
  description: 'A left and right sidebar.',
  notes: [
    'Two sidebars frame the content: on the left a team switcher over the Platform sections and the projects; on the right the account, a month to pick a day from and the calendars. Each folds on its own.',
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
          header: [
            switcherRow(
              'Switch team',
              { title: 'Acme Inc', subtitle: 'Enterprise', icon: 'gallery-vertical-end' },
              [
                ['Acme Inc', '/teams/acme-inc'],
                ['Acme Corp.', '/teams/acme-corp'],
              ]
            ),
          ],
          groups: [platformGroup(), projectsGroup()],
        }),
        shellInset([
          shellHeader([crumbs([['Project Management & Task Tracking']])], 'both'),
          placeholderContent(),
        ]),
        shellSidebar({
          collapsible: 'offcanvas',
          side: 'right',
          drawerLabel: 'Calendars',
          header: [userRow('shadcn', 'm@example.com', 'CN')],
          children: [contentColumn(calendarSidebarContent(name))],
        }),
      ])
    ),
})
